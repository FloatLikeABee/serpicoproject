package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"serpico/backend/internal/ai"
)

type kuaixiaosanStoneJSON struct {
	ID           string `json:"id"`
	ImageURL     string `json:"imageUrl"`
	Composition  string `json:"composition"`
	Site         string `json:"site"`
	SizeClass    string `json:"sizeClass"`
}

type kuaixiaosanCaseJSON struct {
	ID       string `json:"id"`
	Body     string `json:"body"`
	BodyEn   string `json:"bodyEn"`
	ImageURL string `json:"imageUrl"`
	Stage    string `json:"stage"`
	Sources  []struct {
		Label string `json:"label"`
		URL   string `json:"url"`
	} `json:"sources"`
}

type kuaixiaosanRecoverJSON struct {
	ID       string `json:"id"`
	Body     string `json:"body"`
	BodyEn   string `json:"bodyEn"`
	ImageURL string `json:"imageUrl"`
	Phase    string `json:"phase"`
	Sources  []struct {
		Label string `json:"label"`
		URL   string `json:"url"`
	} `json:"sources"`
}

type kuaixiaosanLoreJSON struct {
	ID       string `json:"id"`
	Body     string `json:"body"`
	BodyEn   string `json:"bodyEn"`
	ImageURL string `json:"imageUrl"`
	Sources  []struct {
		Label string `json:"label"`
		URL   string `json:"url"`
	} `json:"sources"`
}

type kuaixiaosanImagingJSON struct {
	ID       string `json:"id"`
	ImageURL string `json:"imageUrl"`
	Kind     string `json:"kind"`
}

func TestKuaixiaosanStonesCatalogHasImagesAndFilters(t *testing.T) {
	r := fridgeRaidTestRouter(t, &stubLalemAI{})
	w := getJSON(r, "/api/v1/kuaixiaosan/stones")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var got struct {
		Stones []kuaixiaosanStoneJSON `json:"stones"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Stones) < 16 {
		t.Fatalf("stones=%d want >=16", len(got.Stones))
	}
	for _, item := range got.Stones {
		if item.ImageURL == "" || strings.HasPrefix(item.ImageURL, "http") || strings.Contains(item.ImageURL, "://") {
			t.Fatalf("image %+v", item)
		}
		if !strings.HasPrefix(item.ImageURL, "/kuaixiaosan/stones/") {
			t.Fatalf("image must be local /kuaixiaosan/stones/ %s", item.ImageURL)
		}
	}
	w2 := getJSON(r, "/api/v1/kuaixiaosan/stones?composition=calcium-oxalate&site=kidney")
	if w2.Code != http.StatusOK {
		t.Fatalf("filter status %d: %s", w2.Code, w2.Body.String())
	}
	var filtered struct {
		Stones []kuaixiaosanStoneJSON `json:"stones"`
	}
	if err := json.Unmarshal(w2.Body.Bytes(), &filtered); err != nil {
		t.Fatal(err)
	}
	if len(filtered.Stones) == 0 {
		t.Fatal("expected calcium-oxalate+kidney matches")
	}
	for _, item := range filtered.Stones {
		if item.Composition != "calcium-oxalate" || item.Site != "kidney" {
			t.Fatalf("filter leaked %+v", item)
		}
	}
}

func TestKuaixiaosanCasesRecoverLoreImagingMeetFloors(t *testing.T) {
	r := fridgeRaidTestRouter(t, &stubLalemAI{})
	wCases := getJSON(r, "/api/v1/kuaixiaosan/cases")
	if wCases.Code != http.StatusOK {
		t.Fatalf("cases %d %s", wCases.Code, wCases.Body.String())
	}
	var cases struct {
		Cases []kuaixiaosanCaseJSON `json:"cases"`
	}
	if err := json.Unmarshal(wCases.Body.Bytes(), &cases); err != nil {
		t.Fatal(err)
	}
	if len(cases.Cases) < 12 {
		t.Fatalf("cases=%d want >=12", len(cases.Cases))
	}
	for _, item := range cases.Cases {
		if !strings.HasPrefix(item.ImageURL, "/kuaixiaosan/cases/") || strings.Contains(item.ImageURL, "://") {
			t.Fatalf("case image %+v", item)
		}
		low := strings.ToLower(item.Body + item.BodyEn)
		if strings.Contains(low, "you have") || strings.Contains(item.Body, "你患有") {
			t.Fatalf("diagnoses visitor %s", item.ID)
		}
		if len(item.Sources) == 0 {
			t.Fatalf("missing sources %s", item.ID)
		}
	}

	wRecover := getJSON(r, "/api/v1/kuaixiaosan/recover")
	if wRecover.Code != http.StatusOK {
		t.Fatalf("recover %d %s", wRecover.Code, wRecover.Body.String())
	}
	var rec struct {
		Recover []kuaixiaosanRecoverJSON `json:"recover"`
	}
	if err := json.Unmarshal(wRecover.Body.Bytes(), &rec); err != nil {
		t.Fatal(err)
	}
	if len(rec.Recover) < 12 {
		t.Fatalf("recover=%d want >=12", len(rec.Recover))
	}
	stepHit := false
	for _, item := range rec.Recover {
		if !strings.HasPrefix(item.ImageURL, "/kuaixiaosan/recover/") || strings.Contains(item.ImageURL, "://") {
			t.Fatalf("recover image %+v", item)
		}
		low := strings.ToLower(item.Body + item.BodyEn)
		if strings.Contains(low, "you have") || strings.Contains(item.Body, "你患有") {
			t.Fatalf("diagnoses visitor %s", item.ID)
		}
		if len(item.Sources) == 0 {
			t.Fatalf("missing sources %s", item.ID)
		}
		joined := item.Body + item.BodyEn
		if strings.Contains(joined, "喝水") || strings.Contains(joined, "滤过") || strings.Contains(strings.ToLower(joined), "strain") || strings.Contains(strings.ToLower(joined), "emergency") || strings.Contains(joined, "休息") {
			stepHit = true
		}
	}
	if !stepHit {
		t.Fatal("recover copy must include a recovery step")
	}

	wLore := getJSON(r, "/api/v1/kuaixiaosan/lore")
	if wLore.Code != http.StatusOK {
		t.Fatalf("lore %d %s", wLore.Code, wLore.Body.String())
	}
	var lore struct {
		Articles []kuaixiaosanLoreJSON `json:"articles"`
	}
	if err := json.Unmarshal(wLore.Body.Bytes(), &lore); err != nil {
		t.Fatal(err)
	}
	if len(lore.Articles) < 16 {
		t.Fatalf("lore=%d want >=16", len(lore.Articles))
	}
	for _, item := range lore.Articles {
		if !strings.HasPrefix(item.ImageURL, "/kuaixiaosan/lore/") {
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

	wImg := getJSON(r, "/api/v1/kuaixiaosan/imaging")
	if wImg.Code != http.StatusOK {
		t.Fatalf("imaging %d %s", wImg.Code, wImg.Body.String())
	}
	var img struct {
		Imaging []kuaixiaosanImagingJSON `json:"imaging"`
	}
	if err := json.Unmarshal(wImg.Body.Bytes(), &img); err != nil {
		t.Fatal(err)
	}
	if len(img.Imaging) < 12 {
		t.Fatalf("imaging=%d want >=12", len(img.Imaging))
	}
	for _, item := range img.Imaging {
		if !strings.HasPrefix(item.ImageURL, "/kuaixiaosan/imaging/") || strings.Contains(item.ImageURL, "://") {
			t.Fatalf("imaging image %+v", item)
		}
	}
}

func TestKuaixiaosanWikiAllowlistedReturnsSummary(t *testing.T) {
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
		body := `{"title":"肾结石","extract":"肾脏或尿路中的固体结晶。","lang":"zh"}`
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(body)),
			Request:    r,
		}, nil
	})}
	t.Cleanup(func() { lalemWikiClient = prev })
	r := fridgeRaidTestRouter(t, &stubLalemAI{})
	wiki := "https://zh.wikipedia.org/wiki/%E8%82%BE%E7%BB%93%E7%9F%B3"
	w := getJSON(r, "/api/v1/kuaixiaosan/wiki?url="+url.QueryEscape(wiki))
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

func TestKuaixiaosanWikiRejectsOffHostWithoutUpstream(t *testing.T) {
	var hits int
	prev := lalemWikiClient
	lalemWikiClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		hits++
		return nil, errString("should not fetch")
	})}
	t.Cleanup(func() { lalemWikiClient = prev })
	r := fridgeRaidTestRouter(t, &stubLalemAI{})
	w := getJSON(r, "/api/v1/kuaixiaosan/wiki?url="+url.QueryEscape("https://example.com/wiki/Stone"))
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

func TestKuaixiaosanChatPostReturnsRecoveryReply(t *testing.T) {
	resetLalemChatLimiter()
	resetShuilemeChatLimiter()
	resetKuaixiaosanChatLimiter()
	r := fridgeRaidTestRouter(t, &ai.KuaixiaosanAdvisor{})
	w := postJSON(r, "/api/v1/kuaixiaosan/chat", `{"locale":"cn","message":"腰好疼"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var got struct {
		Reply string `json:"reply"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(got.Reply) == "" {
		t.Fatal("empty reply")
	}
	low := strings.ToLower(got.Reply)
	if strings.Contains(low, "you have") || strings.Contains(got.Reply, "你患有") {
		t.Fatalf("diagnostic %q", got.Reply)
	}
	if strings.Contains(got.Reply, "便便科普") {
		t.Fatalf("must not reuse 拉了么 canned: %q", got.Reply)
	}
	if strings.Contains(got.Reply, "交换律") || strings.Contains(low, "commutative") {
		t.Fatalf("must not reuse 睡了么 canned: %q", got.Reply)
	}
}

func TestKuaixiaosanChatCannedWhenAdvisorHasNoCompleteFn(t *testing.T) {
	resetKuaixiaosanChatLimiter()
	r := fridgeRaidTestRouter(t, &ai.KuaixiaosanAdvisor{})
	w := postJSON(r, "/api/v1/kuaixiaosan/chat", `{"locale":"en","message":"flank pain"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var got struct {
		Reply string `json:"reply"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(got.Reply) == "" {
		t.Fatal("expected canned")
	}
	if strings.Contains(strings.ToLower(got.Reply), "funny poop") {
		t.Fatalf("canned reused 拉了么: %q", got.Reply)
	}
	if strings.Contains(strings.ToLower(got.Reply), "commutative") {
		t.Fatalf("canned reused 睡了么: %q", got.Reply)
	}
}

func TestKuaixiaosanChatRejectsDiagnosisFromLiveModel(t *testing.T) {
	resetKuaixiaosanChatLimiter()
	adv := &ai.KuaixiaosanAdvisor{
		CompleteFn: func(prompt string) (string, error) {
			return `{"reply":"you have kidney stones and 你患有肾结石"}`, nil
		},
	}
	r := fridgeRaidTestRouter(t, adv)
	w := postJSON(r, "/api/v1/kuaixiaosan/chat", `{"locale":"en","message":"am I sick?"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var got struct {
		Reply string `json:"reply"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	low := strings.ToLower(got.Reply)
	if strings.Contains(low, "you have") || strings.Contains(got.Reply, "你患有") {
		t.Fatalf("diagnostic leaked %q", got.Reply)
	}
}
