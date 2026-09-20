package ai

import (
	"strings"
	"testing"
)

func TestKuaixiaosanStonesCatalogFloorsAndFilters(t *testing.T) {
	all := KuaixiaosanStones()
	if len(all) < 16 {
		t.Fatalf("stones=%d want >=16", len(all))
	}
	seen := map[string]struct{}{}
	compositions := map[string]int{}
	sites := map[string]int{}
	sizes := map[string]int{}
	for _, item := range all {
		if item.ID == "" || strings.Contains(item.ID, "_") || item.ID != strings.ToLower(item.ID) {
			t.Fatalf("id must be kebab-case: %q", item.ID)
		}
		if _, dup := seen[item.ID]; dup {
			t.Fatalf("duplicate id %s", item.ID)
		}
		seen[item.ID] = struct{}{}
		if strings.TrimSpace(item.Title) == "" || strings.TrimSpace(item.TitleEn) == "" {
			t.Fatalf("missing title %+v", item)
		}
		if strings.TrimSpace(item.Blurb) == "" || strings.TrimSpace(item.BlurbEn) == "" {
			t.Fatalf("missing blurb %s", item.ID)
		}
		if strings.TrimSpace(item.Credit) == "" {
			t.Fatalf("missing credit %s", item.ID)
		}
		if strings.HasPrefix(item.ImageURL, "http") || strings.Contains(item.ImageURL, "://") {
			t.Fatalf("hotlink image %s", item.ImageURL)
		}
		if !strings.HasPrefix(item.ImageURL, "/kuaixiaosan/stones/") || !strings.HasSuffix(item.ImageURL, ".jpg") {
			t.Fatalf("image must be local jpg pack: %s", item.ImageURL)
		}
		assertLalemWikiURL(t, item.WikiURLZh, "zh.wikipedia.org")
		assertLalemWikiURL(t, item.WikiURLEn, "en.wikipedia.org")
		compositions[item.Composition]++
		sites[item.Site]++
		sizes[item.SizeClass]++
	}
	for _, composition := range []string{"calcium-oxalate", "uric", "struvite", "cystine", "other"} {
		if compositions[composition] == 0 {
			t.Fatalf("missing composition %s", composition)
		}
	}
	for _, site := range []string{"kidney", "ureter", "bladder"} {
		if sites[site] == 0 {
			t.Fatalf("missing site %s", site)
		}
	}
	for _, size := range []string{"grit", "small", "staghorn"} {
		if sizes[size] == 0 {
			t.Fatalf("missing sizeClass %s", size)
		}
	}
	ox := FilterKuaixiaosanStones(KuaixiaosanStoneFilter{Composition: "calcium-oxalate"})
	if len(ox) == 0 {
		t.Fatal("expected calcium-oxalate matches")
	}
	for _, item := range ox {
		if item.Composition != "calcium-oxalate" {
			t.Fatalf("composition filter leaked %s", item.Composition)
		}
	}
	kidney := FilterKuaixiaosanStones(KuaixiaosanStoneFilter{Site: "kidney"})
	if len(kidney) == 0 {
		t.Fatal("expected kidney matches")
	}
	for _, item := range kidney {
		if item.Site != "kidney" {
			t.Fatalf("site filter leaked %s", item.Site)
		}
	}
}

func TestKuaixiaosanCasesCatalogFloorsAndFilters(t *testing.T) {
	all := KuaixiaosanCases()
	if len(all) < 12 {
		t.Fatalf("cases=%d want >=12", len(all))
	}
	seen := map[string]struct{}{}
	stages := map[string]int{}
	for _, item := range all {
		if _, dup := seen[item.ID]; dup {
			t.Fatalf("duplicate case %s", item.ID)
		}
		seen[item.ID] = struct{}{}
		if !strings.HasPrefix(item.ImageURL, "/kuaixiaosan/cases/") || !strings.HasSuffix(item.ImageURL, ".jpg") {
			t.Fatalf("case image %s", item.ImageURL)
		}
		if strings.Contains(item.ImageURL, "://") {
			t.Fatalf("hotlink %s", item.ImageURL)
		}
		low := strings.ToLower(item.Body + item.BodyEn)
		if strings.Contains(low, "you have") || strings.Contains(item.Body, "你患有") {
			t.Fatalf("diagnoses visitor %s", item.ID)
		}
		if !strings.Contains(item.Body, "有人") && !strings.Contains(item.BodyEn, "Someone") && !strings.Contains(item.BodyEn, "A person") {
			t.Fatalf("case must be third-person vignette %s", item.ID)
		}
		if len(item.Sources) == 0 {
			t.Fatalf("missing sources %s", item.ID)
		}
		assertKuaixiaosanSources(t, item.ID, item.Sources)
		stages[item.Stage]++
	}
	for _, stage := range []string{"forming", "colic", "er", "post-op", "prevention"} {
		if stages[stage] == 0 {
			t.Fatalf("missing stage %s", stage)
		}
	}
	colic := FilterKuaixiaosanCases(KuaixiaosanCaseFilter{Stage: "colic"})
	if len(colic) == 0 {
		t.Fatal("expected colic cases")
	}
	for _, item := range colic {
		if item.Stage != "colic" {
			t.Fatalf("stage filter leaked %s", item.Stage)
		}
	}
}

func TestKuaixiaosanRecoverCatalogFloorsAndHygiene(t *testing.T) {
	all := KuaixiaosanRecover()
	if len(all) < 12 {
		t.Fatalf("recover=%d want >=12", len(all))
	}
	seen := map[string]struct{}{}
	phases := map[string]int{}
	stepHit := false
	for _, item := range all {
		if _, dup := seen[item.ID]; dup {
			t.Fatalf("duplicate recover %s", item.ID)
		}
		seen[item.ID] = struct{}{}
		if !strings.HasPrefix(item.ImageURL, "/kuaixiaosan/recover/") || !strings.HasSuffix(item.ImageURL, ".jpg") {
			t.Fatalf("recover image %s", item.ImageURL)
		}
		if strings.Contains(item.ImageURL, "://") {
			t.Fatalf("hotlink %s", item.ImageURL)
		}
		low := strings.ToLower(item.Body + item.BodyEn)
		if strings.Contains(low, "you have") || strings.Contains(item.Body, "你患有") {
			t.Fatalf("diagnoses visitor %s", item.ID)
		}
		if strings.Contains(low, "take this") || strings.Contains(item.Body, "请服用") {
			t.Fatalf("prescribes %s", item.ID)
		}
		if kuaixiaosanHasRecoveryStep(item.Body + item.BodyEn) {
			stepHit = true
		}
		if len(item.Sources) == 0 {
			t.Fatalf("missing sources %s", item.ID)
		}
		assertKuaixiaosanSources(t, item.ID, item.Sources)
		phases[item.Phase]++
	}
	if !stepHit {
		t.Fatal("recover catalog must include a fluids/rest/strain/emergency step")
	}
	for _, phase := range []string{"acute", "passing", "post-litho", "post-ureteroscopy", "prevention"} {
		if phases[phase] == 0 {
			t.Fatalf("missing phase %s", phase)
		}
	}
	acute := FilterKuaixiaosanRecover(KuaixiaosanRecoverFilter{Phase: "acute"})
	if len(acute) == 0 {
		t.Fatal("expected acute recover items")
	}
	for _, item := range acute {
		if item.Phase != "acute" {
			t.Fatalf("phase filter leaked %s", item.Phase)
		}
	}
}

func TestKuaixiaosanLoreCatalogIsSourcedEncyclopedia(t *testing.T) {
	articles := KuaixiaosanLoreArticles()
	if len(articles) < 16 {
		t.Fatalf("articles=%d want >=16", len(articles))
	}
	seen := map[string]struct{}{}
	topics := map[string]int{}
	for _, item := range articles {
		if item.ID == "" || strings.Contains(item.ID, "_") || item.ID != strings.ToLower(item.ID) {
			t.Fatalf("id must be kebab-case: %q", item.ID)
		}
		if _, dup := seen[item.ID]; dup {
			t.Fatalf("duplicate id %s", item.ID)
		}
		seen[item.ID] = struct{}{}
		if strings.Count(item.Body, "。") < 2 || strings.Count(item.BodyEn, ".") < 2 {
			t.Fatalf("body too short %s", item.ID)
		}
		low := strings.ToLower(item.Body + item.BodyEn)
		if strings.Contains(low, "you have") || strings.Contains(item.Body, "你患有") {
			t.Fatalf("diagnoses visitor %s", item.ID)
		}
		if strings.Contains(low, "take this") || strings.Contains(item.Body, "请服用") {
			t.Fatalf("prescribes %s", item.ID)
		}
		assertKuaixiaosanSources(t, item.ID, item.Sources)
		want := "/kuaixiaosan/lore/" + item.ID + ".jpg"
		if item.ImageURL != want {
			t.Fatalf("imageUrl %s want %s", item.ImageURL, want)
		}
		topics[item.Topic]++
	}
	for _, topic := range []string{"formation", "diet", "oxalate", "uric", "infection", "procedure", "anatomy", "tcm-encyc"} {
		if topics[topic] == 0 {
			t.Fatalf("missing topic %s", topic)
		}
	}
}

func TestKuaixiaosanImagingCatalogFloorsAndFilters(t *testing.T) {
	all := KuaixiaosanImaging()
	if len(all) < 12 {
		t.Fatalf("imaging=%d want >=12", len(all))
	}
	seen := map[string]struct{}{}
	kinds := map[string]int{}
	for _, item := range all {
		if _, dup := seen[item.ID]; dup {
			t.Fatalf("duplicate imaging %s", item.ID)
		}
		seen[item.ID] = struct{}{}
		if !strings.HasPrefix(item.ImageURL, "/kuaixiaosan/imaging/") || !strings.HasSuffix(item.ImageURL, ".jpg") {
			t.Fatalf("imaging image %s", item.ImageURL)
		}
		if strings.Contains(item.ImageURL, "://") {
			t.Fatalf("hotlink %s", item.ImageURL)
		}
		assertLalemWikiURL(t, item.WikiURLZh, "zh.wikipedia.org")
		assertLalemWikiURL(t, item.WikiURLEn, "en.wikipedia.org")
		kinds[item.Kind]++
	}
	for _, kind := range []string{"ct", "us", "xray", "anatomy", "specimen", "device"} {
		if kinds[kind] == 0 {
			t.Fatalf("missing kind %s", kind)
		}
	}
	ct := FilterKuaixiaosanImaging(KuaixiaosanImagingFilter{Kind: "ct"})
	if len(ct) == 0 {
		t.Fatal("expected ct imaging")
	}
	for _, item := range ct {
		if item.Kind != "ct" {
			t.Fatalf("kind filter leaked %s", item.Kind)
		}
	}
}

func TestKuaixiaosanCatalogJPEGsAreDistinctLocalFiles(t *testing.T) {
	hashes := map[string]string{}
	check := func(imageURL, prefix string) {
		t.Helper()
		raw := assertLalemLocalJPEG(t, imageURL, prefix)
		sum := sha256Hex(raw)
		if prev, ok := hashes[sum]; ok {
			t.Fatalf("duplicate photo %s and %s", prev, imageURL)
		}
		hashes[sum] = imageURL
	}
	for _, item := range KuaixiaosanStones() {
		check(item.ImageURL, "/kuaixiaosan/stones/")
	}
	for _, item := range KuaixiaosanCases() {
		check(item.ImageURL, "/kuaixiaosan/cases/")
	}
	for _, item := range KuaixiaosanRecover() {
		check(item.ImageURL, "/kuaixiaosan/recover/")
	}
	for _, item := range KuaixiaosanLoreArticles() {
		check(item.ImageURL, "/kuaixiaosan/lore/")
	}
	for _, item := range KuaixiaosanImaging() {
		check(item.ImageURL, "/kuaixiaosan/imaging/")
	}
	if len(hashes) < 16+12+12+16+12 {
		t.Fatalf("distinct photos=%d", len(hashes))
	}
}

func assertKuaixiaosanSources(t *testing.T, id string, sources []KuaixiaosanSource) {
	t.Helper()
	hasWiki, hasOrg := false, false
	for _, src := range sources {
		if lalemWikiHostOK(src.URL, "zh.wikipedia.org") || lalemWikiHostOK(src.URL, "en.wikipedia.org") {
			hasWiki = true
		}
		if lalemOrgHostOK(src.URL) || kuaixiaosanNiddkOK(src.URL) {
			hasOrg = true
		}
	}
	if !hasWiki && !hasOrg {
		t.Fatalf("sources missing wiki/org for %s", id)
	}
}

func kuaixiaosanNiddkOK(raw string) bool {
	return strings.Contains(strings.ToLower(raw), "niddk.nih.gov")
}

func kuaixiaosanHasRecoveryStep(body string) bool {
	low := strings.ToLower(body)
	needles := []string{"喝水", "补水", "fluid", "休息", "rest", "滤过", "strain", "急诊", "emergency"}
	for _, n := range needles {
		if strings.Contains(low, n) || strings.Contains(body, n) {
			return true
		}
	}
	return false
}
