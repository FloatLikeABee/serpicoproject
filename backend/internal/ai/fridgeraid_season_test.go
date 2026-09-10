package ai

import (
	"testing"
	"time"
)

func TestSeasonNorthernSummer(t *testing.T) {
	got := SeasonForDate(time.Date(2026, 7, 15, 12, 0, 0, 0, time.UTC), nil)
	if got.Name != "summer" && got.Name != "lateSummer" {
		t.Fatalf("northern July season=%q, want summer or lateSummer", got.Name)
	}
	if got.SolarTerm == "" {
		t.Fatal("expected a solar term for mid-July")
	}
}

func TestSeasonSouthernJulyIsWinter(t *testing.T) {
	lat := -33.9
	got := SeasonForDate(time.Date(2026, 7, 15, 12, 0, 0, 0, time.UTC), &lat)
	if got.Name != "winter" {
		t.Fatalf("southern July season=%q, want winter", got.Name)
	}
}

func TestSeasonOmittedLatDefaultsNorth(t *testing.T) {
	got := SeasonForDate(time.Date(2026, 1, 10, 12, 0, 0, 0, time.UTC), nil)
	if got.Name != "winter" {
		t.Fatalf("omitted lat January season=%q, want winter (north default)", got.Name)
	}
}
