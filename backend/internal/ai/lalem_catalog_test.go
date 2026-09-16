package ai

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLalemCatalogHasPicturesAndFilters(t *testing.T) {
	all := LalemToilets()
	if n := len(all); n < 24 || n > 40 {
		t.Fatalf("catalog size %d want 24-40", n)
	}
	shapes := map[string]int{}
	sizes := map[string]int{}
	classes := map[string]int{}
	eras := map[string]int{}
	for _, item := range all {
		if strings.TrimSpace(item.Title) == "" || strings.TrimSpace(item.TitleEn) == "" {
			t.Fatalf("missing title: %+v", item)
		}
		if strings.TrimSpace(item.Blurb) == "" || strings.TrimSpace(item.BlurbEn) == "" {
			t.Fatalf("missing blurb: %s", item.ID)
		}
		if strings.TrimSpace(item.Credit) == "" {
			t.Fatalf("missing credit: %s", item.ID)
		}
		if strings.HasPrefix(item.ImageURL, "http") || strings.Contains(item.ImageURL, "://") {
			t.Fatalf("hotlink image %s", item.ImageURL)
		}
		if !strings.HasPrefix(item.ImageURL, "/lalem/toilets/") {
			t.Fatalf("image must be local pack: %s", item.ImageURL)
		}
		shapes[item.Shape]++
		sizes[item.Size]++
		classes[item.Class]++
		eras[item.Era]++
	}
	for _, shape := range []string{"sit", "squat", "urinal", "pit", "vacuum", "portable"} {
		if shapes[shape] == 0 {
			t.Fatalf("missing shape %s", shape)
		}
	}
	for _, size := range []string{"mini", "standard", "long", "accessible", "child"} {
		if sizes[size] == 0 {
			t.Fatalf("missing size %s", size)
		}
	}
	for _, class := range []string{"home", "public", "transit", "palace", "lab", "luxury"} {
		if classes[class] == 0 {
			t.Fatalf("missing class %s", class)
		}
	}
	if len(eras) < 3 {
		t.Fatalf("need multiple eras, got %v", eras)
	}
	squat := FilterLalemToilets(LalemToiletFilter{Shape: "squat"})
	if len(squat) == 0 {
		t.Fatal("expected squat matches")
	}
	for _, item := range squat {
		if item.Shape != "squat" {
			t.Fatalf("filter leaked %s", item.Shape)
		}
	}
	palace := FilterLalemToilets(LalemToiletFilter{Class: "palace"})
	if len(palace) == 0 {
		t.Fatal("expected palace matches")
	}
	for _, item := range palace {
		if item.Class != "palace" {
			t.Fatalf("class filter leaked %s", item.Class)
		}
	}
	mini := FilterLalemToilets(LalemToiletFilter{Size: "mini"})
	if len(mini) == 0 {
		t.Fatal("expected mini matches")
	}
	for _, item := range mini {
		if item.Size != "mini" {
			t.Fatalf("size filter leaked %s", item.Size)
		}
	}
}

func TestLalemCatalogImagesExistOnDisk(t *testing.T) {
	root := LalemPublicRoot()
	for _, item := range LalemToilets() {
		rel := strings.TrimPrefix(item.ImageURL, "/")
		path := filepath.Join(root, filepath.FromSlash(rel))
		st, err := os.Stat(path)
		if err != nil || st.IsDir() || st.Size() == 0 {
			t.Fatalf("missing catalog image %s -> %s: %v", item.ImageURL, path, err)
		}
	}
}

func TestLalemDigestVideosAndTrendPoolExistOnDisk(t *testing.T) {
	root := LalemPublicRoot()
	videos := LalemCuratedVideos()
	if len(videos) < 2 {
		t.Fatalf("need at least two curated videos, got %d", len(videos))
	}
	for _, v := range videos {
		if !strings.HasPrefix(v.SrcURL, "/lalem/videos/") || !strings.HasSuffix(v.SrcURL, ".mp4") {
			t.Fatalf("video src must be local mp4 pack: %s", v.SrcURL)
		}
		if strings.HasPrefix(v.SrcURL, "http") || strings.Contains(v.SrcURL, "://") {
			t.Fatalf("hotlink video %s", v.SrcURL)
		}
		if !strings.HasPrefix(v.PosterURL, "/lalem/videos/") {
			t.Fatalf("poster must be local pack: %s", v.PosterURL)
		}
		for _, url := range []string{v.SrcURL, v.PosterURL} {
			rel := strings.TrimPrefix(url, "/")
			path := filepath.Join(root, filepath.FromSlash(rel))
			st, err := os.Stat(path)
			if err != nil || st.IsDir() || st.Size() == 0 {
				t.Fatalf("missing media %s -> %s: %v", url, path, err)
			}
		}
	}
	pool := LalemTrendImagePool()
	if len(pool) < 4 {
		t.Fatalf("trend pool too small: %d", len(pool))
	}
	for _, url := range pool {
		if strings.HasPrefix(url, "http") || !strings.HasPrefix(url, "/lalem/trends/") {
			t.Fatalf("trend image must be local pack: %s", url)
		}
		rel := strings.TrimPrefix(url, "/")
		path := filepath.Join(root, filepath.FromSlash(rel))
		st, err := os.Stat(path)
		if err != nil || st.IsDir() || st.Size() == 0 {
			t.Fatalf("missing trend image %s -> %s: %v", url, path, err)
		}
	}
}
