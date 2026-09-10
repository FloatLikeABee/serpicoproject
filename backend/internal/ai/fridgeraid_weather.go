package ai

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const defaultOpenMeteoURL = "https://api.open-meteo.com/v1/forecast"

// WeatherSnapshot is current climate for TCM chips. Unavailable means season-only.
type WeatherSnapshot struct {
	Label       string
	TempC       float64
	Unavailable bool
}

func openMeteoHTTPClient() *http.Client {
	return &http.Client{Timeout: 2 * time.Second}
}

// FetchOpenMeteoWeather reads current temp/humidity/weather/wind.
// On HTTP or decode failure it returns Unavailable rather than an error.
func FetchOpenMeteoWeather(client *http.Client, baseURL string, lat, lon float64) (*WeatherSnapshot, error) {
	if client == nil {
		client = openMeteoHTTPClient()
	}
	if strings.TrimSpace(baseURL) == "" {
		baseURL = defaultOpenMeteoURL
	}
	u, err := url.Parse(baseURL)
	if err != nil {
		return &WeatherSnapshot{Unavailable: true}, nil
	}
	if u.Path == "" || u.Path == "/" {
		u.Path = "/v1/forecast"
	}
	q := u.Query()
	q.Set("latitude", strconv.FormatFloat(lat, 'f', 4, 64))
	q.Set("longitude", strconv.FormatFloat(lon, 'f', 4, 64))
	q.Set("current", "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m")
	u.RawQuery = q.Encode()

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return &WeatherSnapshot{Unavailable: true}, nil
	}
	resp, err := client.Do(req)
	if err != nil {
		return &WeatherSnapshot{Unavailable: true}, nil
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return &WeatherSnapshot{Unavailable: true}, nil
	}
	var parsed struct {
		Current struct {
			Temperature float64 `json:"temperature_2m"`
			Humidity    float64 `json:"relative_humidity_2m"`
			WeatherCode int     `json:"weather_code"`
			WindSpeed   float64 `json:"wind_speed_10m"`
		} `json:"current"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return &WeatherSnapshot{Unavailable: true}, nil
	}
	label := MapTCMClimate(parsed.Current.Temperature, parsed.Current.Humidity, parsed.Current.WindSpeed, parsed.Current.WeatherCode)
	return &WeatherSnapshot{Label: label, TempC: parsed.Current.Temperature}, nil
}

// MapTCMClimate maps Open-Meteo current conditions to 寒/热/湿/燥/风 (possibly combined).
func MapTCMClimate(tempC, humidity, windMS float64, weatherCode int) string {
	hot := tempC >= 28
	cold := tempC <= 8
	damp := humidity >= 70 || isPrecipCode(weatherCode)
	dry := humidity > 0 && humidity <= 40 && !damp && !isPrecipCode(weatherCode)
	windy := windMS >= 8

	parts := make([]string, 0, 4)
	if cold {
		parts = append(parts, "寒")
	} else if hot {
		parts = append(parts, "热")
	}
	if damp {
		parts = append(parts, "湿")
	} else if dry {
		parts = append(parts, "燥")
	}
	if windy {
		parts = append(parts, "风")
	}
	if len(parts) == 0 {
		if tempC >= 22 {
			return "热"
		}
		return "寒"
	}
	return strings.Join(parts, "")
}

func isPrecipCode(code int) bool {
	switch {
	case code >= 51 && code <= 67:
		return true
	case code >= 80 && code <= 82:
		return true
	case code >= 95 && code <= 99:
		return true
	default:
		return false
	}
}
