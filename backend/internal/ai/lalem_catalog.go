package ai

import (
	_ "embed"
	"encoding/json"
	"path/filepath"
	"strings"
)

//go:embed lalem_toilets.json
var lalemToiletsJSON []byte

//go:embed lalem_papers.json
var lalemPapersJSON []byte

//go:embed lalem_medicine.json
var lalemMedicineJSON []byte

type LalemToilet struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	TitleEn   string `json:"titleEn"`
	Blurb     string `json:"blurb"`
	BlurbEn   string `json:"blurbEn"`
	Shape     string `json:"shape"`
	Size      string `json:"size"`
	Class     string `json:"class"`
	Era       string `json:"era"`
	Region    string `json:"region"`
	ImageURL  string `json:"imageUrl"`
	WikiURLZh string `json:"wikiUrlZh"`
	WikiURLEn string `json:"wikiUrlEn"`
	Credit    string `json:"credit"`
}

type LalemToiletFilter struct {
	Shape string
	Size  string
	Class string
	Era   string
}

type lalemToiletFile struct {
	Toilets []LalemToilet `json:"toilets"`
}

func LalemToilets() []LalemToilet {
	var file lalemToiletFile
	if err := json.Unmarshal(lalemToiletsJSON, &file); err != nil {
		return nil
	}
	return file.Toilets
}

func FilterLalemToilets(f LalemToiletFilter) []LalemToilet {
	out := make([]LalemToilet, 0)
	for _, item := range LalemToilets() {
		if f.Shape != "" && item.Shape != f.Shape {
			continue
		}
		if f.Size != "" && item.Size != f.Size {
			continue
		}
		if f.Class != "" && item.Class != f.Class {
			continue
		}
		if f.Era != "" && item.Era != f.Era {
			continue
		}
		out = append(out, item)
	}
	return out
}

func lalemLocale(locale string) string {
	if strings.EqualFold(strings.TrimSpace(locale), "cn") || strings.EqualFold(strings.TrimSpace(locale), "zh") {
		return "cn"
	}
	return "en"
}

type LalemPaper struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	TitleEn   string `json:"titleEn"`
	Blurb     string `json:"blurb"`
	BlurbEn   string `json:"blurbEn"`
	Era       string `json:"era"`
	ImageURL  string `json:"imageUrl"`
	WikiURLZh string `json:"wikiUrlZh"`
	WikiURLEn string `json:"wikiUrlEn"`
	Credit    string `json:"credit"`
}

type lalemPaperFile struct {
	Papers []LalemPaper `json:"papers"`
}

func LalemPapers() []LalemPaper {
	var file lalemPaperFile
	if err := json.Unmarshal(lalemPapersJSON, &file); err != nil {
		return nil
	}
	return file.Papers
}

type LalemMedicineSource struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type LalemMedicine struct {
	ID       string                `json:"id"`
	Title    string                `json:"title"`
	TitleEn  string                `json:"titleEn"`
	Body     string                `json:"body"`
	BodyEn   string                `json:"bodyEn"`
	ImageURL string                `json:"imageUrl"`
	Credit   string                `json:"credit"`
	Sources  []LalemMedicineSource `json:"sources"`
}

type lalemMedicineFile struct {
	Articles []LalemMedicine `json:"articles"`
}

func LalemMedicineArticles() []LalemMedicine {
	var file lalemMedicineFile
	if err := json.Unmarshal(lalemMedicineJSON, &file); err != nil {
		return nil
	}
	return file.Articles
}

type LalemVideo struct {
	Title     string `json:"title"`
	TitleEn   string `json:"titleEn"`
	PosterURL string `json:"posterUrl"`
	SrcURL    string `json:"srcUrl"`
}

func LalemCuratedVideos() []LalemVideo {
	return []LalemVideo{
		{Title: "娱乐热片", TitleEn: "Entertainment clip", PosterURL: "/lalem/videos/hot-ent.jpg", SrcURL: "/lalem/videos/hot-ent.mp4"},
		{Title: "时尚热片", TitleEn: "Fashion clip", PosterURL: "/lalem/videos/hot-fashion.jpg", SrcURL: "/lalem/videos/hot-fashion.mp4"},
	}
}

func LalemTrendImagePool() []string {
	return []string{
		"/lalem/trends/entertainment-1.jpg",
		"/lalem/trends/entertainment-2.jpg",
		"/lalem/trends/entertainment-3.jpg",
		"/lalem/trends/fashion-1.jpg",
		"/lalem/trends/fashion-2.jpg",
		"/lalem/trends/fashion-3.jpg",
	}
}

func RewriteLalemTrendImage(url string) string {
	pool := LalemTrendImagePool()
	fallback := "/lalem/trends/entertainment-1.jpg"
	if len(pool) > 0 {
		fallback = pool[0]
	}
	u := strings.TrimSpace(url)
	if u == "" || strings.Contains(u, "://") || strings.HasPrefix(u, "http") {
		return fallback
	}
	if !strings.HasPrefix(u, "/lalem/trends/") {
		return fallback
	}
	base := filepath.Base(u)
	ext := filepath.Ext(base)
	stem := strings.TrimSuffix(base, ext)
	if stem == "" || stem == "." || strings.Contains(stem, "..") {
		return fallback
	}
	return "/lalem/trends/" + stem + ".jpg"
}

func LalemPublicRoot() string {
	return filepath.Join("..", "..", "..", "frontend", "public")
}
