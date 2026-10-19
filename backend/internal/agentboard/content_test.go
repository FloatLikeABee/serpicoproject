package agentboard

import (
	"database/sql"
	"errors"
	"strings"
	"testing"
	"time"
	"unicode/utf8"
)

func claimForContent(t *testing.T, db *sql.DB, now time.Time) Identity {
	t.Helper()
	ident, err := ClaimIdentity(db, now)
	if err != nil {
		t.Fatal(err)
	}
	return ident
}

func TestInsertResourceRequiresClaimAndBuildsPortableSkill(t *testing.T) {
	db := openBoard(t)
	now := time.Date(2026, 10, 19, 1, 2, 3, 0, time.UTC)
	ident := claimForContent(t, db, now)

	got, err := InsertResource(db, ResourceInput{
		Kind:       "skill",
		AgentID:    ident.ID,
		AuthorName: "  Map Team  ",
		Title:      "Go & Mapping: Field Notes",
		Summary:    "Use \"safe\" routes.",
		Body:       "# Route planning\n\nKeep `<raw>` as Markdown source.",
		Tags:       []string{" Go ", "mapping", "GO"},
	}, now.Add(time.Second))
	if err != nil {
		t.Fatal(err)
	}

	if got.Kind != "skill" || got.AgentID != ident.ID || got.AgentName != ident.Nickname {
		t.Fatalf("identity not resolved: %+v", got)
	}
	if got.AuthorName != "Map Team" || got.Title != "Go & Mapping: Field Notes" {
		t.Fatalf("plain metadata not normalized: %+v", got)
	}
	if len(got.Tags) != 2 || got.Tags[0] != "go" || got.Tags[1] != "mapping" {
		t.Fatalf("tags = %#v", got.Tags)
	}
	wantSkill := "---\nname: go-mapping-field-notes\ndescription: \"Use \\\"safe\\\" routes.\"\n---\n# Route planning\n\nKeep `<raw>` as Markdown source.\n"
	if got.SkillMarkdown != wantSkill {
		t.Fatalf("skill markdown\nwant:\n%s\ngot:\n%s", wantSkill, got.SkillMarkdown)
	}
	if got.DownloadURL != "/api/v1/agent-content/"+got.ID+"/download" {
		t.Fatalf("download URL %q", got.DownloadURL)
	}

	fallback, err := InsertResource(db, ResourceInput{
		Kind:       "skill",
		AgentID:    ident.ID,
		AuthorName: "地图组",
		Title:      "地图技能",
		Summary:    "中文说明",
		Body:       "正文",
	}, now.Add(2*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	wantName := "skill-" + fallback.ID[:8]
	if !strings.Contains(fallback.SkillMarkdown, "name: "+wantName+"\n") || fallback.SafeName != wantName {
		t.Fatalf("fallback name missing: %+v", fallback)
	}

	longASCII := strings.Repeat("word-", 24)
	truncated, err := InsertResource(db, ResourceInput{
		Kind:       "skill",
		AgentID:    ident.ID,
		AuthorName: "Map Team",
		Title:      longASCII,
		Summary:    "summary",
		Body:       "body",
	}, now.Add(3*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	if utf8.RuneCountInString(truncated.SafeName) > 64 || strings.HasSuffix(truncated.SafeName, "-") {
		t.Fatalf("unsafe skill name %q", truncated.SafeName)
	}

	_, err = InsertResource(db, ResourceInput{
		Kind:       "experience",
		AgentID:    "unknown",
		AuthorName: "Map Team",
		Title:      "A shift",
		Summary:    "summary",
		Body:       "body",
	}, now)
	if err == nil || !strings.Contains(err.Error(), "agent id is not known") {
		t.Fatalf("unknown identity error = %v", err)
	}
}

func TestValidateResourceBounds(t *testing.T) {
	valid := ResourceInput{
		Kind:       "experience",
		AgentID:    "claim",
		AuthorName: "Author",
		Title:      "Shift notes",
		Summary:    "What happened",
		Body:       "Details",
	}
	cases := []struct {
		name string
		edit func(*ResourceInput)
	}{
		{"kind", func(in *ResourceInput) { in.Kind = "travel" }},
		{"agent", func(in *ResourceInput) { in.AgentID = "" }},
		{"author", func(in *ResourceInput) { in.AuthorName = "" }},
		{"title", func(in *ResourceInput) { in.Title = "" }},
		{"summary", func(in *ResourceInput) { in.Summary = "" }},
		{"body", func(in *ResourceInput) { in.Body = "" }},
		{"title length", func(in *ResourceInput) { in.Title = strings.Repeat("t", 121) }},
		{"summary length", func(in *ResourceInput) { in.Summary = strings.Repeat("s", 281) }},
		{"author length", func(in *ResourceInput) { in.AuthorName = strings.Repeat("a", 81) }},
		{"body length", func(in *ResourceInput) { in.Body = strings.Repeat("b", 32001) }},
		{"tag count", func(in *ResourceInput) { in.Tags = []string{"1", "2", "3", "4", "5", "6", "7", "8", "9"} }},
		{"tag length", func(in *ResourceInput) { in.Tags = []string{strings.Repeat("x", 33)} }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			in := valid
			tc.edit(&in)
			if err := ValidateResource(in); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

func TestInsertResourceIsAtomicAndPrunesTagsWithOldRows(t *testing.T) {
	db := openBoard(t)
	now := time.Date(2026, 10, 19, 2, 0, 0, 0, time.UTC)
	ident := claimForContent(t, db, now)

	if _, err := db.Exec(`CREATE TRIGGER reject_boom_tag BEFORE INSERT ON agent_resource_tags
		WHEN NEW.normalized_tag = 'boom' BEGIN SELECT RAISE(FAIL, 'boom tag'); END`); err != nil {
		t.Fatal(err)
	}
	_, err := InsertResource(db, ResourceInput{
		Kind:       "skill",
		AgentID:    ident.ID,
		AuthorName: "Author",
		Title:      "Atomic",
		Summary:    "summary",
		Body:       "body",
		Tags:       []string{"ok", "boom"},
	}, now)
	if err == nil {
		t.Fatal("expected trigger failure")
	}
	var resources, tags int
	if err := db.QueryRow(`SELECT COUNT(*) FROM agent_resources`).Scan(&resources); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM agent_resource_tags`).Scan(&tags); err != nil {
		t.Fatal(err)
	}
	if resources != 0 || tags != 0 {
		t.Fatalf("partial publication committed: resources=%d tags=%d", resources, tags)
	}
	if _, err := db.Exec(`DROP TRIGGER reject_boom_tag`); err != nil {
		t.Fatal(err)
	}

	for i := 0; i < ResourceMaxRows; i++ {
		id := "old-" + strings.Repeat("0", 4-len(strings.TrimLeft(strings.Repeat("0", 4), "0")))
		id = id + time.Unix(int64(i), 0).UTC().Format("150405.000000000")
		created := now.Add(time.Duration(i) * time.Second).Format(time.RFC3339Nano)
		if _, err := db.Exec(`INSERT INTO agent_resources
			(id, kind, agent_id, agent_name, author_name, author_normalized, title, slug, summary, body, search_text, created_at)
			VALUES (?, 'skill', ?, ?, 'Author', 'author', 'Old', 'old', 'summary', 'body', 'old summary body', ?)`,
			id, ident.ID, ident.Nickname, created); err != nil {
			t.Fatal(err)
		}
		if i == 0 {
			if _, err := db.Exec(`INSERT INTO agent_resource_tags (resource_id, normalized_tag) VALUES (?, 'old-tag')`, id); err != nil {
				t.Fatal(err)
			}
		}
	}
	newest, err := InsertResource(db, ResourceInput{
		Kind:       "skill",
		AgentID:    ident.ID,
		AuthorName: "Author",
		Title:      "Newest",
		Summary:    "summary",
		Body:       "body",
		Tags:       []string{"new"},
	}, now.Add(2*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM agent_resources WHERE kind = 'skill'`).Scan(&resources); err != nil {
		t.Fatal(err)
	}
	if resources != ResourceMaxRows {
		t.Fatalf("resources=%d want %d", resources, ResourceMaxRows)
	}
	var newestCount, oldTagCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM agent_resources WHERE id = ?`, newest.ID).Scan(&newestCount); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM agent_resource_tags WHERE normalized_tag = 'old-tag'`).Scan(&oldTagCount); err != nil {
		t.Fatal(err)
	}
	if newestCount != 1 || oldTagCount != 0 {
		t.Fatalf("retention newest=%d orphan tags=%d", newestCount, oldTagCount)
	}
}

func TestSearchContentMatchesTermsAndFacetsAcrossResourcesAndPosts(t *testing.T) {
	db := openBoard(t)
	start := time.Date(2026, 10, 19, 3, 0, 0, 0, time.UTC)
	aliceAgent := claimForContent(t, db, start)
	bobAgent := claimForContent(t, db, start.Add(time.Second))

	aliceSkill, err := InsertResource(db, ResourceInput{
		Kind:       "skill",
		AgentID:    aliceAgent.ID,
		AuthorName: "Alice Team",
		Title:      "Route Mapper",
		Summary:    "Map safer city routes",
		Body:       "Use Go to compare mapping paths.",
		Tags:       []string{"go", "mapping"},
	}, start.Add(5*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	aliceExperience, err := InsertResource(db, ResourceInput{
		Kind:       "experience",
		AgentID:    aliceAgent.ID,
		AuthorName: "Alice Team",
		Title:      "Night shift",
		Summary:    "Working with mapping teams",
		Body:       "We reviewed routes after dark.",
		Tags:       []string{"mapping", "operations"},
	}, start.Add(4*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	_, err = InsertResource(db, ResourceInput{
		Kind:       "skill",
		AgentID:    bobAgent.ID,
		AuthorName: "Bob",
		Title:      "Go Reports",
		Summary:    "Write short reports",
		Body:       "Use Go templates.",
		Tags:       []string{"go"},
	}, start.Add(3*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	travel, err := InsertPost(db, "travel", PostInput{
		AgentID:   aliceAgent.ID,
		AgentName: "ignored",
		PlaceName: "Lisbon",
		Title:     "Tram routes",
		Lat:       38.7,
		Lng:       -9.1,
		Body:      "Mapping a tram line through the old city.",
	}, start.Add(6*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	_, err = InsertPost(db, "thought", PostInput{
		AgentName: "Drifter",
		PlaceName: "Harbor",
		Lat:       1,
		Lng:       2,
		Body:      "Quiet water before dawn.",
	}, start.Add(2*time.Second))
	if err != nil {
		t.Fatal(err)
	}

	knowledge, err := SearchContent(db, SearchOptions{
		Q:       "mapping",
		Kinds:   []string{"skill", "experience", "skill"},
		Author:  "ALICE TEAM",
		AgentID: aliceAgent.ID,
		Tags:    []string{"mapping"},
		Limit:   20,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(knowledge.Items) != 2 || knowledge.Items[0].ID != aliceSkill.ID || knowledge.Items[1].ID != aliceExperience.ID {
		t.Fatalf("knowledge results: %+v", knowledge.Items)
	}
	for _, item := range knowledge.Items {
		if item.Kind == "travel" || item.Kind == "thought" || item.AuthorName != "Alice Team" {
			t.Fatalf("wrong knowledge facet result: %+v", item)
		}
	}

	allTags, err := SearchContent(db, SearchOptions{Tags: []string{"GO", " mapping "}, Limit: 20})
	if err != nil {
		t.Fatal(err)
	}
	if len(allTags.Items) != 1 || allTags.Items[0].ID != aliceSkill.ID {
		t.Fatalf("all-tag results: %+v", allTags.Items)
	}

	place, err := SearchContent(db, SearchOptions{Q: "lisbon tram", Limit: 20})
	if err != nil {
		t.Fatal(err)
	}
	if len(place.Items) != 1 || place.Items[0].ID != travel.ID || place.Items[0].Kind != "travel" {
		t.Fatalf("place results: %+v", place.Items)
	}

	own, err := SearchContent(db, SearchOptions{AgentID: aliceAgent.ID, Limit: 20})
	if err != nil {
		t.Fatal(err)
	}
	if len(own.Items) != 3 {
		t.Fatalf("agent results: %+v", own.Items)
	}
}

func TestSearchContentPaginatesWithoutDuplicatesAndBuildsPlainExcerpts(t *testing.T) {
	db := openBoard(t)
	start := time.Date(2026, 10, 19, 4, 0, 0, 0, time.UTC)
	ident := claimForContent(t, db, start)
	for i, title := range []string{"Oldest", "Middle", "Newest"} {
		_, err := InsertResource(db, ResourceInput{
			Kind:       "experience",
			AgentID:    ident.ID,
			AuthorName: "Author",
			Title:      title,
			Summary:    strings.Repeat(title+" ", 35),
			Body:       "# heading\n\nbody",
		}, start.Add(time.Duration(i)*time.Second))
		if err != nil {
			t.Fatal(err)
		}
	}

	first, err := SearchContent(db, SearchOptions{Kinds: []string{"experience"}, Limit: 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(first.Items) != 2 || first.Items[0].Title != "Newest" || first.Items[1].Title != "Middle" || first.NextCursor == "" {
		t.Fatalf("first page: %+v", first)
	}
	if utf8.RuneCountInString(first.Items[0].Excerpt) > 200 || strings.Contains(first.Items[0].Excerpt, "#") {
		t.Fatalf("excerpt %q", first.Items[0].Excerpt)
	}

	second, err := SearchContent(db, SearchOptions{Kinds: []string{"experience"}, Limit: 2, Cursor: first.NextCursor})
	if err != nil {
		t.Fatal(err)
	}
	if len(second.Items) != 1 || second.Items[0].Title != "Oldest" || second.NextCursor != "" {
		t.Fatalf("second page: %+v", second)
	}
	if second.Items[0].ID == first.Items[0].ID || second.Items[0].ID == first.Items[1].ID {
		t.Fatal("cursor repeated a result")
	}
}

func TestSearchContentRejectsUnboundedInputs(t *testing.T) {
	db := openBoard(t)
	cases := []SearchOptions{
		{Q: strings.Repeat("q", 201)},
		{Q: "1 2 3 4 5 6 7 8 9 10 11"},
		{Kinds: []string{"skill", "wrong"}},
		{Author: strings.Repeat("a", 81)},
		{AgentID: strings.Repeat("i", 65)},
		{Tags: []string{"1", "2", "3", "4", "5", "6", "7", "8", "9"}},
		{Tags: []string{strings.Repeat("t", 33)}},
		{Limit: 51},
		{Cursor: strings.Repeat("c", 513)},
		{Cursor: "not-a-cursor"},
	}
	for i, options := range cases {
		if _, err := SearchContent(db, options); err == nil {
			t.Fatalf("case %d expected validation error: %+v", i, options)
		}
	}
}

func TestGetContentReturnsResourcesAndPosts(t *testing.T) {
	db := openBoard(t)
	now := time.Date(2026, 10, 19, 5, 0, 0, 0, time.UTC)
	ident := claimForContent(t, db, now)
	skill, err := InsertResource(db, ResourceInput{
		Kind:       "skill",
		AgentID:    ident.ID,
		AuthorName: "Author",
		Title:      "Skill",
		Summary:    "summary",
		Body:       "body",
		Tags:       []string{"one"},
	}, now)
	if err != nil {
		t.Fatal(err)
	}
	travel, err := InsertPost(db, "travel", PostInput{
		AgentID: ident.ID, AgentName: "ignored", PlaceName: "Lisbon",
		Title: "Trip", Lat: 1, Lng: 2, Body: "travel body",
	}, now.Add(time.Second))
	if err != nil {
		t.Fatal(err)
	}

	gotSkill, err := GetContent(db, skill.ID)
	if err != nil {
		t.Fatal(err)
	}
	if gotSkill.SkillMarkdown == "" || gotSkill.DownloadURL == "" || len(gotSkill.Tags) != 1 {
		t.Fatalf("skill detail: %+v", gotSkill)
	}
	gotTravel, err := GetContent(db, travel.ID)
	if err != nil {
		t.Fatal(err)
	}
	if gotTravel.Kind != "travel" || gotTravel.PlaceName != "Lisbon" || gotTravel.Lat == nil || *gotTravel.Lat != 1 {
		t.Fatalf("travel detail: %+v", gotTravel)
	}
	if _, err := GetContent(db, "missing"); !errors.Is(err, ErrContentNotFound) {
		t.Fatalf("missing error = %v", err)
	}
}
