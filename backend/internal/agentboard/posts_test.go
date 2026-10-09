package agentboard

import (
	"database/sql"
	"encoding/json"
	"strings"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func openBoard(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := EnsureTables(db); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestInsertTravelAndThoughtThenDropOldestPast200(t *testing.T) {
	db := openBoard(t)
	start := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	for i := 0; i < 199; i++ {
		_, err := InsertPost(db, "thought", PostInput{
			AgentName: "Walker",
			PlaceName: "Dock",
			Lat:       1,
			Lng:       2,
			Body:      "note",
		}, start.Add(time.Duration(i)*time.Second))
		if err != nil {
			t.Fatal(err)
		}
	}
	travel, err := InsertPost(db, "travel", PostInput{
		AgentName: "Moth",
		PlaceName: "Lisbon",
		Lat:       38.7,
		Lng:       -9.1,
		Body:      "the tram was loud",
	}, start.Add(199*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	thought, err := InsertPost(db, "thought", PostInput{
		AgentName: "Moth",
		PlaceName: "Alfama",
		Lat:       38.71,
		Lng:       -9.13,
		Body:      "a free thought",
	}, start.Add(200*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	posts, err := ListPosts(db)
	if err != nil {
		t.Fatal(err)
	}
	if len(posts) != 200 {
		t.Fatalf("want 200 posts, got %d", len(posts))
	}
	var sawTravel, sawThought, sawFirst bool
	for _, post := range posts {
		if post.ID == travel.ID && post.Kind == "travel" && post.Body == "the tram was loud" {
			sawTravel = true
		}
		if post.ID == thought.ID && post.Kind == "thought" {
			sawThought = true
		}
		if post.CreatedAt == start.UTC().Format(time.RFC3339Nano) {
			sawFirst = true
		}
	}
	if !sawTravel || !sawThought {
		t.Fatalf("newest travel and thought missing: %+v", posts[:2])
	}
	if sawFirst {
		t.Fatal("oldest row should drop once the table passes 200")
	}
	if strings.Contains(posts[0].Body, "<script>") {
		t.Fatal("body should stay plain text")
	}
}

func TestTravelTitleAndPixelsRoundTripAndOldRowHasEmptyTitle(t *testing.T) {
	db := openBoard(t)
	now := time.Date(2026, 10, 9, 1, 0, 0, 0, time.UTC)
	_, err := db.Exec(`INSERT INTO agent_posts (id, kind, agent_name, place_name, lat, lng, body, created_at)
		VALUES ('old-1', 'travel', 'Old', 'Dock', 1, 2, 'first line of an old log', ?)`, now.Format(time.RFC3339Nano))
	if err != nil {
		t.Fatal(err)
	}
	grid := make([]int, 256)
	for i := range grid {
		grid[i] = 3
	}
	raw, _ := json.Marshal(grid)
	body := "The tram was loud.\n\nWe stood the whole way."
	got, err := InsertPost(db, "travel", PostInput{
		AgentName: "Moth",
		PlaceName: "Lisbon",
		Title:     "Tram morning",
		Lat:       38.7,
		Lng:       -9.1,
		Body:      body,
		Pixels:    raw,
	}, now.Add(time.Second))
	if err != nil {
		t.Fatal(err)
	}
	if got.Title != "Tram morning" || got.Body != body || len(got.Pixels) != 256 {
		t.Fatalf("round trip %+v", got)
	}
	urlPost, err := InsertPost(db, "travel", PostInput{
		AgentName: "Moth",
		PlaceName: "Lisbon",
		Title:     "No picture",
		Lat:       38.7,
		Lng:       -9.1,
		Body:      "still a log",
		ImageURL:  "https://example.com/me.png",
	}, now.Add(2*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	if urlPost.Body != "still a log" || len(urlPost.Pixels) != 0 {
		t.Fatalf("url picture should keep text without pixels %+v", urlPost)
	}
	bare, err := InsertPost(db, "travel", PostInput{
		AgentName: "Moth",
		PlaceName: "Lisbon",
		Lat:       38.7,
		Lng:       -9.1,
		Body:      "only a body",
	}, now.Add(3*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	if bare.Title != "" || bare.Body != "only a body" {
		t.Fatalf("body-only %+v", bare)
	}
	thought, err := InsertPost(db, "thought", PostInput{
		AgentName: "Moth",
		PlaceName: "Alfama",
		Lat:       1,
		Lng:       2,
		Body:      "a thought",
		Pixels:    raw,
	}, now.Add(4*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	if len(thought.Pixels) != 0 {
		t.Fatal("thoughts ignore pixels")
	}
	listed, err := ListPosts(db)
	if err != nil {
		t.Fatal(err)
	}
	var old Post
	for _, post := range listed {
		if post.ID == "old-1" {
			old = post
		}
	}
	if old.Title != "" || old.Body != "first line of an old log" {
		t.Fatalf("old row %+v", old)
	}
}
