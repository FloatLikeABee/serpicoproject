package ai

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestChinaStarterCasesAreNotUSNamUs(t *testing.T) {
	starters := chinaStarterCases()
	if len(starters) == 0 {
		t.Fatal("expected CN starters")
	}
	for _, c := range starters {
		if c.SourceName == "NamUs" || c.SourceName == "FBI" || c.Location == "United States" {
			t.Fatalf("US fallback leaked into CN starters: %+v", c)
		}
	}
}

func TestMysteryNewsQueriesCN(t *testing.T) {
	q := mysterySearchQueries("cn")
	joined := ""
	for _, s := range q {
		joined += s
	}
	if !containsAny(joined, "中国", "失踪", "China") {
		t.Fatalf("CN queries look US-only: %v", q)
	}
	us := mysterySearchQueries("us")
	usJoin := ""
	for _, s := range us {
		usJoin += s
	}
	if containsAny(usJoin, "NamUs") == false && containsAny(usJoin, "United States") == false {
		t.Fatalf("US queries lost US terms: %v", us)
	}
}

func TestListCasesNationCNDoesNotReturnUSNamUs(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	_, err = db.Exec(`CREATE TABLE mystery_cases (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		category TEXT NOT NULL,
		location TEXT NOT NULL,
		date TEXT NOT NULL,
		summary TEXT,
		status TEXT,
		source_url TEXT,
		source_name TEXT,
		last_update TEXT,
		nation TEXT DEFAULT 'us',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO mystery_cases
		(id, title, category, location, date, summary, status, source_url, source_name, last_update, created_at, updated_at, nation)
		VALUES ('us1','NamUs nationwide','missing_person','United States','2026-01-01','x','Missing','https://namus.gov','NamUs','2026-01-01','2026-01-01','2026-01-01','us')`)
	if err != nil {
		t.Fatal(err)
	}
	s := &MysteriesService{db: db}
	if err := s.ensureStarterCasesNation("cn"); err != nil {
		t.Fatal(err)
	}
	list, err := s.queryCases("all", "cn")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) == 0 {
		t.Fatal("expected CN starters")
	}
	for _, c := range list {
		if c.SourceName == "NamUs" || c.SourceName == "FBI" || c.Location == "United States" {
			t.Fatalf("US fallback leaked into CN list: %+v", c)
		}
	}
}

func containsAny(hay string, needles ...string) bool {
	for _, n := range needles {
		if n != "" && len(hay) > 0 {
			for i := 0; i+len(n) <= len(hay); i++ {
				if hay[i:i+len(n)] == n {
					return true
				}
			}
		}
	}
	return false
}
