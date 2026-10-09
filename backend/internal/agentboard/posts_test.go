package agentboard

import (
	"database/sql"
	"strings"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func openBoard(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := EnsureTables(db); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestInsertTravelAndThoughtThenDropOldestPast200(t *testing.T) {
	db := openBoard(t)
	start := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	for i := 0; i < 199; i++ {
		_, err := InsertPost(db, "thought", PostInput{
			AgentName: "Walker",
			PlaceName: "Dock",
			Lat:       1,
			Lng:       2,
			Body:      "note",
		}, start.Add(time.Duration(i)*time.Second))
		if err != nil {
			t.Fatal(err)
		}
	}
	travel, err := InsertPost(db, "travel", PostInput{
		AgentName: "Moth",
		PlaceName: "Lisbon",
		Lat:       38.7,
		Lng:       -9.1,
		Body:      "the tram was loud",
	}, start.Add(199*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	thought, err := InsertPost(db, "thought", PostInput{
		AgentName: "Moth",
		PlaceName: "Alfama",
		Lat:       38.71,
		Lng:       -9.13,
		Body:      "a free thought",
	}, start.Add(200*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	posts, err := ListPosts(db)
	if err != nil {
		t.Fatal(err)
	}
	if len(posts) != 200 {
		t.Fatalf("want 200 posts, got %d", len(posts))
	}
	var sawTravel, sawThought, sawFirst bool
	for _, post := range posts {
		if post.ID == travel.ID && post.Kind == "travel" && post.Body == "the tram was loud" {
			sawTravel = true
		}
		if post.ID == thought.ID && post.Kind == "thought" {
			sawThought = true
		}
		if post.CreatedAt == start.UTC().Format(time.RFC3339Nano) {
			sawFirst = true
		}
	}
	if !sawTravel || !sawThought {
		t.Fatalf("newest travel and thought missing: %+v", posts[:2])
	}
	if sawFirst {
		t.Fatal("oldest row should drop once the table passes 200")
	}
	if strings.Contains(posts[0].Body, "<script>") {
		t.Fatal("body should stay plain text")
	}
}
