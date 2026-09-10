package ai

import (
	"fmt"
	"strings"
	"time"
)

type FridgeRaidAdviseInput struct {
	Locale    string
	Leftovers string
	Plan      string
	Image     []byte
	ImageMIME string
	Lat       *float64
	Lon       *float64
}

type FridgeRaidDetailInput struct {
	Locale     string
	Suggestion FridgeRaidSuggestion
	Season     SeasonInfo
	Weather    *WeatherSnapshot
}

type FridgeRaidAdvisor struct {
	Now        time.Time
	WeatherFn  func(lat, lon float64) (*WeatherSnapshot, error)
	VisionFn   func(image []byte, mime string) (string, error)
	CompleteFn func(prompt string) (string, error)
}

func (a *FridgeRaidAdvisor) AdviseFridgeRaid(in FridgeRaidAdviseInput) (*FridgeRaidCards, error) {
	return a.Advise(in)
}

func (a *FridgeRaidAdvisor) now() time.Time {
	if a != nil && !a.Now.IsZero() {
		return a.Now
	}
	return time.Now().UTC()
}

func (a *FridgeRaidAdvisor) Advise(in FridgeRaidAdviseInput) (*FridgeRaidCards, error) {
	locale := normalizeFridgeLocale(in.Locale)
	season := SeasonForDate(a.now(), in.Lat)
	var weather *WeatherSnapshot
	if in.Lat != nil && in.Lon != nil && a != nil && a.WeatherFn != nil {
		w, err := a.WeatherFn(*in.Lat, *in.Lon)
		if err != nil || w == nil {
			weather = &WeatherSnapshot{Unavailable: true}
		} else {
			weather = w
		}
	}

	leftovers := strings.TrimSpace(in.Leftovers)
	var seen []string
	if len(in.Image) > 0 {
		if a == nil || a.VisionFn == nil {
			if leftovers == "" {
				return askFridgeRaidCards(locale, season, weather), nil
			}
		} else {
			list, err := a.VisionFn(in.Image, in.ImageMIME)
			list = strings.TrimSpace(list)
			if err != nil || list == "" || strings.EqualFold(list, "UNKNOWN") {
				if leftovers == "" {
					return askFridgeRaidCards(locale, season, weather), nil
				}
			} else {
				seen = splitIngredients(list)
				if leftovers == "" {
					leftovers = list
				}
			}
		}
	}

	if leftovers == "" && a != nil && a.CompleteFn != nil && strings.TrimSpace(in.Plan) != "" {
		// Plan without fridge: still ask to raid, do not invent inventory.
		cards := askFridgeRaidCards(locale, season, weather)
		if locale == "cn" {
			cards.Nudge = "想做什么都可以，先翻一下冰箱里有什么？打字或拍一张即可。"
		} else {
			cards.Nudge = "Love that plan — raid the fridge first? Type what’s in there or send a photo."
		}
		return cards, nil
	}

	if leftovers == "" {
		return askFridgeRaidCards(locale, season, weather), nil
	}

	if a == nil || a.CompleteFn == nil {
		return askFridgeRaidCards(locale, season, weather), nil
	}

	prompt := BuildFridgeRaidPrompt(FridgeRaidPromptInput{
		Locale:        locale,
		Leftovers:     leftovers,
		Plan:          in.Plan,
		Season:        season,
		Weather:       weather,
		SeenFromPhoto: seen,
	})
	raw, err := a.CompleteFn(prompt)
	if err != nil {
		return askFridgeRaidCards(locale, season, weather), nil
	}
	cards, err := ParseFridgeRaidCards(raw)
	if err != nil {
		return nil, err
	}
	cards.Locale = locale
	if cards.Disclaimer == "" {
		cards.Disclaimer = fridgeDisclaimer(locale)
	}
	if cards.Season == "" {
		cards.Season = season.Name
	}
	if cards.SolarTerm == "" {
		cards.SolarTerm = season.SolarTerm
	}
	if weather != nil {
		if weather.Unavailable {
			cards.WeatherUnavailable = true
		} else if cards.Weather == nil {
			cards.Weather = &FridgeRaidWeather{Label: weather.Label, TempC: weather.TempC}
		}
	}
	if len(cards.IngredientsSeen) == 0 && len(seen) > 0 {
		cards.IngredientsSeen = seen
	}
	return cards, nil
}

func askFridgeRaidCards(locale string, season SeasonInfo, weather *WeatherSnapshot) *FridgeRaidCards {
	nudge := "Raid the fridge — type leftovers or send a photo of what’s inside."
	if locale == "cn" {
		nudge = "先翻冰箱：打字告诉我剩菜，或拍一张冰箱内部。"
	}
	cards := &FridgeRaidCards{
		Season:        season.Name,
		SolarTerm:     season.SolarTerm,
		AskFridgeRaid: true,
		Nudge:         nudge,
		Disclaimer:    fridgeDisclaimer(locale),
		Locale:        locale,
	}
	if weather != nil {
		if weather.Unavailable {
			cards.WeatherUnavailable = true
		} else {
			cards.Weather = &FridgeRaidWeather{Label: weather.Label, TempC: weather.TempC}
		}
	}
	return cards
}

func splitIngredients(list string) []string {
	parts := strings.Split(list, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func (a *FridgeRaidAdvisor) AdviseFridgeRaidDetail(in FridgeRaidDetailInput) (*FridgeRaidDishDetail, error) {
	if a == nil || a.CompleteFn == nil {
		return nil, fmt.Errorf("live model is not configured (set SILICONFLOW_API_KEY)")
	}
	locale := normalizeFridgeLocale(in.Locale)
	prompt := BuildFridgeRaidDetailPrompt(FridgeRaidDetailPromptInput{
		Locale:     locale,
		Suggestion: in.Suggestion,
		Season:     in.Season,
		Weather:    in.Weather,
	})
	raw, err := a.CompleteFn(prompt)
	if err != nil {
		return nil, err
	}
	detail, err := ParseFridgeRaidDetail(raw)
	if err != nil {
		return nil, err
	}
	detail.Locale = locale
	if detail.Disclaimer == "" {
		detail.Disclaimer = fridgeDisclaimer(locale)
	}
	if detail.Title == "" {
		detail.Title = in.Suggestion.Title
	}
	return detail, nil
}
