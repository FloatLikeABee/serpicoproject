package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

type shuilemeBedJSON struct {
	ID       string `json:"id"`
	ImageURL string `json:"imageUrl"`
	Fill     string `json:"fill"`
	Era      string `json:"era"`
}

type shuilemeRoomJSON struct {
	ID       string `json:"id"`
	ImageURL string `json:"imageUrl"`
	Light    string `json:"light"`
	Layout   string `json:"layout"`
}

type shuilemeLoreJSON struct {
	ID       string `json:"id"`
	Body     string `json:"body"`
	BodyEn   string `json:"bodyEn"`
	ImageURL string `json:"imageUrl"`
	Sources  []struct {
		Label string `json:"label"`
		URL   string `json:"url"`
	} `json:"sources"`
}

func TestShuilemeBedsCatalogHasImagesAndFilters(t *testing.T) {
	r := fridgeRaidTestRouter(t, &stubLalemAI{})
	w := getJSON(r, "/api/v1/shuileme/beds")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var got struct {
		Beds []shuilemeBedJSON `json:"beds"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Beds) < 8 {
		t.Fatalf("beds=%d want >=8", len(got.Beds))
	}
	for _, item := range got.Beds {
		if item.ImageURL == "" || strings.HasPrefix(item.ImageURL, "http") || strings.Contains(item.ImageURL, "://") {
			t.Fatalf("image %+v", item)
		}
		if !strings.HasPrefix(item.ImageURL, "/shuileme/") {
			t.Fatalf("image must be local /shuileme/ %s", item.ImageURL)
		}
	}
	w2 := getJSON(r, "/api/v1/shuileme/beds?fill=kang&era=tang")
	if w2.Code != http.StatusOK {
		t.Fatalf("filter status %d: %s", w2.Code, w2.Body.String())
	}
	var filtered struct {
		Beds []shuilemeBedJSON `json:"beds"`
	}
	if err := json.Unmarshal(w2.Body.Bytes(), &filtered); err != nil {
		t.Fatal(err)
	}
	if len(filtered.Beds) == 0 {
		t.Fatal("expected kang+tang matches")
	}
	for _, item := range filtered.Beds {
		if item.Fill != "kang" || item.Era != "tang" {
			t.Fatalf("filter leaked %+v", item)
		}
		if !strings.HasPrefix(item.ImageURL, "/shuileme/") {
			t.Fatalf("filtered image %s", item.ImageURL)
		}
	}
}

func TestShuilemeBedroomsCatalogHasImages(t *testing.T) {
	r := fridgeRaidTestRouter(t, &stubLalemAI{})
	w := getJSON(r, "/api/v1/shuileme/bedrooms")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var got struct {
		Bedrooms []shuilemeRoomJSON `json:"bedrooms"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Bedrooms) < 8 {
		t.Fatalf("bedrooms=%d want >=8", len(got.Bedrooms))
	}
	for _, item := range got.Bedrooms {
		if !strings.HasPrefix(item.ImageURL, "/shuileme/") || strings.HasPrefix(item.ImageURL, "http") {
			t.Fatalf("room image %+v", item)
		}
	}
	w2 := getJSON(r, "/api/v1/shuileme/bedrooms?light=blackout")
	if w2.Code != http.StatusOK {
		t.Fatalf("light filter %d %s", w2.Code, w2.Body.String())
	}
	var filtered struct {
		Bedrooms []shuilemeRoomJSON `json:"bedrooms"`
	}
	if err := json.Unmarshal(w2.Body.Bytes(), &filtered); err != nil {
		t.Fatal(err)
	}
	if len(filtered.Bedrooms) == 0 {
		t.Fatal("expected blackout rooms")
	}
	for _, item := range filtered.Bedrooms {
		if item.Light != "blackout" {
			t.Fatalf("light filter leaked %+v", item)
		}
	}
}

func TestShuilemeLoreCatalogHygiene(t *testing.T) {
	r := fridgeRaidTestRouter(t, &stubLalemAI{})
	w := getJSON(r, "/api/v1/shuileme/lore")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var got struct {
		Articles []shuilemeLoreJSON `json:"articles"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Articles) < 16 {
		t.Fatalf("lore=%d want >=16", len(got.Articles))
	}
	seen := map[string]struct{}{}
	for _, item := range got.Articles {
		if item.ID == "" {
			t.Fatal("empty lore id")
		}
		if _, dup := seen[item.ID]; dup {
			t.Fatalf("duplicate lore id %s", item.ID)
		}
		seen[item.ID] = struct{}{}
		if !strings.HasPrefix(item.ImageURL, "/shuileme/lore/") {
			t.Fatalf("lore image %s", item.ImageURL)
		}
		if len(item.Sources) == 0 {
			t.Fatalf("missing sources %s", item.ID)
		}
		low := strings.ToLower(item.Body + item.BodyEn)
		if strings.Contains(low, "you have") || strings.Contains(item.Body, "你患有") {
			t.Fatalf("diagnoses visitor %s", item.ID)
		}
	}
}

func TestShuilemeWikiAllowlistedReturnsSummary(t *testing.T) {
	var hits int
	prev := lalemWikiClient
	lalemWikiClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		hits++
		if r.URL.Host != "zh.wikipedia.org" {
			t.Errorf("host %s", r.URL.Host)
		}
		if !strings.Contains(r.URL.Path, "/api/rest_v1/page/summary/") {
			t.Errorf("path %s", r.URL.Path)
		}
		body := `{"title":"炕","extract":"中国北方的暖床。","lang":"zh"}`
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(body)),
			Request:    r,
		}, nil
	})}
	t.Cleanup(func() { lalemWikiClient = prev })
	r := fridgeRaidTestRouter(t, &stubLalemAI{})
	wiki := "https://zh.wikipedia.org/wiki/%E7%82%BD"
	w := getJSON(r, "/api/v1/shuileme/wiki?url="+url.QueryEscape(wiki))
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if hits != 1 {
		t.Fatalf("upstream hits=%d", hits)
	}
	if strings.Contains(w.Body.String(), "<a ") {
		t.Fatalf("wiki JSON must not include html anchors: %s", w.Body.String())
	}
	var got struct {
		Title     string `json:"title"`
		Extract   string `json:"extract"`
		SourceURL string `json:"sourceUrl"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Title == "" || got.Extract == "" {
		t.Fatalf("summary %+v", got)
	}
}

func TestShuilemeWikiRejectsOffHostWithoutUpstream(t *testing.T) {
	var hits int
	prev := lalemWikiClient
	lalemWikiClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		hits++
		return nil, errString("should not fetch")
	})}
	t.Cleanup(func() { lalemWikiClient = prev })
	r := fridgeRaidTestRouter(t, &stubLalemAI{})
	w := getJSON(r, "/api/v1/shuileme/wiki?url="+url.QueryEscape("https://example.com/wiki/Sleep"))
	if w.Code < 400 || w.Code >= 500 {
		t.Fatalf("status %d %s", w.Code, w.Body.String())
	}
	if w.Code == http.StatusNotFound {
		t.Fatalf("must be handled, not missing route: %d", w.Code)
	}
	if hits != 0 {
		t.Fatalf("off-host must not fetch, hits=%d", hits)
	}
}
