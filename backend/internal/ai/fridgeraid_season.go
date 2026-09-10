package ai

import "time"

// SeasonInfo is calendar season plus an approximate solar term.
type SeasonInfo struct {
	Name      string // spring, summer, lateSummer, autumn, winter
	SolarTerm string
}

type solarTerm struct {
	month int
	day   int
	name  string
}

// Approximate northern solar-term starts (month-day).
var solarTerms = []solarTerm{
	{1, 6, "小寒"},
	{1, 20, "大寒"},
	{2, 4, "立春"},
	{2, 19, "雨水"},
	{3, 6, "惊蛰"},
	{3, 21, "春分"},
	{4, 5, "清明"},
	{4, 20, "谷雨"},
	{5, 6, "立夏"},
	{5, 21, "小满"},
	{6, 6, "芒种"},
	{6, 21, "夏至"},
	{7, 7, "小暑"},
	{7, 23, "大暑"},
	{8, 8, "立秋"},
	{8, 23, "处暑"},
	{9, 8, "白露"},
	{9, 23, "秋分"},
	{10, 8, "寒露"},
	{10, 23, "霜降"},
	{11, 7, "立冬"},
	{11, 22, "小雪"},
	{12, 7, "大雪"},
	{12, 22, "冬至"},
}

// SeasonForDate returns meteorological season. Negative latitude inverts it.
// Nil latitude defaults to the northern hemisphere.
func SeasonForDate(when time.Time, lat *float64) SeasonInfo {
	north := northSeason(when)
	term := solarTermFor(when)
	if lat != nil && *lat < 0 {
		return SeasonInfo{Name: invertSeason(north), SolarTerm: ""}
	}
	return SeasonInfo{Name: north, SolarTerm: term}
}

func northSeason(when time.Time) string {
	md := int(when.Month())*100 + when.Day()
	// 长夏: 小暑 through 处暑 eve (~Jul 7 – Aug 22)
	if md >= 707 && md < 823 {
		return "lateSummer"
	}
	switch when.Month() {
	case time.March, time.April, time.May:
		return "spring"
	case time.June, time.July, time.August:
		return "summer"
	case time.September, time.October, time.November:
		return "autumn"
	default:
		return "winter"
	}
}

func invertSeason(name string) string {
	switch name {
	case "spring":
		return "autumn"
	case "summer", "lateSummer":
		return "winter"
	case "autumn":
		return "spring"
	default:
		return "summer"
	}
}

func solarTermFor(when time.Time) string {
	md := int(when.Month())*100 + when.Day()
	current := solarTerms[len(solarTerms)-1].name
	for _, st := range solarTerms {
		key := st.month*100 + st.day
		if md >= key {
			current = st.name
		}
	}
	return current
}
