package ai

import "testing"

func TestNeedsCrimeDataWebSearch_CrimeKeywords(t *testing.T) {
	if !NeedsCrimeDataWebSearch("What are recent arrests in Olathe?", "") {
		t.Fatal("expected crime keyword query to need web search")
	}
	if !NeedsCrimeDataWebSearch("Show me active pursuits", "in-pursue") {
		t.Fatal("expected pursuit query to need web search")
	}
}

func TestNeedsCrimeDataWebSearch_SkipsGeneralChat(t *testing.T) {
	if NeedsCrimeDataWebSearch("Hello", "") {
		t.Fatal("greeting should not trigger web search")
	}
	if NeedsCrimeDataWebSearch("How do I use this app?", "in-pursue") {
		t.Fatal("general help should not trigger web search")
	}
	if NeedsCrimeDataWebSearch("Thanks", "") {
		t.Fatal("short thanks should not trigger web search")
	}
}

func TestNeedsCrimeDataWebSearch_ContextInfoSeeking(t *testing.T) {
	if !NeedsCrimeDataWebSearch("What do you know?", "nearby-perps") {
		t.Fatal("info-seeking in crime context should trigger web search")
	}
	if NeedsCrimeDataWebSearch("What do you know?", "mysteries") {
		t.Fatal("info-seeking outside crime contexts should not auto-trigger without keywords")
	}
}
