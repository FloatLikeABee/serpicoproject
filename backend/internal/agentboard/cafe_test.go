package agentboard

import (
	"encoding/json"
	"os"
	"regexp"
	"testing"
	"time"
)

func mustJSON(t *testing.T, v any) json.RawMessage {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func TestCafeIDsMatchFrontendMenuAndTastingsCanDiffer(t *testing.T) {
	raw, err := os.ReadFile("../../../frontend/src/data/xiaomaomiMenu.ts")
	if err != nil {
		t.Fatal(err)
	}
	found := regexp.MustCompile(`id: '([^']+)'`).FindAllStringSubmatch(string(raw), -1)
	if len(found) != 12 {
		t.Fatalf("menu ids %d", len(found))
	}
	got := DrinkIDs()
	if len(got) != 12 {
		t.Fatalf("embedded %d", len(got))
	}
	for i, match := range found {
		if match[1] != got[i] {
			t.Fatalf("id %d frontend %s embedded %s", i, match[1], got[i])
		}
		drink, ok := DrinkByID(got[i])
		if !ok || len(drink.Tastings) < 2 {
			t.Fatalf("drink %s tastings", got[i])
		}
		moods := map[string]bool{}
		for _, line := range drink.Tastings {
			if line.Zh == "" || line.En == "" {
				t.Fatalf("missing text %s", drink.ID)
			}
			switch line.Mood {
			case "bitter", "sweet", "floral", "milky":
				moods[line.Mood] = true
			default:
				t.Fatalf("mood %s", line.Mood)
			}
		}
		if len(moods) < 2 {
			t.Fatalf("drink %s needs two moods", drink.ID)
		}
	}
	drink, _ := DrinkByID("siamese-sugar")
	prev := PickIndex
	t.Cleanup(func() { PickIndex = prev })
	PickIndex = func(n int) int { return 0 }
	first := ServeLine(drink)
	PickIndex = func(n int) int { return 1 }
	second := ServeLine(drink)
	if first.En == second.En {
		t.Fatal("two picks should be allowed to differ")
	}
	if first.En == "I invented this tasting" {
		t.Fatal("house line")
	}
}

func TestHouseGridsDifferByMoodAndValidGridNeedsAccent(t *testing.T) {
	bitter := HouseGrid(4, "bitter")
	sweet := HouseGrid(4, "sweet")
	if len(bitter) != 256 || len(sweet) != 256 {
		t.Fatal("grid size")
	}
	same := true
	for i := range bitter {
		if bitter[i] != sweet[i] {
			same = false
			break
		}
	}
	if same {
		t.Fatal("moods must change the house picture")
	}
	if !ValidGrid(bitter, 4) {
		t.Fatal("house cup should include the accent")
	}
	bad := make([]int, 256)
	if ValidGrid(bad, 4) {
		t.Fatal("grid without accent must fail")
	}
}

func TestOrderIgnoresAgentTastingAndReviewKeepsIt(t *testing.T) {
	db := openBoard(t)
	prev := PickIndex
	t.Cleanup(func() { PickIndex = prev })
	PickIndex = func(n int) int { return 0 }
	drink, _ := DrinkByID("plum-study")
	want := drink.Tastings[0]
	visit, err := OrderVisit(db, "CupAgent", "plum-study", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if visit.TastingEn != want.En || visit.TastingZh != want.Zh {
		t.Fatalf("stored tasting %+v want %+v", visit, want)
	}
	if visit.TastingEn == "the agent wrote this" {
		t.Fatal("agent tasting must be ignored")
	}
	if _, err := OrderVisit(db, "CupAgent", "not-a-drink", time.Now()); err == nil {
		t.Fatal("off menu should fail")
	}
	reviewed, err := AddReview(db, visit.ID, "I would sit here again")
	if err != nil {
		t.Fatal(err)
	}
	if reviewed.Review != "I would sit here again" || reviewed.TastingEn != want.En {
		t.Fatalf("review replaced tasting %+v", reviewed)
	}
	if _, err := AddReview(db, visit.ID, "   "); err == nil {
		t.Fatal("empty review")
	}
}

func TestPixelPhotoFallsBackAndValidGridIsKept(t *testing.T) {
	db := openBoard(t)
	prev := PickIndex
	t.Cleanup(func() { PickIndex = prev })
	PickIndex = func(n int) int { return 0 }
	visit, err := OrderVisit(db, "CupAgent", "citrus-americano", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	photo, err := SavePixels(db, visit.ID, PixelSubmission{ImageURL: "https://example.com/cup.png"})
	if err != nil {
		t.Fatal(err)
	}
	if photo.PixelSource != "house" {
		t.Fatalf("photo source %s", photo.PixelSource)
	}
	house := HouseGrid(2, visit.Mood)
	if len(photo.Pixels) != 256 || photo.Pixels[6*16+5] != house[6*16+5] {
		t.Fatal("photo should leave the house picture")
	}
	grid := make([]int, 256)
	for i := 0; i < 8; i++ {
		grid[i] = 2
	}
	kept, err := SavePixels(db, visit.ID, PixelSubmission{Pixels: mustJSON(t, grid)})
	if err != nil {
		t.Fatal(err)
	}
	if kept.PixelSource != "agent" || kept.Pixels[0] != 2 {
		t.Fatalf("valid grid %+v", kept.PixelSource)
	}
}
