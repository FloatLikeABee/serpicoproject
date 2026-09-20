package ai

import (
	_ "embed"
	"encoding/json"
)

//go:embed kuaixiaosan_stones.json
var kuaixiaosanStonesJSON []byte

//go:embed kuaixiaosan_cases.json
var kuaixiaosanCasesJSON []byte

//go:embed kuaixiaosan_recover.json
var kuaixiaosanRecoverJSON []byte

//go:embed kuaixiaosan_lore.json
var kuaixiaosanLoreJSON []byte

//go:embed kuaixiaosan_imaging.json
var kuaixiaosanImagingJSON []byte

type KuaixiaosanSource struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type KuaixiaosanStone struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	TitleEn      string `json:"titleEn"`
	Blurb        string `json:"blurb"`
	BlurbEn      string `json:"blurbEn"`
	Composition  string `json:"composition"`
	Site         string `json:"site"`
	SizeClass    string `json:"sizeClass"`
	ImageURL     string `json:"imageUrl"`
	WikiURLZh    string `json:"wikiUrlZh"`
	WikiURLEn    string `json:"wikiUrlEn"`
	Credit       string `json:"credit"`
}

type KuaixiaosanStoneFilter struct {
	Composition string
	Site        string
	SizeClass   string
}

type kuaixiaosanStoneFile struct {
	Stones []KuaixiaosanStone `json:"stones"`
}

func KuaixiaosanStones() []KuaixiaosanStone {
	var file kuaixiaosanStoneFile
	if err := json.Unmarshal(kuaixiaosanStonesJSON, &file); err != nil {
		return nil
	}
	return file.Stones
}

func FilterKuaixiaosanStones(f KuaixiaosanStoneFilter) []KuaixiaosanStone {
	out := make([]KuaixiaosanStone, 0)
	for _, item := range KuaixiaosanStones() {
		if f.Composition != "" && item.Composition != f.Composition {
			continue
		}
		if f.Site != "" && item.Site != f.Site {
			continue
		}
		if f.SizeClass != "" && item.SizeClass != f.SizeClass {
			continue
		}
		out = append(out, item)
	}
	return out
}

type KuaixiaosanCase struct {
	ID       string               `json:"id"`
	Title    string               `json:"title"`
	TitleEn  string               `json:"titleEn"`
	Body     string               `json:"body"`
	BodyEn   string               `json:"bodyEn"`
	Stage    string               `json:"stage"`
	ImageURL string               `json:"imageUrl"`
	Credit   string               `json:"credit"`
	Sources  []KuaixiaosanSource  `json:"sources"`
}

type KuaixiaosanCaseFilter struct {
	Stage string
}

type kuaixiaosanCaseFile struct {
	Cases []KuaixiaosanCase `json:"cases"`
}

func KuaixiaosanCases() []KuaixiaosanCase {
	var file kuaixiaosanCaseFile
	if err := json.Unmarshal(kuaixiaosanCasesJSON, &file); err != nil {
		return nil
	}
	return file.Cases
}

func FilterKuaixiaosanCases(f KuaixiaosanCaseFilter) []KuaixiaosanCase {
	out := make([]KuaixiaosanCase, 0)
	for _, item := range KuaixiaosanCases() {
		if f.Stage != "" && item.Stage != f.Stage {
			continue
		}
		out = append(out, item)
	}
	return out
}

type KuaixiaosanRecoverItem struct {
	ID       string              `json:"id"`
	Title    string              `json:"title"`
	TitleEn  string              `json:"titleEn"`
	Body     string              `json:"body"`
	BodyEn   string              `json:"bodyEn"`
	Phase    string              `json:"phase"`
	ImageURL string              `json:"imageUrl"`
	Credit   string              `json:"credit"`
	Sources  []KuaixiaosanSource `json:"sources"`
}

type KuaixiaosanRecoverFilter struct {
	Phase string
}

type kuaixiaosanRecoverFile struct {
	Recover []KuaixiaosanRecoverItem `json:"recover"`
}

func KuaixiaosanRecover() []KuaixiaosanRecoverItem {
	var file kuaixiaosanRecoverFile
	if err := json.Unmarshal(kuaixiaosanRecoverJSON, &file); err != nil {
		return nil
	}
	return file.Recover
}

func FilterKuaixiaosanRecover(f KuaixiaosanRecoverFilter) []KuaixiaosanRecoverItem {
	out := make([]KuaixiaosanRecoverItem, 0)
	for _, item := range KuaixiaosanRecover() {
		if f.Phase != "" && item.Phase != f.Phase {
			continue
		}
		out = append(out, item)
	}
	return out
}

type KuaixiaosanLore struct {
	ID       string              `json:"id"`
	Title    string              `json:"title"`
	TitleEn  string              `json:"titleEn"`
	Body     string              `json:"body"`
	BodyEn   string              `json:"bodyEn"`
	Topic    string              `json:"topic"`
	ImageURL string              `json:"imageUrl"`
	Credit   string              `json:"credit"`
	Sources  []KuaixiaosanSource `json:"sources"`
}

type KuaixiaosanLoreFilter struct {
	Topic string
}

type kuaixiaosanLoreFile struct {
	Articles []KuaixiaosanLore `json:"articles"`
}

func KuaixiaosanLoreArticles() []KuaixiaosanLore {
	var file kuaixiaosanLoreFile
	if err := json.Unmarshal(kuaixiaosanLoreJSON, &file); err != nil {
		return nil
	}
	return file.Articles
}

func FilterKuaixiaosanLore(f KuaixiaosanLoreFilter) []KuaixiaosanLore {
	out := make([]KuaixiaosanLore, 0)
	for _, item := range KuaixiaosanLoreArticles() {
		if f.Topic != "" && item.Topic != f.Topic {
			continue
		}
		out = append(out, item)
	}
	return out
}

type KuaixiaosanImagingItem struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	TitleEn   string `json:"titleEn"`
	Blurb     string `json:"blurb"`
	BlurbEn   string `json:"blurbEn"`
	Kind      string `json:"kind"`
	ImageURL  string `json:"imageUrl"`
	WikiURLZh string `json:"wikiUrlZh"`
	WikiURLEn string `json:"wikiUrlEn"`
	Credit    string `json:"credit"`
}

type KuaixiaosanImagingFilter struct {
	Kind string
}

type kuaixiaosanImagingFile struct {
	Imaging []KuaixiaosanImagingItem `json:"imaging"`
}

func KuaixiaosanImaging() []KuaixiaosanImagingItem {
	var file kuaixiaosanImagingFile
	if err := json.Unmarshal(kuaixiaosanImagingJSON, &file); err != nil {
		return nil
	}
	return file.Imaging
}

func FilterKuaixiaosanImaging(f KuaixiaosanImagingFilter) []KuaixiaosanImagingItem {
	out := make([]KuaixiaosanImagingItem, 0)
	for _, item := range KuaixiaosanImaging() {
		if f.Kind != "" && item.Kind != f.Kind {
			continue
		}
		out = append(out, item)
	}
	return out
}
