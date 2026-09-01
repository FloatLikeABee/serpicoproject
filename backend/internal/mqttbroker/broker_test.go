package mqttbroker

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"serpico/backend/internal/database"

	MQTT "github.com/eclipse/paho.mqtt.golang"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func TestWebsocketConnectAndPublishPersists(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := database.OpenSQLite(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	r := gin.New()
	broker, err := Start(r, db)
	if err != nil {
		t.Fatal(err)
	}
	defer broker.Close()
	if !broker.Ready(5 * time.Second) {
		t.Fatal("mqtt listener not ready")
	}

	srv := httptest.NewServer(r)
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/mqtt"
	conn, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("ws dial %s: %v", wsURL, err)
	}
	if resp != nil && resp.StatusCode != http.StatusSwitchingProtocols {
		t.Fatalf("upgrade status %d", resp.StatusCode)
	}
	_ = conn.Close()

	opts := MQTT.NewClientOptions()
	opts.AddBroker(wsURL)
	opts.SetClientID("hard-data-test")
	opts.SetAutoReconnect(false)
	opts.SetConnectTimeout(5 * time.Second)
	client := MQTT.NewClient(opts)
	if token := client.Connect(); token.Wait() && token.Error() != nil {
		t.Fatalf("mqtt connect: %v", token.Error())
	}
	defer client.Disconnect(250)
	if token := client.Publish("serpico/hard-data/demo", 0, false, "unit 12 mqtt"); token.Wait() && token.Error() != nil {
		t.Fatalf("mqtt publish: %v", token.Error())
	}

	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		list, err := database.ListHardData(db.SQLite, 50)
		if err != nil {
			t.Fatal(err)
		}
		for _, rec := range list {
			if rec.Topic == "serpico/hard-data/demo" && rec.Payload == "unit 12 mqtt" && rec.Source == database.HardDataSourceMQTT {
				return
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatal("mqtt publish was not persisted as hard data")
}

func TestDisabledSkip(t *testing.T) {
	t.Setenv("MQTT_BROKER_URL", "off")
	gin.SetMode(gin.TestMode)
	db, err := database.OpenSQLite(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	_, err = Start(gin.New(), db)
	if err != ErrDisabled {
		t.Fatalf("want ErrDisabled, got %v", err)
	}
}
