package ai

import (
	"net/url"
	"strings"
)

func MapLalemTrendTopic(title, hook, given string) string {
	if id, ok := knownLalemTopic(strings.TrimSpace(given)); ok {
		return id
	}
	blob := title + "\n" + hook
	low := strings.ToLower(blob)
	tok := lalemLatinTokens(low)
	switch {
	case strings.Contains(blob, "痔") || lalemHasPrefix(tok, "hemorrhoid") || tok["piles"]:
		return "medicine:hemorrhoids"
	case strings.Contains(blob, "便秘") || lalemHasPrefix(tok, "constipat"):
		return "medicine:constipation"
	case strings.Contains(blob, "盆底") || tok["pelvic"]:
		return "medicine:pelvic-floor"
	case strings.Contains(blob, "瓦氏") || tok["valsalva"] || strings.Contains(blob, "用力过猛") || tok["straining"]:
		return "medicine:straining-valsalva"
	case strings.Contains(blob, "脚凳") || tok["footstool"] || tok["squatty"]:
		return "medicine:footstool-lean"
	case strings.Contains(blob, "蹲") || tok["squat"] || tok["squats"] || tok["squatting"] || strings.Contains(blob, "坐姿"):
		return "medicine:posture-squat-sit"
	case strings.Contains(blob, "海绵棒") || lalemHasPrefix(tok, "xylospong"):
		return "paper:xylospongium"
	case strings.Contains(blob, "厕筹"):
		return "paper:chu-chou"
	case strings.Contains(blob, "湿纸巾") || strings.Contains(low, "wet wipe"):
		return "paper:wet-wipe"
	case strings.Contains(blob, "坐浴") || tok["bidet"]:
		return "paper:bidet"
	case strings.Contains(blob, "喷枪") || tok["sprayer"] || strings.Contains(low, "bum gun"):
		return "paper:bum-gun"
	case strings.Contains(blob, "厕纸") || strings.Contains(blob, "卷纸") || strings.Contains(low, "toilet paper"):
		return "paper:roll-paper"
	case strings.Contains(blob, "智洁") || tok["washlet"]:
		return "toilet:japan-washlet"
	case strings.Contains(blob, "罗马") || tok["forica"] || tok["latrine"]:
		return "toilet:roman-forica"
	default:
		return ""
	}
}

func lalemLatinTokens(low string) map[string]bool {
	out := map[string]bool{}
	var b strings.Builder
	flush := func() {
		if b.Len() == 0 {
			return
		}
		out[b.String()] = true
		b.Reset()
	}
	for _, r := range low {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			b.WriteRune(r)
		} else {
			flush()
		}
	}
	flush()
	return out
}

func lalemHasPrefix(tok map[string]bool, prefix string) bool {
	for word := range tok {
		if strings.HasPrefix(word, prefix) {
			return true
		}
	}
	return false
}

func knownLalemTopic(id string) (string, bool) {
	kind, key, ok := splitLalemTopic(id)
	if !ok {
		return "", false
	}
	switch kind {
	case "toilet":
		for _, item := range LalemToilets() {
			if item.ID == key {
				return id, true
			}
		}
	case "paper":
		for _, item := range LalemPapers() {
			if item.ID == key {
				return id, true
			}
		}
	case "medicine":
		for _, item := range LalemMedicineArticles() {
			if item.ID == key {
				return id, true
			}
		}
	}
	return "", false
}

func splitLalemTopic(id string) (kind, key string, ok bool) {
	kind, key, found := strings.Cut(strings.TrimSpace(id), ":")
	if !found || kind == "" || key == "" {
		return "", "", false
	}
	return kind, key, true
}

func lalemWikiHostOK(raw, wantHost string) bool {
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	return u.Scheme == "https" && u.Host == wantHost && strings.Trim(u.Path, "/") != ""
}

func lalemOrgHostOK(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	if u.Scheme != "https" {
		return false
	}
	host := strings.ToLower(u.Host)
	for _, allow := range []string{"nhs.uk", "mayoclinic.org", "medlineplus.gov", "clevelandclinic.org", "who.int"} {
		if host == allow || strings.HasSuffix(host, "."+allow) {
			return true
		}
	}
	return false
}
