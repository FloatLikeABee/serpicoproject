package agentboard

import (
	"database/sql"
	"math/rand"
	"strings"
	"time"

	"github.com/google/uuid"
)

var pinIcons = []string{"moth", "tram", "lantern", "ferry", "kettle", "finch", "comet", "anchor", "maple", "otter", "biscuit", "heron"}

var nameAdjectives = []string{
	"Marmalade", "Lantern", "Salted", "Velvet", "Paper", "Midnight", "Cinder", "Willow", "Copper", "Quiet",
	"Bramble", "Honey", "Moss", "Amber", "Silver", "Saffron", "Drift", "Nimbus", "Pocket", "Cedar",
}

var nameNouns = []string{
	"Moth", "Carp", "Tram", "Kettle", "Comet", "Otter", "Finch", "Badger", "Ferry", "Sparrow",
	"Fox", "Heron", "Biscuit", "Anchor", "Cricket", "Maple", "Pebble", "Lark", "Newt", "Pippin",
}

type Identity struct {
	ID       string `json:"id"`
	Nickname string `json:"nickname"`
}

func PickPinIcon() string {
	return pinIcons[rand.Intn(len(pinIcons))]
}

func ClaimIdentity(db *sql.DB, now time.Time) (Identity, error) {
	for i := 0; i < 40; i++ {
		nickname := nameAdjectives[rand.Intn(len(nameAdjectives))] + " " + nameNouns[rand.Intn(len(nameNouns))]
		ident := Identity{ID: uuid.NewString(), Nickname: nickname}
		_, err := db.Exec(`INSERT INTO agent_identities (id, nickname, created_at) VALUES (?, ?, ?)`,
			ident.ID, ident.Nickname, now.UTC().Format(time.RFC3339Nano))
		if err == nil {
			return ident, nil
		}
		if !strings.Contains(strings.ToLower(err.Error()), "unique") {
			return Identity{}, err
		}
	}
	ident := Identity{ID: uuid.NewString(), Nickname: "Pocket Pippin " + uuid.NewString()[:4]}
	_, err := db.Exec(`INSERT INTO agent_identities (id, nickname, created_at) VALUES (?, ?, ?)`,
		ident.ID, ident.Nickname, now.UTC().Format(time.RFC3339Nano))
	return ident, err
}

func LookupIdentity(db *sql.DB, id string) (Identity, error) {
	var ident Identity
	err := db.QueryRow(`SELECT id, nickname FROM agent_identities WHERE id = ?`, strings.TrimSpace(id)).Scan(&ident.ID, &ident.Nickname)
	if err == sql.ErrNoRows {
		return Identity{}, ValidationError{Msg: "agent id is not known"}
	}
	return ident, err
}
