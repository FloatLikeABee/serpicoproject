package ai

import (
	"strings"
	"testing"
)

func TestShuilemeBedsCatalogFloorsAndFilters(t *testing.T) {
	all := ShuilemeBeds()
	if len(all) < 8 {
		t.Fatalf("beds=%d want >=8", len(all))
	}
	seen := map[string]struct{}{}
	sizes := map[string]int{}
	fills := map[string]int{}
	eras := map[string]int{}
	for _, item := range all {
		if item.ID == "" || strings.Contains(item.ID, "_") || item.ID != strings.ToLower(item.ID) {
			t.Fatalf("id must be kebab-case: %q", item.ID)
		}
		if _, dup := seen[item.ID]; dup {
			t.Fatalf("duplicate id %s", item.ID)
		}
		seen[item.ID] = struct{}{}
		if strings.TrimSpace(item.Title) == "" || strings.TrimSpace(item.TitleEn) == "" {
			t.Fatalf("missing title %+v", item)
		}
		if strings.TrimSpace(item.Blurb) == "" || strings.TrimSpace(item.BlurbEn) == "" {
			t.Fatalf("missing blurb %s", item.ID)
		}
		if strings.TrimSpace(item.Credit) == "" {
			t.Fatalf("missing credit %s", item.ID)
		}
		if strings.HasPrefix(item.ImageURL, "http") || strings.Contains(item.ImageURL, "://") {
			t.Fatalf("hotlink image %s", item.ImageURL)
		}
		if !strings.HasPrefix(item.ImageURL, "/shuileme/beds/") || !strings.HasSuffix(item.ImageURL, ".jpg") {
			t.Fatalf("image must be local jpg pack: %s", item.ImageURL)
		}
		assertLalemWikiURL(t, item.WikiURLZh, "zh.wikipedia.org")
		assertLalemWikiURL(t, item.WikiURLEn, "en.wikipedia.org")
		sizes[item.Size]++
		fills[item.Fill]++
		eras[item.Era]++
	}
	for _, size := range []string{"single", "double", "king", "kang-width"} {
		if sizes[size] == 0 {
			t.Fatalf("missing size %s", size)
		}
	}
	for _, fill := range []string{"spring", "foam", "futon", "kang", "hammock", "water", "capsule", "platform"} {
		if fills[fill] == 0 {
			t.Fatalf("missing fill %s", fill)
		}
	}
	for _, era := range []string{"ancient", "tang", "edo", "victorian", "modern", "space"} {
		if eras[era] == 0 {
			t.Fatalf("missing era %s", era)
		}
	}
	kang := FilterShuilemeBeds(ShuilemeBedFilter{Fill: "kang"})
	if len(kang) == 0 {
		t.Fatal("expected kang matches")
	}
	for _, item := range kang {
		if item.Fill != "kang" {
			t.Fatalf("fill filter leaked %s", item.Fill)
		}
	}
}

func TestShuilemeRoomsCatalogFloorsAndFilters(t *testing.T) {
	all := ShuilemeRooms()
	if len(all) < 8 {
		t.Fatalf("rooms=%d want >=8", len(all))
	}
	seen := map[string]struct{}{}
	lights := map[string]int{}
	layouts := map[string]int{}
	for _, item := range all {
		if _, dup := seen[item.ID]; dup {
			t.Fatalf("duplicate room %s", item.ID)
		}
		seen[item.ID] = struct{}{}
		if !strings.HasPrefix(item.ImageURL, "/shuileme/rooms/") || !strings.HasSuffix(item.ImageURL, ".jpg") {
			t.Fatalf("room image %s", item.ImageURL)
		}
		if strings.Contains(item.ImageURL, "://") {
			t.Fatalf("hotlink %s", item.ImageURL)
		}
		assertLalemWikiURL(t, item.WikiURLZh, "zh.wikipedia.org")
		assertLalemWikiURL(t, item.WikiURLEn, "en.wikipedia.org")
		lights[item.Light]++
		layouts[item.Layout]++
	}
	for _, light := range []string{"blackout", "dim", "nightlight", "day-shutters", "moon"} {
		if lights[light] == 0 {
			t.Fatalf("missing light %s", light)
		}
	}
	for _, layout := range []string{"alcove", "open", "capsule", "sleeper", "kang-room", "washitsu", "tent", "chamber"} {
		if layouts[layout] == 0 {
			t.Fatalf("missing layout %s", layout)
		}
	}
	blackout := FilterShuilemeRooms(ShuilemeRoomFilter{Light: "blackout"})
	if len(blackout) == 0 {
		t.Fatal("expected blackout rooms")
	}
	for _, item := range blackout {
		if item.Light != "blackout" {
			t.Fatalf("light filter leaked %s", item.Light)
		}
	}
}

func TestShuilemeLoreCatalogIsSourcedEncyclopedia(t *testing.T) {
	articles := ShuilemeLoreArticles()
	if len(articles) < 16 {
		t.Fatalf("articles=%d want >=16", len(articles))
	}
	seen := map[string]struct{}{}
	for _, item := range articles {
		if item.ID == "" || strings.Contains(item.ID, "_") || item.ID != strings.ToLower(item.ID) {
			t.Fatalf("id must be kebab-case: %q", item.ID)
		}
		if _, dup := seen[item.ID]; dup {
			t.Fatalf("duplicate id %s", item.ID)
		}
		seen[item.ID] = struct{}{}
		if strings.Count(item.Body, "。") < 2 || strings.Count(item.BodyEn, ".") < 2 {
			t.Fatalf("body too short %s", item.ID)
		}
		low := strings.ToLower(item.Body + item.BodyEn)
		if strings.Contains(low, "you have") || strings.Contains(item.Body, "你患有") {
			t.Fatalf("diagnoses visitor %s", item.ID)
		}
		if strings.Contains(low, "take this") || strings.Contains(item.Body, "请服用") {
			t.Fatalf("prescribes %s", item.ID)
		}
		hasWiki, hasOrg := false, false
		for _, src := range item.Sources {
			if lalemWikiHostOK(src.URL, "zh.wikipedia.org") || lalemWikiHostOK(src.URL, "en.wikipedia.org") {
				hasWiki = true
			}
			if lalemOrgHostOK(src.URL) {
				hasOrg = true
			}
		}
		if !hasWiki || !hasOrg {
			t.Fatalf("sources wiki=%v org=%v for %s", hasWiki, hasOrg, item.ID)
		}
		want := "/shuileme/lore/" + item.ID + ".jpg"
		if item.ImageURL != want {
			t.Fatalf("imageUrl %s want %s", item.ImageURL, want)
		}
	}
}

func TestShuilemeCatalogJPEGsAreDistinctLocalFiles(t *testing.T) {
	hashes := map[string]string{}
	check := func(imageURL, prefix string) {
		t.Helper()
		raw := assertLalemLocalJPEG(t, imageURL, prefix)
		sum := sha256Hex(raw)
		if prev, ok := hashes[sum]; ok {
			t.Fatalf("duplicate photo %s and %s", prev, imageURL)
		}
		hashes[sum] = imageURL
	}
	for _, item := range ShuilemeBeds() {
		check(item.ImageURL, "/shuileme/beds/")
	}
	for _, item := range ShuilemeRooms() {
		check(item.ImageURL, "/shuileme/rooms/")
	}
	for _, item := range ShuilemeLoreArticles() {
		check(item.ImageURL, "/shuileme/lore/")
	}
	if len(hashes) < 8+8+16 {
		t.Fatalf("distinct photos=%d", len(hashes))
	}
}
