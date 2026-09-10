package ai

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
)

func TestFetchOpenMeteoHotDamp(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lat, _ := strconv.ParseFloat(r.URL.Query().Get("latitude"), 64)
		if lat < 31.1 || lat > 31.3 {
			t.Errorf("lat=%s", r.URL.Query().Get("latitude"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"current":{"temperature_2m":33.4,"relative_humidity_2m":82,"weather_code":61,"wind_speed_10m":2.1}}`))
	}))
	t.Cleanup(srv.Close)

	got, err := FetchOpenMeteoWeather(srv.Client(), srv.URL, 31.2, 121.5)
	if err != nil {
		t.Fatal(err)
	}
	if got.Unavailable {
		t.Fatal("hot-damp should be available")
	}
	if got.TempC < 33 || got.TempC > 34 {
		t.Fatalf("temp=%v", got.TempC)
	}
	if got.Label != "热湿" && got.Label != "湿热" {
		if got.Label != "热" && got.Label != "湿" {
			t.Fatalf("label=%q want 热 and/or 湿", got.Label)
		}
	}
	if !containsRuneLabel(got.Label, '热') || !containsRuneLabel(got.Label, '湿') {
		t.Fatalf("label=%q should include 热 and 湿", got.Label)
	}
}

func TestFetchOpenMeteoFailureUnavailable(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	t.Cleanup(srv.Close)

	got, err := FetchOpenMeteoWeather(srv.Client(), srv.URL, 40.0, -74.0)
	if err != nil {
		t.Fatal(err)
	}
	if !got.Unavailable {
		t.Fatalf("expected weatherUnavailable fallback, got %+v", got)
	}
	if got.Label != "" {
		t.Fatalf("unavailable snapshot should not invent a climate label: %+v", got)
	}
}

func containsRuneLabel(s string, r rune) bool {
	for _, c := range s {
		if c == r {
			return true
		}
	}
	return false
}
