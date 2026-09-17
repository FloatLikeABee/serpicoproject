package ai

import (
	_ "embed"
	"encoding/json"
)

//go:embed shuileme_beds.json
var shuilemeBedsJSON []byte

//go:embed shuileme_rooms.json
var shuilemeRoomsJSON []byte

//go:embed shuileme_lore.json
var shuilemeLoreJSON []byte

type ShuilemeBed struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	TitleEn   string `json:"titleEn"`
	Blurb     string `json:"blurb"`
	BlurbEn   string `json:"blurbEn"`
	Size      string `json:"size"`
	Fill      string `json:"fill"`
	Era       string `json:"era"`
	Region    string `json:"region"`
	ImageURL  string `json:"imageUrl"`
	WikiURLZh string `json:"wikiUrlZh"`
	WikiURLEn string `json:"wikiUrlEn"`
	Credit    string `json:"credit"`
}

type ShuilemeBedFilter struct {
	Size string
	Fill string
	Era  string
}

type shuilemeBedFile struct {
	Beds []ShuilemeBed `json:"beds"`
}

func ShuilemeBeds() []ShuilemeBed {
	var file shuilemeBedFile
	if err := json.Unmarshal(shuilemeBedsJSON, &file); err != nil {
		return nil
	}
	return file.Beds
}

func FilterShuilemeBeds(f ShuilemeBedFilter) []ShuilemeBed {
	out := make([]ShuilemeBed, 0)
	for _, item := range ShuilemeBeds() {
		if f.Size != "" && item.Size != f.Size {
			continue
		}
		if f.Fill != "" && item.Fill != f.Fill {
			continue
		}
		if f.Era != "" && item.Era != f.Era {
			continue
		}
		out = append(out, item)
	}
	return out
}

type ShuilemeRoom struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	TitleEn   string `json:"titleEn"`
	Blurb     string `json:"blurb"`
	BlurbEn   string `json:"blurbEn"`
	Light     string `json:"light"`
	Layout    string `json:"layout"`
	ImageURL  string `json:"imageUrl"`
	WikiURLZh string `json:"wikiUrlZh"`
	WikiURLEn string `json:"wikiUrlEn"`
	Credit    string `json:"credit"`
}

type ShuilemeRoomFilter struct {
	Light  string
	Layout string
}

type shuilemeRoomFile struct {
	Bedrooms []ShuilemeRoom `json:"bedrooms"`
}

func ShuilemeRooms() []ShuilemeRoom {
	var file shuilemeRoomFile
	if err := json.Unmarshal(shuilemeRoomsJSON, &file); err != nil {
		return nil
	}
	return file.Bedrooms
}

func FilterShuilemeRooms(f ShuilemeRoomFilter) []ShuilemeRoom {
	out := make([]ShuilemeRoom, 0)
	for _, item := range ShuilemeRooms() {
		if f.Light != "" && item.Light != f.Light {
			continue
		}
		if f.Layout != "" && item.Layout != f.Layout {
			continue
		}
		out = append(out, item)
	}
	return out
}

type ShuilemeLoreSource struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type ShuilemeLore struct {
	ID       string               `json:"id"`
	Title    string               `json:"title"`
	TitleEn  string               `json:"titleEn"`
	Body     string               `json:"body"`
	BodyEn   string               `json:"bodyEn"`
	ImageURL string               `json:"imageUrl"`
	Credit   string               `json:"credit"`
	Sources  []ShuilemeLoreSource `json:"sources"`
}

type shuilemeLoreFile struct {
	Articles []ShuilemeLore `json:"articles"`
}

func ShuilemeLoreArticles() []ShuilemeLore {
	var file shuilemeLoreFile
	if err := json.Unmarshal(shuilemeLoreJSON, &file); err != nil {
		return nil
	}
	return file.Articles
}
