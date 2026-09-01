package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"serpico/backend/internal/database"
)

func TestAdminHardwareRegisterListIdempotent(t *testing.T) {
	r, _ := hardDataTestRouter(t)

	body := `{"serial":"SN-1001"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/hardware", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("POST status %d: %s", w.Code, w.Body.String())
	}
	var created database.HardwareDevice
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Topic != "serpico/hard-data/hw/SN-1001" || created.Serial != "SN-1001" {
		t.Fatalf("created %+v", created)
	}

	again := httptest.NewRequest(http.MethodPost, "/api/v1/admin/hardware", strings.NewReader(`{"serial":"sn-1001"}`))
	again.Header.Set("Content-Type", "application/json")
	aw := httptest.NewRecorder()
	r.ServeHTTP(aw, again)
	if aw.Code != http.StatusOK {
		t.Fatalf("idempotent status %d: %s", aw.Code, aw.Body.String())
	}
	var existing database.HardwareDevice
	if err := json.Unmarshal(aw.Body.Bytes(), &existing); err != nil {
		t.Fatal(err)
	}
	if existing.ID != created.ID || existing.Topic != created.Topic {
		t.Fatalf("want same topic, got %+v", existing)
	}

	empty := httptest.NewRequest(http.MethodPost, "/api/v1/admin/hardware", strings.NewReader(`{"serial":""}`))
	empty.Header.Set("Content-Type", "application/json")
	ew := httptest.NewRecorder()
	r.ServeHTTP(ew, empty)
	if ew.Code != http.StatusBadRequest {
		t.Fatalf("empty status %d", ew.Code)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/admin/hardware", nil)
	lw := httptest.NewRecorder()
	r.ServeHTTP(lw, listReq)
	if lw.Code != http.StatusOK {
		t.Fatalf("list %d: %s", lw.Code, lw.Body.String())
	}
	var listed struct {
		Devices []database.HardwareDevice `json:"devices"`
	}
	if err := json.Unmarshal(lw.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed.Devices) != 1 {
		t.Fatalf("want 1 device, got %+v", listed.Devices)
	}
}

func TestAdminHardwareMessagesTopicScoped(t *testing.T) {
	r, db := hardDataTestRouter(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/hardware", strings.NewReader(`{"serial":"SN-1001"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	var device database.HardwareDevice
	if err := json.Unmarshal(w.Body.Bytes(), &device); err != nil {
		t.Fatal(err)
	}

	if _, err := database.InsertHardData(db.SQLite, device.Topic, "keep-mqtt", database.HardDataSourceMQTT); err != nil {
		t.Fatal(err)
	}
	if _, err := database.InsertHardData(db.SQLite, "serpico/hard-data/demo", "other-topic", database.HardDataSourceMQTT); err != nil {
		t.Fatal(err)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/admin/hardware/"+device.ID, nil)
	gw := httptest.NewRecorder()
	r.ServeHTTP(gw, getReq)
	if gw.Code != http.StatusOK {
		t.Fatalf("get %d: %s", gw.Code, gw.Body.String())
	}

	msgReq := httptest.NewRequest(http.MethodGet, "/api/v1/admin/hardware/"+device.ID+"/messages", nil)
	mw := httptest.NewRecorder()
	r.ServeHTTP(mw, msgReq)
	if mw.Code != http.StatusOK {
		t.Fatalf("messages %d: %s", mw.Code, mw.Body.String())
	}
	var listed struct {
		Records []database.HardDataRecord `json:"records"`
	}
	if err := json.Unmarshal(mw.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed.Records) != 1 || listed.Records[0].Payload != "keep-mqtt" || listed.Records[0].Source != "mqtt" {
		t.Fatalf("messages %+v", listed.Records)
	}
	for _, rec := range listed.Records {
		if rec.Payload == "other-topic" {
			t.Fatal("other topic leaked into device table")
		}
	}
}
