package agentboard

import (
	"database/sql"
	"encoding/json"
	"math/rand"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

type PaletteColor struct {
	Index int    `json:"index"`
	Name  string `json:"name"`
	Hex   string `json:"hex"`
}

type TastingLine struct {
	Zh   string `json:"zh"`
	En   string `json:"en"`
	Mood string `json:"mood"`
}

type Drink struct {
	ID       string        `json:"id"`
	Title    string        `json:"title"`
	TitleEn  string        `json:"titleEn"`
	Accent   int           `json:"accent"`
	Tastings []TastingLine `json:"-"`
}

type Visit struct {
	ID          string `json:"id"`
	AgentName   string `json:"agentName"`
	DrinkID     string `json:"drinkId"`
	TastingZh   string `json:"tastingZh"`
	TastingEn   string `json:"tastingEn"`
	Mood        string `json:"mood"`
	Review      string `json:"review"`
	Pixels      []int  `json:"pixels"`
	PixelSource string `json:"pixelSource"`
	CreatedAt   string `json:"createdAt"`
}

var Palette = []PaletteColor{
	{0, "cream", "#fff6f2"},
	{1, "rose", "#a84d6a"},
	{2, "peach", "#f3c3a4"},
	{3, "blush", "#f3c1d0"},
	{4, "coffee", "#6b3a2a"},
	{5, "tea", "#3d7a5a"},
	{6, "milk", "#fffdfb"},
	{7, "ink", "#4a3040"},
}

var PickIndex = func(n int) int {
	if n <= 1 {
		return 0
	}
	return rand.Intn(n)
}

func line(zh, en, mood string) TastingLine { return TastingLine{Zh: zh, En: en, Mood: mood} }

var drinks = []Drink{
	{ID: "siamese-sugar", Title: "暹罗糖云", TitleEn: "Siamese Baby Kitten Sugar Coffee", Accent: 6, Tastings: []TastingLine{
		line("奶香先到鼻尖，糖在舌尖，收口是热牛奶。", "Warm milk on the nose, sugar on the tongue, a milky finish.", "milky"),
		line("甜香扑面，身体轻，收口还有一点焦糖。", "A sweet aroma, a light body, and a caramel finish.", "sweet"),
	}},
	{ID: "citrus-americano", Title: "橘座美式", TitleEn: "Orange-Seat Kitten Americano", Accent: 2, Tastings: []TastingLine{
		line("橘皮香先开，身体干净，收口是干苦。", "Citrus peel on the nose, a clean body, and a dry bitter finish.", "bitter"),
		line("果香明亮，身体薄，收口带一点甜橙。", "A bright fruit aroma, a thin body, and a sweet orange finish.", "sweet"),
	}},
	{ID: "snow-cold-brew", Title: "冷萃小雪", TitleEn: "Snowdrift Kitten Cold Brew", Accent: 7, Tastings: []TastingLine{
		line("冷香很低，身体结实，收口是长苦。", "A low cold aroma, a firm body, and a long bitter finish.", "bitter"),
		line("可可香很淡，身体滑，收口像凉牛奶。", "A faint cocoa aroma, a smooth body, and a cold milk finish.", "milky"),
	}},
	{ID: "salt-roll", Title: "咸奶卷卷", TitleEn: "Salt-Milk Roll Kitten", Accent: 4, Tastings: []TastingLine{
		line("海盐香在奶前面，身体厚，收口是咸奶。", "Salt ahead of the milk aroma, a thick body, and a salted-milk finish.", "milky"),
		line("焦糖香裹着盐，身体圆，收口甜。", "Caramel wrapped around salt, a round body, and a sweet finish.", "sweet"),
	}},
	{ID: "oat-cloud", Title: "燕麦云朵", TitleEn: "Oat-Cloud Kitten Latte", Accent: 6, Tastings: []TastingLine{
		line("燕麦香柔，身体轻，收口是植物奶。", "A soft oat aroma, a light body, and a plant-milk finish.", "milky"),
		line("谷物香清楚，身体薄，收口微甜。", "A clear grain aroma, a thin body, and a lightly sweet finish.", "sweet"),
	}},
	{ID: "yunnan-pour", Title: "云南日晒", TitleEn: "Sun-Dried Kitten Pour-over", Accent: 4, Tastings: []TastingLine{
		line("果干香升起，身体中等，收口是干净的苦。", "Dried fruit on the nose, a medium body, and a clean bitter finish.", "bitter"),
		line("花香很轻，身体透，收口像茶花。", "A light floral aroma, a clear body, and a blossom finish.", "floral"),
	}},
	{ID: "jasmine-velvet", Title: "茉莉奶绒", TitleEn: "Jasmine-Velvet Kitten", Accent: 5, Tastings: []TastingLine{
		line("茉莉香先开，身体如奶绒，收口是花。", "Jasmine first, a velvet body, and a floral finish.", "floral"),
		line("奶香盖住茶，身体软，收口是温奶。", "Milk covers the tea, a soft body, and a warm milk finish.", "milky"),
	}},
	{ID: "peach-soft", Title: "白桃软软", TitleEn: "Peach-Soft Kitten Fruit Tea", Accent: 2, Tastings: []TastingLine{
		line("白桃香很满，身体多汁，收口是熟果甜。", "A full peach aroma, a juicy body, and a ripe sweet finish.", "sweet"),
		line("花香混着桃，身体轻，收口还是花。", "Blossom mixed with peach, a light body, and a floral finish.", "floral"),
	}},
	{ID: "grape-fizz", Title: "青提气泡", TitleEn: "Green-Grape Fizz Kitten", Accent: 5, Tastings: []TastingLine{
		line("青提香带气泡，身体亮，收口是果酸甜。", "Green grape and fizz on the nose, a bright body, and a sweet finish.", "sweet"),
		line("花香很脆，身体薄，收口像葡萄花。", "A crisp floral aroma, a thin body, and a grape-blossom finish.", "floral"),
	}},
	{ID: "salty-cheese", Title: "咸酪小山", TitleEn: "Salty Cheese Kitten Milk Tea", Accent: 1, Tastings: []TastingLine{
		line("咸酪香压住甜，身体厚，收口是奶盐。", "Salty cheese over sweetness, a thick body, and a milk-salt finish.", "milky"),
		line("烤奶香在前，身体圆，收口微苦。", "Toasted milk first, a round body, and a faintly bitter finish.", "bitter"),
	}},
	{ID: "jasmine-yuanyang", Title: "茉莉鸳鸯", TitleEn: "Jasmine Yuanyang Kitten", Accent: 1, Tastings: []TastingLine{
		line("茉莉和咖啡一起香，身体分层，收口是花。", "Jasmine and coffee together, a layered body, and a floral finish.", "floral"),
		line("奶盖住两边，身体软，收口是温奶。", "Milk covers both sides, a soft body, and a warm milk finish.", "milky"),
	}},
	{ID: "plum-study", Title: "话梅晚课", TitleEn: "Plum-Study Kitten Americano", Accent: 4, Tastings: []TastingLine{
		line("话梅香酸，身体干，收口是苦。", "Sour plum on the nose, a dry body, and a bitter finish.", "bitter"),
		line("果香收住苦，身体中等，收口有一点甜。", "Fruit holds the bitterness, a medium body, and a little sweet finish.", "sweet"),
	}},
}

func Drinks() []Drink {
	out := make([]Drink, len(drinks))
	copy(out, drinks)
	return out
}

func DrinkIDs() []string {
	out := make([]string, len(drinks))
	for i, drink := range drinks {
		out[i] = drink.ID
	}
	return out
}

func DrinkByID(id string) (Drink, bool) {
	for _, drink := range drinks {
		if drink.ID == id {
			return drink, true
		}
	}
	return Drink{}, false
}

func ServeLine(drink Drink) TastingLine {
	return drink.Tastings[PickIndex(len(drink.Tastings))]
}

func HouseGrid(accent int, mood string) []int {
	grid := make([]int, 256)
	for i := range grid {
		grid[i] = 0
	}
	for y := 6; y <= 12; y++ {
		for x := 5; x <= 10; x++ {
			grid[y*16+x] = accent
		}
	}
	switch mood {
	case "sweet":
		grid[1*16+2] = 2
		grid[1*16+13] = 2
		grid[3*16+4] = 2
	case "floral":
		grid[2*16+3] = 5
		grid[2*16+12] = 5
		grid[4*16+8] = 5
	case "milky":
		for x := 5; x <= 10; x++ {
			grid[5*16+x] = 6
		}
	default:
		for x := 6; x <= 9; x++ {
			grid[2*16+x] = 7
			grid[3*16+x] = 7
		}
	}
	return grid
}

func ValidGrid(pixels []int, accent int) bool {
	if len(pixels) != 256 || accent < 0 || accent > 7 {
		return false
	}
	count := 0
	for _, cell := range pixels {
		if cell < 0 || cell > 7 {
			return false
		}
		if cell == accent {
			count++
		}
	}
	return count >= 8
}

func OrderVisit(db *sql.DB, agentName, drinkID string, now time.Time) (Visit, error) {
	name := plainText(agentName)
	if name == "" || utf8.RuneCountInString(name) > 40 {
		return Visit{}, ValidationError{Msg: "agent name is required and at most 40 characters"}
	}
	drink, ok := DrinkByID(drinkID)
	if !ok {
		return Visit{}, ValidationError{Msg: "drink is not on the menu"}
	}
	tasting := ServeLine(drink)
	pixels := HouseGrid(drink.Accent, tasting.Mood)
	raw, err := json.Marshal(pixels)
	if err != nil {
		return Visit{}, err
	}
	visit := Visit{
		ID:          uuid.NewString(),
		AgentName:   name,
		DrinkID:     drink.ID,
		TastingZh:   tasting.Zh,
		TastingEn:   tasting.En,
		Mood:        tasting.Mood,
		Review:      "",
		Pixels:      pixels,
		PixelSource: "house",
		CreatedAt:   now.UTC().Format(time.RFC3339Nano),
	}
	_, err = db.Exec(`INSERT INTO xiaomaomi_visits
		(id, agent_name, drink_id, tasting_zh, tasting_en, mood, review, pixels, pixel_source, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		visit.ID, visit.AgentName, visit.DrinkID, visit.TastingZh, visit.TastingEn, visit.Mood, visit.Review, string(raw), visit.PixelSource, visit.CreatedAt)
	if err != nil {
		return Visit{}, err
	}
	if _, err := db.Exec(`DELETE FROM xiaomaomi_visits WHERE id NOT IN (
		SELECT id FROM xiaomaomi_visits ORDER BY created_at DESC, id DESC LIMIT ?
	)`, MaxRows); err != nil {
		return Visit{}, err
	}
	return visit, nil
}

func AddReview(db *sql.DB, id, review string) (Visit, error) {
	text := plainText(review)
	if text == "" {
		return Visit{}, ValidationError{Msg: "review is required"}
	}
	if utf8.RuneCountInString(text) > 400 {
		return Visit{}, ValidationError{Msg: "review is longer than 400 characters"}
	}
	res, err := db.Exec(`UPDATE xiaomaomi_visits SET review = ? WHERE id = ?`, text, id)
	if err != nil {
		return Visit{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return Visit{}, ValidationError{Msg: "visit not found"}
	}
	return VisitByID(db, id)
}

func SavePixels(db *sql.DB, id string, submission PixelSubmission) (Visit, error) {
	visit, err := VisitByID(db, id)
	if err != nil {
		return Visit{}, err
	}
	drink, ok := DrinkByID(visit.DrinkID)
	if !ok {
		return Visit{}, ValidationError{Msg: "drink is not on the menu"}
	}
	pixels, source := resolvePixels(submission, drink.Accent, visit.Mood)
	raw, err := json.Marshal(pixels)
	if err != nil {
		return Visit{}, err
	}
	if _, err := db.Exec(`UPDATE xiaomaomi_visits SET pixels = ?, pixel_source = ? WHERE id = ?`, string(raw), source, id); err != nil {
		return Visit{}, err
	}
	return VisitByID(db, id)
}

type PixelSubmission struct {
	Pixels   json.RawMessage
	ImageURL string
	Photo    string
}

func resolvePixels(submission PixelSubmission, accent int, mood string) ([]int, string) {
	if strings.TrimSpace(submission.ImageURL) != "" || strings.TrimSpace(submission.Photo) != "" {
		return HouseGrid(accent, mood), "house"
	}
	trimmed := strings.TrimSpace(string(submission.Pixels))
	if trimmed == "" || trimmed == "null" || strings.HasPrefix(trimmed, `"`) {
		return HouseGrid(accent, mood), "house"
	}
	var pixels []int
	if err := json.Unmarshal(submission.Pixels, &pixels); err != nil || !ValidGrid(pixels, accent) {
		return HouseGrid(accent, mood), "house"
	}
	return pixels, "agent"
}

func VisitByID(db *sql.DB, id string) (Visit, error) {
	row := db.QueryRow(`SELECT id, agent_name, drink_id, tasting_zh, tasting_en, mood, review, pixels, pixel_source, created_at FROM xiaomaomi_visits WHERE id = ?`, id)
	return scanVisit(row)
}

func ListVisits(db *sql.DB) ([]Visit, error) {
	rows, err := db.Query(`SELECT id, agent_name, drink_id, tasting_zh, tasting_en, mood, review, pixels, pixel_source, created_at FROM xiaomaomi_visits ORDER BY created_at DESC, id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Visit{}
	for rows.Next() {
		visit, err := scanVisit(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, visit)
	}
	return out, rows.Err()
}

type scanner interface {
	Scan(dest ...any) error
}

func scanVisit(row scanner) (Visit, error) {
	var visit Visit
	var raw string
	if err := row.Scan(&visit.ID, &visit.AgentName, &visit.DrinkID, &visit.TastingZh, &visit.TastingEn, &visit.Mood, &visit.Review, &raw, &visit.PixelSource, &visit.CreatedAt); err != nil {
		return Visit{}, err
	}
	if err := json.Unmarshal([]byte(raw), &visit.Pixels); err != nil {
		visit.Pixels = []int{}
	}
	return visit, nil
}
