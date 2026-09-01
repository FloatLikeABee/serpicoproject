package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
)

func hardDataTestRouter(t *testing.T) (*gin.Engine, *database.Database) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := database.OpenSQLite(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	r := gin.New()
	v1 := r.Group("/api/v1")
	SetupRoutes(v1, db, nil)
	return r, db
}

func TestHardDataHTTPIngestAndList(t *testing.T) {
	r, _ := hardDataTestRouter(t)

	body := `{"payload":"unit 12 on scene","topic":"serpico/hard-data/demo"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/hard-data", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("POST status %d: %s", w.Code, w.Body.String())
	}
	var created database.HardDataRecord
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.ID == "" || created.Payload != "unit 12 on scene" {
		t.Fatalf("created: %+v", created)
	}
	if created.Source != database.HardDataSourceHTTP {
		t.Fatalf("source: %s", created.Source)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/hard-data", nil)
	listW := httptest.NewRecorder()
	r.ServeHTTP(listW, listReq)
	if listW.Code != http.StatusOK {
		t.Fatalf("GET status %d: %s", listW.Code, listW.Body.String())
	}
	var listed struct {
		Records []database.HardDataRecord `json:"records"`
	}
	if err := json.Unmarshal(listW.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, rec := range listed.Records {
		if rec.ID == created.ID && rec.Payload == "unit 12 on scene" {
			found = true
		}
	}
	if !found {
		t.Fatalf("GET missing posted payload: %+v", listed.Records)
	}
}

func TestHardDataMQTTAndHTTPShareStore(t *testing.T) {
	r, db := hardDataTestRouter(t)

	mqttRec, err := database.InsertHardData(db.SQLite, "serpico/hard-data/demo", "from mqtt", database.HardDataSourceMQTT)
	if err != nil {
		t.Fatal(err)
	}
	body := `{"payload":"from http"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/hard-data", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("POST %d: %s", w.Code, w.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/hard-data", nil)
	listW := httptest.NewRecorder()
	r.ServeHTTP(listW, listReq)
	var listed struct {
		Records []database.HardDataRecord `json:"records"`
	}
	if err := json.Unmarshal(listW.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	var sawMQTT, sawHTTP bool
	for _, rec := range listed.Records {
		if rec.ID == mqttRec.ID && rec.Payload == "from mqtt" && rec.Source == database.HardDataSourceMQTT {
			sawMQTT = true
		}
		if rec.Payload == "from http" && rec.Source == database.HardDataSourceHTTP {
			sawHTTP = true
		}
	}
	if !sawMQTT || !sawHTTP {
		t.Fatalf("shared store missing sources mqtt=%v http=%v records=%+v", sawMQTT, sawHTTP, listed.Records)
	}
}

func TestHardDataRejectsEmptyAndOversize(t *testing.T) {
	r, _ := hardDataTestRouter(t)

	empty := httptest.NewRequest(http.MethodPost, "/api/v1/hard-data", strings.NewReader(`{"payload":""}`))
	empty.Header.Set("Content-Type", "application/json")
	ew := httptest.NewRecorder()
	r.ServeHTTP(ew, empty)
	if ew.Code != http.StatusBadRequest {
		t.Fatalf("empty status %d", ew.Code)
	}

	big := `{"payload":"` + strings.Repeat("x", database.HardDataMaxPayload+1) + `"}`
	over := httptest.NewRequest(http.MethodPost, "/api/v1/hard-data", bytes.NewBufferString(big))
	over.Header.Set("Content-Type", "application/json")
	ow := httptest.NewRecorder()
	r.ServeHTTP(ow, over)
	if ow.Code != http.StatusBadRequest {
		t.Fatalf("oversize status %d body %s", ow.Code, ow.Body.String())
	}
}

func TestHardDataHTTPWorksWithoutMQTTAttach(t *testing.T) {
	t.Setenv("MQTT_BROKER_URL", "off")
	r, _ := hardDataTestRouter(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/hard-data", strings.NewReader(`{"payload":"no mqtt"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("HTTP ingest without MQTT: %d %s", w.Code, w.Body.String())
	}
}

func TestHardDataBySerialRequiresRegistryAndScopesTopic(t *testing.T) {
	r, db := hardDataTestRouter(t)

	unknown := httptest.NewRequest(http.MethodGet, "/api/v1/hard-data/hw/NOTREGISTERED", nil)
	uw := httptest.NewRecorder()
	r.ServeHTTP(uw, unknown)
	if uw.Code != http.StatusNotFound {
		t.Fatalf("unknown serial status %d: %s", uw.Code, uw.Body.String())
	}

	space := httptest.NewRequest(http.MethodGet, "/api/v1/hard-data/hw/%20", nil)
	sw := httptest.NewRecorder()
	r.ServeHTTP(sw, space)
	if sw.Code != http.StatusBadRequest {
		t.Fatalf("empty serial status %d: %s", sw.Code, sw.Body.String())
	}

	bad := httptest.NewRequest(http.MethodGet, "/api/v1/hard-data/hw/bad!", nil)
	bw := httptest.NewRecorder()
	r.ServeHTTP(bw, bad)
	if bw.Code != http.StatusBadRequest {
		t.Fatalf("invalid serial status %d: %s", bw.Code, bw.Body.String())
	}

	if _, _, err := database.RegisterHardware(db.SQLite, "sn001"); err != nil {
		t.Fatal(err)
	}
	if _, err := database.InsertHardData(db.SQLite, "serpico/hard-data/hw/SN001", "keep-mqtt", database.HardDataSourceMQTT); err != nil {
		t.Fatal(err)
	}
	if _, err := database.InsertHardData(db.SQLite, "serpico/hard-data/demo", "other-topic", database.HardDataSourceMQTT); err != nil {
		t.Fatal(err)
	}

	ok := httptest.NewRequest(http.MethodGet, "/api/v1/hard-data/hw/sn001", nil)
	ow := httptest.NewRecorder()
	r.ServeHTTP(ow, ok)
	if ow.Code != http.StatusOK {
		t.Fatalf("registered status %d: %s", ow.Code, ow.Body.String())
	}
	var listed struct {
		Serial  string                    `json:"serial"`
		Topic   string                    `json:"topic"`
		Records []database.HardDataRecord `json:"records"`
	}
	if err := json.Unmarshal(ow.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if listed.Serial != "SN001" || listed.Topic != "serpico/hard-data/hw/SN001" {
		t.Fatalf("device %+v", listed)
	}
	if len(listed.Records) != 1 || listed.Records[0].Payload != "keep-mqtt" || listed.Records[0].Source != "mqtt" {
		t.Fatalf("records %+v", listed.Records)
	}
	for _, rec := range listed.Records {
		if rec.Payload == "other-topic" {
			t.Fatal("other topic leaked into serial handle")
		}
	}
}
