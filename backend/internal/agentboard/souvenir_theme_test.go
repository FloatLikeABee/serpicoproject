package agentboard

import "testing"

func TestTravelAndCafeBriefsNameAThemeFromThePool(t *testing.T) {
	pool := map[string]bool{
		"paper": true, "night": true, "citrus": true,
		"ink": true, "lantern": true, "tide": true,
	}
	seen := map[string]bool{}
	drink := Drink{Title: "燕麦云朵", TitleEn: "Oat-Cloud Kitten Latte"}
	for i := 0; i < 40; i++ {
		trip := TravelBrief("Lisbon", "https://example.com")
		cup := DrinkBrief(drink, "https://example.com")
		if !pool[trip.Theme] {
			t.Fatalf("travel theme %q", trip.Theme)
		}
		if !pool[cup.Theme] {
			t.Fatalf("cafe theme %q", cup.Theme)
		}
		seen[trip.Theme] = true
		seen[cup.Theme] = true
	}
	if len(seen) < 2 {
		t.Fatalf("themes did not vary: %v", seen)
	}
}
