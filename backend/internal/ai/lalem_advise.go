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
		tr.ImageURL = RewriteLalemTrendImage(pick)
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

const LalemTrendFloor = 50

type cannedLalemTrendSpec struct {
	Kind, Title, Hook, ImageHint, Chip string
}

func cannedLalemTrendSpecs(locale string) []cannedLalemTrendSpec {
	if locale == "cn" {
		return []cannedLalemTrendSpec{
			{"entertainment", "综艺还在热聊", "今晚弹幕比剧情热闹。来都来了，刷两眼再冲。", "variety", "娱乐"},
			{"entertainment", "短剧三分钟", "反转来得比冲水快。", "drama", "热搜"},
			{"entertainment", "弹幕比剧情热闹", "评论区比主演还忙。", "variety", "娱乐"},
			{"entertainment", "厕所里追更", "下一集刚好在冲水前结束。", "drama", "追更"},
			{"entertainment", "反转来得比冲水快", "编剧比水箱还着急。", "drama", "反转"},
			{"entertainment", "蹲着看晚会", "春晚座位在隔间。", "variety", "晚会"},
			{"entertainment", "热搜上了马桶盖", "盖子比热榜还烫。", "variety", "热搜"},
			{"entertainment", "综艺夜不打烊", "录制结束，弹幕还没下班。", "variety", "夜间"},
			{"entertainment", "厕所K歌排行", "隔间混响意外好听。", "variety", "K歌"},
			{"entertainment", "深夜档还在播", "困的是眼睛，不是剧情。", "drama", "深夜"},
			{"entertainment", "厕所里的名场面", "名场面不需要红毯。", "variety", "名场面"},
			{"entertainment", "短视频三连", "拇指比 Mag 还勤快。", "drama", "短视频"},
			{"entertainment", "来都来了再刷一集", "片尾曲比冲水键近。", "drama", "追更"},
			{"entertainment", "厕纸广告比正片好看", "贴片比主角会说话。", "variety", "广告"},
			{"entertainment", "卫生间演唱会", "混响免费，门票是门锁。", "variety", "演出"},
			{"entertainment", "马桶盖前排", "内场其实是陶瓷。", "variety", "前排"},
			{"entertainment", "蹲坑追星", "偶像在屏幕里，粉丝在隔间。", "variety", "追星"},
			{"entertainment", "厕所里的颁奖礼", "奖杯是洗手液。", "variety", "颁奖"},
			{"entertainment", "冲水声配BGM", "水箱会和声。", "variety", "配乐"},
			{"entertainment", "隔间里的笑点", "隔壁先笑出了声。", "variety", "笑点"},
			{"entertainment", "热梗冲进卫生间", "梗比水先到。", "variety", "热梗"},
			{"entertainment", "剧情走到洗手台", "洗手也是过场。", "drama", "过场"},
			{"entertainment", "厕所夜话节目", "夜话不需要茶几。", "variety", "夜话"},
			{"entertainment", "蹲姿看球赛", "加时赛和加时蹲。", "variety", "球赛"},
			{"entertainment", "花絮比正片长", "花絮不看完不冲。", "drama", "花絮"},
			{"entertainment", "厕所里的配音秀", "对口型对着瓷砖。", "variety", "配音"},
			{"entertainment", "隔间弹幕墙", "门板上全是假弹幕。", "variety", "弹幕"},
			{"entertainment", "综艺嘉宾蹲太久", "录制提示：可以起来了。", "variety", "嘉宾"},
			{"entertainment", "马桶前的红毯", "走秀步幅受隔间限制。", "variety", "红毯"},
			{"entertainment", "卫生间里的选秀", "晋级靠洗手速度。", "variety", "选秀"},
			{"fashion", "妆容换季色号", "口红和外套一起换挡。坐着也能看秀。", "lipstick", "时尚"},
			{"fashion", "街拍阔腿还在", "裤型宽松，心情也宽松。", "street", "穿搭"},
			{"fashion", "隔间里补口红", "镜子比化妆台近。", "lipstick", "补妆"},
			{"fashion", "马桶盖试色卡", "盖子当调色盘纯属玩笑。", "lipstick", "试色"},
			{"fashion", "卫衣配拖鞋出门", "舒适度比秀场分高。", "street", "舒适"},
			{"fashion", "金属皮带扣闪光", "瓷砖把扣子打亮了。", "street", "配饰"},
			{"fashion", "厕所镜前刘海", "刘海和灯管在谈判。", "street", "发型"},
			{"fashion", "新季丹宁还在涨", "牛仔比水位涨得慢。", "street", "丹宁"},
			{"fashion", "耳饰叮当作响", "转身会响，冲水更响。", "street", "耳饰"},
			{"fashion", "香水留在隔间", "下一班还能闻见尾调。", "street", "香水"},
			{"fashion", "丝巾当腰带", "一条布解决两季。", "street", "丝巾"},
			{"fashion", "球鞋踩过地砖", "鞋墙在脚下这一格。", "street", "球鞋"},
			{"fashion", "冷白皮还是暖皮", "灯管不负责回答。", "lipstick", "肤色"},
			{"fashion", "卫衣帽子战", "帽子是第五件单品。", "street", "帽子"},
			{"fashion", "指甲颜色换季", "十个色号排班。", "lipstick", "美甲"},
			{"fashion", "马桶前的旧货", "二手衣比新季诚实。", "street", "旧货"},
			{"fashion", "卫衣叠穿三件", "层数比气温认真。", "street", "叠穿"},
			{"fashion", "镜面瓷砖当打光", "免费环形灯。", "street", "打光"},
			{"fashion", "马桶刷配色灵感", "家居色号也能看。", "street", "配色"},
			{"fashion", "浴室吸睛耳环", "水汽里也要闪亮。", "street", "耳环"},
		}
	}
	return []cannedLalemTrendSpec{
		{"entertainment", "Variety-show chatter", "The comments are louder than the plot. You’re already here.", "variety", "hot"},
		{"entertainment", "Three-minute drama", "Plot twists faster than a flush.", "drama", "clip"},
		{"entertainment", "Comments louder than plot", "The peanut gallery has better timing.", "variety", "hot"},
		{"entertainment", "Binge in the stall", "The next episode ends before the tank refills.", "drama", "binge"},
		{"entertainment", "Twist faster than a flush", "Writers beat the cistern.", "drama", "twist"},
		{"entertainment", "Gala from a squat", "Front row is ceramic.", "variety", "gala"},
		{"entertainment", "Trending on the lid", "The seat is hotter than the chart.", "variety", "trend"},
		{"entertainment", "Variety after midnight", "Tape wrapped; comments did not.", "variety", "late"},
		{"entertainment", "Stall karaoke chart", "The tile has reverb.", "variety", "karaoke"},
		{"entertainment", "Late-night still on", "Eyes quit before the plot.", "drama", "late"},
		{"entertainment", "Bathroom famous scene", "No carpet required.", "variety", "scene"},
		{"entertainment", "Short-video triple tap", "Thumbs work overtime.", "drama", "clip"},
		{"entertainment", "One more episode", "Credits sit closer than the handle.", "drama", "more"},
		{"entertainment", "Ad better than the show", "The bumper talks more.", "variety", "ad"},
		{"entertainment", "Restroom concert", "Lock is the ticket.", "variety", "show"},
		{"entertainment", "Front row on the lid", "House seats in porcelain.", "variety", "front"},
		{"entertainment", "Fan-meet in a squat", "Idol on screen, fan in a stall.", "variety", "fan"},
		{"entertainment", "Award show in a stall", "Trophy is the soap pump.", "variety", "award"},
		{"entertainment", "Flush as soundtrack", "The tank can harmonize.", "variety", "score"},
		{"entertainment", "Joke in the partition", "The next stall laughed first.", "variety", "gag"},
		{"entertainment", "Meme enters the restroom", "The joke beat the water.", "variety", "meme"},
		{"entertainment", "Plot walks to the sink", "Washing is a cutaway.", "drama", "cut"},
		{"entertainment", "Late-night loo talk", "No coffee table needed.", "variety", "talk"},
		{"entertainment", "Match from a squat", "Extra time, extra squat.", "variety", "match"},
		{"entertainment", "B-roll longer than A", "Don't flush mid-featurette.", "drama", "broll"},
		{"entertainment", "Dubbing in the stall", "Lip-sync versus tile.", "variety", "dub"},
		{"entertainment", "Danmaku on the door", "Fake comments, real door.", "variety", "comments"},
		{"entertainment", "Guest sat too long", "Wrap note: you may stand.", "variety", "guest"},
		{"entertainment", "Red carpet at the bowl", "Stride limited by the stall.", "variety", "carpet"},
		{"entertainment", "Restroom talent show", "Advance by rinse speed.", "variety", "talent"},
		{"fashion", "Season-shift lipstick", "New color, same stall. Runway from a seat.", "lipstick", "look"},
		{"fashion", "Wide-leg still winning", "Loose trousers, looser mood.", "street", "fit"},
		{"fashion", "Lipstick in the stall", "The mirror is closer than a vanity.", "lipstick", "touchup"},
		{"fashion", "Lid as a palette", "Do not actually swatch the seat.", "lipstick", "swatch"},
		{"fashion", "Hoodie with slides", "Comfort scores higher than the runway.", "street", "easy"},
		{"fashion", "Belt buckle flash", "Tile lights the hardware.", "street", "hardware"},
		{"fashion", "Bangs in the loo mirror", "Fringe negotiating with the tube light.", "street", "hair"},
		{"fashion", "Denim still climbing", "Jeans rise slower than the tank.", "street", "denim"},
		{"fashion", "Earrings that chatter", "Turn and they ring; flush rings more.", "street", "ears"},
		{"fashion", "Perfume left behind", "The next shift gets the dry-down.", "street", "scent"},
		{"fashion", "Scarf as a belt", "One cloth, two seasons.", "street", "scarf"},
		{"fashion", "Sneakers on tile", "The wall is one floor tile.", "street", "kicks"},
		{"fashion", "Cool undertone or warm", "The bulb will not answer.", "lipstick", "tone"},
		{"fashion", "Hood war", "The hood is item five.", "street", "hood"},
		{"fashion", "Nail season shift", "Ten shades on rotation.", "lipstick", "nails"},
		{"fashion", "Thrifting at the bowl", "Secondhand is honest.", "street", "thrift"},
		{"fashion", "Triple-layer hoodie", "Layers take weather more seriously.", "street", "layer"},
		{"fashion", "Tile as a ring light", "Ring light, no checkout.", "street", "light"},
		{"fashion", "Brush-color mood board", "Household hues count too.", "street", "palette"},
		{"fashion", "Bathroom statement hoops", "Shine even in steam.", "street", "hoops"},
	}
}

func cannedLalemTrends(locale string) []LalemTrend {
	specs := cannedLalemTrendSpecs(lalemLocale(locale))
	out := make([]LalemTrend, 0, len(specs))
	for _, s := range specs {
		out = append(out, LalemTrend{
			Kind:      s.Kind,
			Title:     s.Title,
			Hook:      s.Hook,
			ImageHint: s.ImageHint,
			Chips:     []string{s.Chip},
		})
	}
	return out
}

// PadLalemTrendsToFloor appends unused canned titles until there are at least
// `floor` unique titles, cycling the local JPEG pool. Live titles stay first.
func PadLalemTrendsToFloor(existing []LalemTrend, locale string, floor int) []LalemTrend {
	if floor <= 0 {
		floor = LalemTrendFloor
	}
	seen := map[string]struct{}{}
	out := make([]LalemTrend, 0, floor)
	for _, tr := range existing {
		title := strings.TrimSpace(tr.Title)
		if title == "" {
			continue
		}
		if _, ok := seen[title]; ok {
			continue
		}
		seen[title] = struct{}{}
		tr.Title = title
		out = append(out, tr)
	}
	pool := LalemTrendImagePool()
	idx := len(out)
	for _, c := range cannedLalemTrends(locale) {
		if len(out) >= floor {
			break
		}
		title := strings.TrimSpace(c.Title)
		if title == "" {
			continue
		}
		if _, ok := seen[title]; ok {
			continue
		}
		seen[title] = struct{}{}
		if len(pool) > 0 {
			c.ImageURL = RewriteLalemTrendImage(pool[idx%len(pool)])
			idx++
		}
		out = append(out, c)
	}
	for i := range out {
		out[i].ImageURL = RewriteLalemTrendImage(out[i].ImageURL)
		if strings.TrimSpace(out[i].ImageURL) == "" && len(pool) > 0 {
			out[i].ImageURL = pool[i%len(pool)]
		}
	}
	return out
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
