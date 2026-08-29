package ai

import (
	"strings"
	"time"
)

// ParseNation maps request/storage values to us | cn.
func ParseNation(raw string) string {
	v := strings.ToLower(strings.TrimSpace(raw))
	switch v {
	case "cn", "china", "zh", "zh-cn", "zh_cn", "zh-hans":
		return "cn"
	default:
		return "us"
	}
}

func contextSlug(context string) string {
	s := strings.TrimSpace(context)
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = strings.TrimSpace(s[:i])
	}
	if i := strings.Index(s, "[nation:"); i >= 0 {
		s = strings.TrimSpace(s[:i])
	}
	return s
}

func nationFromContext(context string) string {
	lower := strings.ToLower(context)
	if strings.Contains(lower, "[nation:cn]") {
		return "cn"
	}
	return "us"
}

// PlaceTagLanguageSuffix requires Simplified Chinese briefs when nation is cn.
func PlaceTagLanguageSuffix(nation string) string {
	if ParseNation(nation) == "cn" {
		return "请用简体中文撰写这份地图标记情报简报。"
	}
	return "Write this map-tag brief in English."
}

func replyLanguageInstruction(nation string) string {
	if ParseNation(nation) == "cn" {
		return "请用简体中文回复。所有产品文案与情报摘要必须使用简体中文。"
	}
	return "Reply in English."
}

func googleNewsLocale(nation string) string {
	if ParseNation(nation) == "cn" {
		return "hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
	}
	return "hl=en-US&gl=US&ceid=US:en"
}

func mysterySearchQueries(nation string) []string {
	if ParseNation(nation) == "cn" {
		return []string{
			`中国 失踪人员 公安`,
			`中国 寻人 协查`,
			`中国 积案 命案`,
			`中国 在逃 通缉`,
			`中国 未破 刑事案件`,
			`China missing person police`,
			`China fugitive wanted`,
		}
	}
	return []string{
		`missing person United States`,
		`missing persons America police`,
		`cold case unsolved murder United States`,
		`fugitive wanted "at large" United States`,
		`unsolved crime police United States`,
		`"NamUs" missing`,
		`FBI most wanted United States`,
	}
}

func intelSearchQueries(nation string) []string {
	if ParseNation(nation) == "cn" {
		return []string{
			`中国 犯罪 新闻`,
			`中国 公安 破案`,
			`中国 积案 告破`,
			`中国 在逃 抓获`,
			`中国 命案 侦破`,
			`中国 失踪人员 找到`,
			`China crime police`,
			`China homicide investigation`,
		}
	}
	return []string{
		`crime news United States`,
		`police investigation breakthrough`,
		`"cold case" solved`,
		`cold case solved murder`,
		`fugitive captured OR arrested`,
		`international crime police`,
		`major crime Europe OR Asia OR Africa OR "Latin America"`,
		`homicide investigation update`,
		`serial offender arrested`,
		`missing person found police`,
	}
}

func briefingSearchQueries(nation string) []string {
	if ParseNation(nation) == "cn" {
		return []string{
			`中国 失踪人员 通报`,
			`中国 积案 进展`,
			`中国 在逃 抓获 OR 仍在逃`,
			`中国 公安 通缉`,
		}
	}
	return []string{
		`missing person update United States`,
		`cold case breakthrough United States`,
		`fugitive captured OR "still at large" United States`,
		`NamUs missing person`,
		`FBI most wanted United States`,
	}
}

func chinaStarterCases() []structuredCase {
	now := time.Now().UTC()
	return []structuredCase{
		{
			Title:      "全国公安机关发布寻人协查通报",
			Category:   "missing_person",
			Location:   "中国",
			Date:       now.Format("2006-01-02"),
			Summary:    "各地公安继续发布近期失踪人员协查信息。请关注公安部及地方警方官方通报，勿采信未经核实的传言。",
			Status:     "失踪",
			SourceURL:  "https://www.mps.gov.cn/",
			SourceName: "公安部",
		},
		{
			Title:      "多地刑侦部门推进积案攻坚",
			Category:   "cold_case",
			Location:   "中国",
			Date:       now.AddDate(0, -1, 0).Format("2006-01-02"),
			Summary:    "公安机关运用法医物证与技侦手段复核未破命案。新线索以官方发布为准。",
			Status:     "积案",
			SourceURL:  "https://www.mps.gov.cn/",
			SourceName: "公安部刑侦",
		},
		{
			Title:      "在逃人员仍在网上追逃名单",
			Category:   "fugitive",
			Location:   "中国",
			Date:       now.AddDate(0, 0, -7).Format("2006-01-02"),
			Summary:    "多名暴力犯罪在逃人员仍被列为网上追逃对象。执勤前请核对最新通缉信息。",
			Status:     "通缉",
			SourceURL:  "https://www.mps.gov.cn/",
			SourceName: "网上追逃",
		},
		{
			Title:      "未破刑事案件继续征集线索",
			Category:   "unsolved_crime",
			Location:   "中国",
			Date:       now.AddDate(0, -2, 0).Format("2006-01-02"),
			Summary:    "各地继续就近期未破抢劫、伤害等案件向群众征集线索。举报请走官方渠道。",
			Status:     "未破",
			SourceURL:  "https://www.mps.gov.cn/",
			SourceName: "地方公安",
		},
	}
}

func usStarterCases() []structuredCase {
	now := time.Now().UTC()
	return []structuredCase{
		{
			Title:      "Active missing-person reports tracked nationwide",
			Category:   "missing_person",
			Location:   "United States",
			Date:       now.Format("2006-01-02"),
			Summary:    "Police desks continue working recent missing-person cases across multiple states. Check NamUs and local PD bulletins for the latest confirmed updates.",
			Status:     "Missing",
			SourceURL:  "https://www.namus.gov/",
			SourceName: "NamUs",
		},
		{
			Title:      "Cold case units reopen unsolved homicide files",
			Category:   "cold_case",
			Location:   "United States",
			Date:       now.AddDate(0, -1, 0).Format("2006-01-02"),
			Summary:    "Investigators are applying modern DNA and genealogy methods to older unsolved murders. Agencies periodically release new public tips as forensic work advances.",
			Status:     "Cold Case",
			SourceURL:  "https://www.fbi.gov/wanted",
			SourceName: "FBI",
		},
		{
			Title:      "Fugitives remain on federal and state wanted lists",
			Category:   "fugitive",
			Location:   "United States",
			Date:       now.AddDate(0, 0, -7).Format("2006-01-02"),
			Summary:    "Multiple suspects wanted for violent crimes remain at large. Officers should review current FBI Most Wanted and state fugitive bulletins before patrol briefings.",
			Status:     "Wanted",
			SourceURL:  "https://www.fbi.gov/wanted/topten",
			SourceName: "FBI Most Wanted",
		},
		{
			Title:      "Unsolved violent crimes still seeking public tips",
			Category:   "unsolved_crime",
			Location:   "United States",
			Date:       now.AddDate(0, -2, 0).Format("2006-01-02"),
			Summary:    "Departments continue soliciting information on recent unsolved assaults and robberies. Tip lines and Crime Stoppers remain primary intake channels.",
			Status:     "Unsolved",
			SourceURL:  "https://crimestoppersusa.org/",
			SourceName: "Crime Stoppers",
		},
	}
}
