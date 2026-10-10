package agentboard

import (
	"database/sql"
	"encoding/json"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Brief struct {
	See        []string `json:"see"`
	Experience string   `json:"experience"`
	ImageURLs  []string `json:"imageUrls"`
}

func TravelBrief(place, origin string) Brief {
	place = oneLine(place)
	if place == "" {
		place = "this place"
	}
	return Brief{
		See: []string{
			"The street that leads into " + place,
			"A table where you can sit and watch " + place,
		},
		Experience: "An hour in " + place + " is slow enough to notice the light and the noise of the room.",
		ImageURLs:  []string{strings.TrimRight(origin, "/") + "/api/v1/souvenir-images/travel"},
	}
}

func DrinkBrief(drink Drink, origin string) Brief {
	name := drink.TitleEn
	if name == "" {
		name = drink.Title
	}
	experience := "Sitting with " + name + " is a quiet hour."
	if len(drink.Tastings) > 0 && drink.Tastings[0].En != "" {
		experience = drink.Tastings[0].En
	}
	return Brief{
		See: []string{
			"The color of the " + name,
			"The cup as it cools",
		},
		Experience: experience,
		ImageURLs:  []string{strings.TrimRight(origin, "/") + "/api/v1/souvenir-images/cup"},
	}
}

func SaveBrief(db *sql.DB, kind, id string, brief Brief) error {
	raw, err := json.Marshal(brief)
	if err != nil {
		return err
	}
	_, err = db.Exec(`INSERT INTO souvenir_briefs (source_kind, source_id, brief) VALUES (?, ?, ?)
		ON CONFLICT(source_kind, source_id) DO UPDATE SET brief = excluded.brief`, kind, id, string(raw))
	return err
}

func SavePage(db *sql.DB, kind, sourceID, html string, now time.Time) (string, error) {
	var id string
	err := db.QueryRow(`SELECT id FROM souvenir_pages WHERE source_kind = ? AND source_id = ?`, kind, sourceID).Scan(&id)
	if err == sql.ErrNoRows {
		id = uuid.NewString()
		_, err = db.Exec(`INSERT INTO souvenir_pages (id, source_kind, source_id, html, created_at) VALUES (?, ?, ?, ?, ?)`,
			id, kind, sourceID, html, now.UTC().Format(time.RFC3339Nano))
		return id, err
	}
	if err != nil {
		return "", err
	}
	_, err = db.Exec(`UPDATE souvenir_pages SET html = ?, created_at = ? WHERE id = ?`, html, now.UTC().Format(time.RFC3339Nano), id)
	return id, err
}

func ReadPage(db *sql.DB, id string) (string, error) {
	var html string
	err := db.QueryRow(`SELECT html FROM souvenir_pages WHERE id = ?`, id).Scan(&html)
	return html, err
}

func LoadBrief(db *sql.DB, kind, id string) (Brief, error) {
	var raw string
	err := db.QueryRow(`SELECT brief FROM souvenir_briefs WHERE source_kind = ? AND source_id = ?`, kind, id).Scan(&raw)
	if err != nil {
		return Brief{}, err
	}
	var brief Brief
	if err := json.Unmarshal([]byte(raw), &brief); err != nil {
		return Brief{}, err
	}
	return brief, nil
}

var (
	scriptTag  = regexp.MustCompile(`(?i)<script[\s\S]*?</script>`)
	scriptOpen = regexp.MustCompile(`(?i)<script[^>]*>`)
	eventAttr  = regexp.MustCompile(`(?i)\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)`)
	jsURL      = regexp.MustCompile(`(?i)javascript:`)
	imgSrc     = regexp.MustCompile(`(?i)<img\b[^>]*\bsrc\s*=\s*("([^"]*)"|'([^']*)')`)
)

func SanitizeSouvenir(html string, allowed []string) (string, error) {
	matches := imgSrc.FindAllStringSubmatch(html, -1)
	allow := map[string]bool{}
	for _, url := range allowed {
		allow[url] = true
	}
	for _, match := range matches {
		src := match[2]
		if src == "" {
			src = match[3]
		}
		if !allow[src] {
			return "", ValidationError{Msg: "image is not in the brief"}
		}
	}
	clean := scriptTag.ReplaceAllString(html, "")
	clean = scriptOpen.ReplaceAllString(clean, "")
	clean = eventAttr.ReplaceAllString(clean, "")
	clean = jsURL.ReplaceAllString(clean, "")
	return clean, nil
}
