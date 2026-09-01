package database

import (
	"testing"
)

func TestInitializeCreatesHardwareRegistryTable(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("DATA_DIR", dir)
	db, err := Initialize()
	if err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	defer db.Close()

	var name string
	err = db.SQLite.QueryRow(
		`SELECT name FROM sqlite_master WHERE type='table' AND name='hardware_registry'`,
	).Scan(&name)
	if err != nil {
		t.Fatalf("hardware_registry table missing: %v", err)
	}
	if name != "hardware_registry" {
		t.Fatalf("got table %q", name)
	}
}

func TestOpenSQLiteCreatesHardwareRegistryTable(t *testing.T) {
	db, err := OpenSQLite(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var name string
	if err := db.SQLite.QueryRow(
		`SELECT name FROM sqlite_master WHERE type='table' AND name='hardware_registry'`,
	).Scan(&name); err != nil {
		t.Fatalf("table: %v", err)
	}
}

func TestRegisterHardwareIdempotentAndInvalid(t *testing.T) {
	db, err := OpenSQLite(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	first, created, err := RegisterHardware(db.SQLite, "sn-1001")
	if err != nil || !created {
		t.Fatalf("first: created=%v err=%v", created, err)
	}
	if first.Serial != "SN-1001" || first.Topic != "serpico/hard-data/hw/SN-1001" {
		t.Fatalf("device %+v", first)
	}

	second, created, err := RegisterHardware(db.SQLite, " SN-1001 ")
	if err != nil || created {
		t.Fatalf("second: created=%v err=%v", created, err)
	}
	if second.ID != first.ID || second.Topic != first.Topic {
		t.Fatalf("want same row, got %+v vs %+v", second, first)
	}

	list, err := ListHardware(db.SQLite)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 {
		t.Fatalf("want 1 device, got %d", len(list))
	}

	got, err := GetHardware(db.SQLite, first.ID)
	if err != nil || got.Topic != first.Topic {
		t.Fatalf("get: %+v %v", got, err)
	}

	if _, _, err := RegisterHardware(db.SQLite, "  "); err != ErrHardwareSerialEmpty {
		t.Fatalf("empty: %v", err)
	}
	if _, _, err := RegisterHardware(db.SQLite, "bad serial!"); err != ErrHardwareSerialInvalid {
		t.Fatalf("invalid: %v", err)
	}
	if _, err := GetHardware(db.SQLite, "missing"); err != ErrHardwareNotFound {
		t.Fatalf("missing: %v", err)
	}
}

func TestListHardDataByTopicExcludesOthers(t *testing.T) {
	db, err := OpenSQLite(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	topic := "serpico/hard-data/hw/SN-1001"
	if _, err := InsertHardData(db.SQLite, topic, "keep-mqtt", HardDataSourceMQTT); err != nil {
		t.Fatal(err)
	}
	if _, err := InsertHardData(db.SQLite, "serpico/hard-data/demo", "other", HardDataSourceMQTT); err != nil {
		t.Fatal(err)
	}
	list, err := ListHardDataByTopic(db.SQLite, topic, 50)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].Payload != "keep-mqtt" || list[0].Source != HardDataSourceMQTT {
		t.Fatalf("filtered %+v", list)
	}
}
