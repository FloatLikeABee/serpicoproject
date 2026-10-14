package agentboard

import (
	"strings"
	"testing"
	"time"
)

func TestRobocopNoteAcceptsAPursueKindAndRefusesAnUnknownKind(t *testing.T) {
	db := openBoard(t)
	now := time.Date(2026, 10, 14, 1, 0, 0, 0, time.UTC)
	note, err := InsertRobocop(db, RobocopInput{
		AgentName: "Amber Lark",
		Kind:      "witness",
		PlaceName: "Alfama stair",
		Lat:       38.71,
		Lng:       -9.13,
		Body:      "A red sedan idled at the bottom of the stair.",
	}, now)
	if err != nil {
		t.Fatal(err)
	}
	if note.ID == "" || note.PlaceName != "Alfama stair" || note.Kind != "witness" || note.Body != "A red sedan idled at the bottom of the stair." {
		t.Fatalf("note %+v", note)
	}
	_, err = InsertRobocop(db, RobocopInput{
		AgentName: "Amber Lark",
		Kind:      "spaceship",
		PlaceName: "Dock",
		Lat:       1,
		Lng:       2,
		Body:      "not a pin kind",
	}, now)
	if err == nil || !strings.Contains(err.Error(), "kind") {
		t.Fatalf("unknown kind err %v", err)
	}
	long := strings.Repeat("n", 801)
	_, err = InsertRobocop(db, RobocopInput{
		AgentName: "Amber Lark",
		Kind:      "witness",
		PlaceName: "Dock",
		Lat:       1,
		Lng:       2,
		Body:      long,
	}, now)
	if err == nil || !strings.Contains(err.Error(), "too long") {
		t.Fatalf("long body err %v", err)
	}
}

func TestRobocopNoteUsesClaimedNickname(t *testing.T) {
	db := openBoard(t)
	now := time.Date(2026, 10, 14, 1, 0, 0, 0, time.UTC)
	ident, err := ClaimIdentity(db, now)
	if err != nil {
		t.Fatal(err)
	}
	note, err := InsertRobocop(db, RobocopInput{
		AgentName: "Not The Nickname",
		AgentID:   ident.ID,
		Kind:      "evidence",
		PlaceName: "Rua da Bica",
		Lat:       38.71,
		Lng:       -9.14,
		Body:      "A paper bag sat on the step.",
	}, now)
	if err != nil {
		t.Fatal(err)
	}
	if note.AgentName != ident.Nickname || note.AgentName == "Not The Nickname" {
		t.Fatalf("name %q want %q", note.AgentName, ident.Nickname)
	}
}
