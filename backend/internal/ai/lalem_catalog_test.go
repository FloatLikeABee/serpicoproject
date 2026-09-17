package ai

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"net/url"
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
		if !strings.HasPrefix(item.ImageURL, "/lalem/toilets/") || !strings.HasSuffix(item.ImageURL, ".jpg") {
			t.Fatalf("image must be local jpg pack: %s", item.ImageURL)
		}
		assertLalemWikiURL(t, item.WikiURLZh, "zh.wikipedia.org")
		assertLalemWikiURL(t, item.WikiURLEn, "en.wikipedia.org")
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

func TestLalemToiletImagesHaveDistinctGeometry(t *testing.T) {
	byShape := map[string][]string{}
	seen := map[string]string{}
	for _, item := range LalemToilets() {
		raw := assertLalemLocalJPEG(t, item.ImageURL, "/lalem/toilets/")
		sum := sha256Hex(raw)
		if prev, ok := seen[sum]; ok {
			t.Fatalf("duplicate photo %s and %s", prev, item.ID)
		}
		seen[sum] = item.ID
		byShape[item.Shape] = append(byShape[item.Shape], sum)
	}
	for _, shape := range []string{"sit", "squat", "urinal", "vacuum", "portable"} {
		files := byShape[shape]
		if len(files) == 0 {
			t.Fatalf("missing shape %s", shape)
		}
		if len(files) > 1 {
			same := true
			for i := 1; i < len(files); i++ {
				if files[i] != files[0] {
					same = false
					break
				}
			}
			if same {
				t.Fatalf("same-shape %s files are identical clones", shape)
			}
		}
	}
}

func assertLalemWikiURL(t *testing.T, raw, host string) {
	t.Helper()
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.Host != host || strings.Trim(u.Path, "/") == "" {
		t.Fatalf("want https://%s/<article>, got %q", host, raw)
	}
}

func assertLalemLocalJPEG(t *testing.T, imageURL, prefix string) []byte {
	t.Helper()
	if strings.Contains(imageURL, "://") || strings.HasPrefix(imageURL, "http") {
		t.Fatalf("hotlink image %s", imageURL)
	}
	if !strings.HasPrefix(imageURL, prefix) || !strings.HasSuffix(imageURL, ".jpg") {
		t.Fatalf("want local %s*.jpg, got %s", prefix, imageURL)
	}
	rel := strings.TrimPrefix(imageURL, "/")
	raw, err := os.ReadFile(filepath.Join(LalemPublicRoot(), filepath.FromSlash(rel)))
	if err != nil {
		t.Fatalf("read %s: %v", imageURL, err)
	}
	if len(raw) < 8 || raw[0] != 0xff || raw[1] != 0xd8 {
		t.Fatalf("not JPEG SOI: %s", imageURL)
	}
	if bytes.Contains(bytes.ToLower(raw), []byte("<svg")) {
		t.Fatalf("svg leftover in %s", imageURL)
	}
	return raw
}

func sha256Hex(raw []byte) string {
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}

func TestRewriteLalemTrendImage(t *testing.T) {
	if got := RewriteLalemTrendImage("/lalem/trends/fashion-1.svg"); got != "/lalem/trends/fashion-1.jpg" {
		t.Fatalf("svg stem: %s", got)
	}
	if got := RewriteLalemTrendImage("/lalem/trends/fashion-1.jpg"); got != "/lalem/trends/fashion-1.jpg" {
		t.Fatalf("jpg passthrough: %s", got)
	}
	fallback := RewriteLalemTrendImage("https://example.com/x.jpg")
	pool := LalemTrendImagePool()
	ok := false
	for _, p := range pool {
		if fallback == p {
			ok = true
			break
		}
	}
	if !ok {
		t.Fatalf("unknown URL should fall back onto the JPEG pool, got %s", fallback)
	}
}

func TestLalemPapersCatalogHasWikiAndImages(t *testing.T) {
	all := LalemPapers()
	if len(all) < 8 {
		t.Fatalf("papers=%d", len(all))
	}
	need := map[string]bool{
		"xylospongium": true, "newspaper": true, "leaves": true, "chu-chou": true, "corn-cob": true,
		"roll-paper": true, "wet-wipe": true, "bidet": true, "washlet-water": true, "bum-gun": true,
	}
	paperHashes := map[string]string{}
	for _, item := range all {
		delete(need, item.ID)
		assertLalemWikiURL(t, item.WikiURLZh, "zh.wikipedia.org")
		assertLalemWikiURL(t, item.WikiURLEn, "en.wikipedia.org")
		raw := assertLalemLocalJPEG(t, item.ImageURL, "/lalem/papers/")
		sum := sha256Hex(raw)
		if prev, ok := paperHashes[sum]; ok {
			t.Fatalf("duplicate paper photo %s and %s", prev, item.ID)
		}
		paperHashes[sum] = item.ID
	}
	if len(need) > 0 {
		t.Fatalf("missing paper ids %v", need)
	}
	if len(paperHashes) < 8 {
		t.Fatalf("paper photos not distinct: %d", len(paperHashes))
	}
	for _, item := range LalemToilets() {
		if item.Shape != "sit" {
			continue
		}
		sum := sha256Hex(assertLalemLocalJPEG(t, item.ImageURL, "/lalem/toilets/"))
		if id, ok := paperHashes[sum]; ok {
			t.Fatalf("paper %s reused sit-toilet photo", id)
		}
		break
	}
}

func TestLalemMedicineCatalogIsSourcedEncyclopedia(t *testing.T) {
	need := []string{"posture-squat-sit", "footstool-lean", "straining-valsalva", "time-on-bowl", "pelvic-floor", "hemorrhoids", "constipation"}
	got := map[string]LalemMedicine{}
	for _, item := range LalemMedicineArticles() {
		got[item.ID] = item
	}
	for _, id := range need {
		item, ok := got[id]
		if !ok {
			t.Fatalf("missing article %s", id)
		}
		if strings.Count(item.Body, "。") < 2 || strings.Count(item.BodyEn, ".") < 2 {
			t.Fatalf("body too short %s", id)
		}
		low := strings.ToLower(item.Body + item.BodyEn)
		if strings.Contains(low, "you have") || strings.Contains(item.Body, "你患有") {
			t.Fatalf("diagnoses visitor %s", id)
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
			t.Fatalf("sources wiki=%v org=%v for %s", hasWiki, hasOrg, id)
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
		if strings.HasPrefix(url, "http") || !strings.HasPrefix(url, "/lalem/trends/") || !strings.HasSuffix(url, ".jpg") {
			t.Fatalf("trend image must be local jpg pack: %s", url)
		}
		rel := strings.TrimPrefix(url, "/")
		path := filepath.Join(root, filepath.FromSlash(rel))
		st, err := os.Stat(path)
		if err != nil || st.IsDir() || st.Size() == 0 {
			t.Fatalf("missing trend image %s -> %s: %v", url, path, err)
		}
	}
}
