package ai

import (
	"strings"
	"time"
)

type LalemDigestInput struct {
	Locale string
	Mode   string // "" or "seed" for full digest; "increment" for 2 trends + 1 useful
}

type LalemAdvisor struct {
	Now        time.Time
	VisionFn   func(image []byte, mime string) (string, error)
	CompleteFn func(prompt string) (string, error)
}

func (a *LalemAdvisor) now() time.Time {
	if a != nil && !a.Now.IsZero() {
		return a.Now
	}
	return time.Now().UTC()
}

func lalemIncrementMode(mode string) bool {
	return strings.EqualFold(strings.TrimSpace(mode), "increment")
}

func (a *LalemAdvisor) AdviseLalemDigest(in LalemDigestInput) (*LalemDigest, error) {
	locale := lalemLocale(in.Locale)
	increment := lalemIncrementMode(in.Mode)
	if a == nil || a.CompleteFn == nil {
		return cannedLalemByMode(locale, a.now(), increment), nil
	}
	promptIn := LalemDigestPromptInput{Locale: locale, Now: a.now()}
	prompt := BuildLalemDigestPrompt(promptIn)
	if increment {
		prompt = BuildLalemIncrementPrompt(promptIn)
	}
	raw, err := a.CompleteFn(prompt)
	if err != nil || strings.TrimSpace(raw) == "" {
		return cannedLalemByMode(locale, a.now(), increment), nil
	}
	var parsed *LalemDigest
	if increment {
		parsed, err = ParseLalemIncrement(raw)
	} else {
		parsed, err = ParseLalemDigest(raw)
	}
	if err != nil {
		return cannedLalemByMode(locale, a.now(), increment), nil
	}
	out := finishLalemDigest(parsed, locale, a.now())
	if increment {
		return capLalemIncrementDigest(out), nil
	}
	return out, nil
}

func cannedLalemByMode(locale string, now time.Time, increment bool) *LalemDigest {
	if increment {
		return capLalemIncrementDigest(cannedLalemDigest(locale, now))
	}
	return cannedLalemDigest(locale, now)
}

func capLalemIncrementDigest(d *LalemDigest) *LalemDigest {
	if d == nil {
		return d
	}
	if len(d.Trends) > 2 {
		d.Trends = d.Trends[:2]
	}
	if len(d.Useful) > 1 {
		d.Useful = d.Useful[:1]
	}
	return d
}

func finishLalemDigest(d *LalemDigest, locale string, now time.Time) *LalemDigest {
	if d == nil {
		d = &LalemDigest{}
	}
	d.Locale = locale
	if d.GeneratedAt == "" {
		d.GeneratedAt = now.UTC().Format(time.RFC3339)
	}
	if strings.TrimSpace(d.Disclaimer) == "" {
		d.Disclaimer = lalemDisclaimer(locale)
	}
	d.Trends = mapLalemTrendImages(filterLalemTrends(d.Trends))
	if len(d.Trends) == 0 {
		d.Trends = cannedLalemTrends(locale)
	}
	d.Useful = sanitizeLalemUseful(d.Useful, locale)
	d.Videos = []LalemVideo{}
	for i := range d.Trends {
		d.Trends[i].TopicID = MapLalemTrendTopic(d.Trends[i].Title, d.Trends[i].Hook, d.Trends[i].TopicID)
	}
	return d
}

func filterLalemTrends(in []LalemTrend) []LalemTrend {
	if len(in) == 0 {
		return nil
	}
	primary := make([]LalemTrend, 0, len(in))
	other := make([]LalemTrend, 0)
	for _, tr := range in {
		if tr.Kind == "entertainment" || tr.Kind == "fashion" {
			primary = append(primary, tr)
		} else {
			other = append(other, tr)
		}
	}
	out := append([]LalemTrend{}, primary...)
	// Keep other cards as a minority (at most 30%).
	maxOther := len(primary) * 3 / 7
	if maxOther < 0 {
		maxOther = 0
	}
	if len(other) > maxOther {
		other = other[:maxOther]
	}
	out = append(out, other...)
	if len(out) > 8 {
		out = out[:8]
	}
	return out
}

func mapLalemTrendImages(in []LalemTrend) []LalemTrend {
	pool := LalemTrendImagePool()
	if len(pool) == 0 {
		return in
	}
	ent := lalemPoolByKind(pool, "entertainment")
	fas := lalemPoolByKind(pool, "fashion")
	ei, fi, oi := 0, 0, 0
	out := make([]LalemTrend, 0, len(in))
	for _, tr := range in {
		kind := tr.Kind
		hint := strings.ToLower(tr.ImageHint + " " + tr.Title + " " + tr.Hook)
		if strings.Contains(hint, "fashion") || strings.Contains(hint, "时尚") || strings.Contains(hint, "口红") || strings.Contains(hint, "妆") {
			kind = "fashion"
		} else if strings.Contains(hint, "entertain") || strings.Contains(hint, "综艺") || strings.Contains(hint, "剧") {
			kind = "entertainment"
		}
		if kind != "entertainment" && kind != "fashion" {
			kind = tr.Kind
		}
		tr.Kind = kind
		var pick string
		switch kind {
		case "fashion":
			pick = fas[fi%len(fas)]
			fi++
		case "entertainment":
			pick = ent[ei%len(ent)]
			ei++
		default:
			pick = pool[oi%len(pool)]
			oi++
		}
		tr.ImageURL = pick
		out = append(out, tr)
	}
	return out
}

func lalemPoolByKind(pool []string, kind string) []string {
	needle := kind
	out := make([]string, 0)
	for _, p := range pool {
		if strings.Contains(p, needle) {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return pool
	}
	return out
}

func sanitizeLalemUseful(in []string, locale string) []string {
	banned := []string{"diagnose", "diagnos", "prescribe", "cure", "治疗", "处方", "诊断"}
	out := make([]string, 0, len(in))
	for _, u := range in {
		u = strings.TrimSpace(u)
		if u == "" {
			continue
		}
		low := strings.ToLower(u)
		skip := false
		for _, b := range banned {
			if strings.Contains(low, b) || strings.Contains(u, b) {
				skip = true
				break
			}
		}
		if !skip {
			out = append(out, u)
		}
	}
	if len(out) == 0 {
		out = cannedLalemUseful(locale)
	}
	if len(out) > 6 {
		out = out[:6]
	}
	return out
}

func cannedLalemDigest(locale string, now time.Time) *LalemDigest {
	return finishLalemDigest(&LalemDigest{
		Trends: cannedLalemTrends(locale),
		Useful: cannedLalemUseful(locale),
	}, locale, now)
}

func cannedLalemTrends(locale string) []LalemTrend {
	if locale == "cn" {
		return []LalemTrend{
			{Kind: "entertainment", Title: "综艺还在热聊", Hook: "今晚弹幕比剧情热闹。来都来了，刷两眼再冲。", ImageHint: "variety", Chips: []string{"娱乐"}},
			{Kind: "fashion", Title: "妆容换季色号", Hook: "口红和外套一起换挡。坐着也能看秀。", ImageHint: "lipstick", Chips: []string{"时尚"}},
			{Kind: "entertainment", Title: "短剧三分钟", Hook: "反转来得比冲水快。", ImageHint: "drama", Chips: []string{"热搜"}},
			{Kind: "fashion", Title: "街拍阔腿还在", Hook: "裤型宽松，心情也宽松。", ImageHint: "street", Chips: []string{"穿搭"}},
		}
	}
	return []LalemTrend{
		{Kind: "entertainment", Title: "Variety-show chatter", Hook: "The comments are louder than the plot. You’re already here.", ImageHint: "variety", Chips: []string{"hot"}},
		{Kind: "fashion", Title: "Season-shift lipstick", Hook: "New color, same stall. Runway from a seat.", ImageHint: "lipstick", Chips: []string{"look"}},
		{Kind: "entertainment", Title: "Three-minute drama", Hook: "Plot twists faster than a flush.", ImageHint: "drama", Chips: []string{"clip"}},
		{Kind: "fashion", Title: "Wide-leg still winning", Hook: "Loose trousers, looser mood.", ImageHint: "street", Chips: []string{"fit"}},
	}
}

func cannedLalemUseful(locale string) []string {
	if locale == "cn" {
		return []string{
			"别蹲太久，腿麻了就起来走走。",
			"冲完洗手，泡沫覆盖手心手背。",
			"别用力过猛，缓一缓更舒服。",
			"公共厕所用完盖好盖、冲干净。",
			"手机可以玩，门还是要锁好。",
			"来都来了，也别忘了擦干净座位。",
		}
	}
	return []string{
		"Don’t sit too long — stand and shake your legs.",
		"Wash with soap, palms and backs of hands.",
		"Don’t strain. Ease up and wait a beat.",
		"Flush, close the lid, leave it decent.",
		"Phone is fine. Lock the door first.",
		"Wipe the seat if you found it messy.",
	}
}
