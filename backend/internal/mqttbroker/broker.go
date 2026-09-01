package mqttbroker

import (
	"errors"
	"io"
	"log"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	mqtt "github.com/mochi-mqtt/server/v2"
	"github.com/mochi-mqtt/server/v2/hooks/auth"
	"github.com/mochi-mqtt/server/v2/listeners"
	"github.com/mochi-mqtt/server/v2/packets"
)

var ErrDisabled = errors.New("mqtt broker disabled")

// Rebuild stamp 2026-09-01T04:46Z — path-filtered Render backend deploy.

// Broker is the in-process MQTT-over-WebSocket receiver.
type Broker struct {
	server *mqtt.Server
	ws     *ginWSListener
}

type ginWSListener struct {
	id         string
	log        *slog.Logger
	upgrader   *websocket.Upgrader
	establish  listeners.EstablishFn
	started    chan struct{}
	done       chan struct{}
	startOnce  sync.Once
	closeOnce  sync.Once
	establishM sync.RWMutex
}

func newGinWSListener(id string) *ginWSListener {
	return &ginWSListener{
		id: id,
		upgrader: &websocket.Upgrader{
			Subprotocols: []string{"mqtt"},
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
		started: make(chan struct{}),
		done:    make(chan struct{}),
	}
}

func (l *ginWSListener) ID() string      { return l.id }
func (l *ginWSListener) Address() string { return "/mqtt" }
func (l *ginWSListener) Protocol() string {
	return "ws"
}

func (l *ginWSListener) Init(logger *slog.Logger) error {
	l.log = logger
	return nil
}

func (l *ginWSListener) Serve(establish listeners.EstablishFn) {
	l.establishM.Lock()
	l.establish = establish
	l.establishM.Unlock()
	l.startOnce.Do(func() { close(l.started) })
	<-l.done
}

func (l *ginWSListener) Close(closeClients listeners.CloseFn) {
	l.closeOnce.Do(func() { close(l.done) })
	if closeClients != nil {
		closeClients(l.id)
	}
}

func (l *ginWSListener) Handler(w http.ResponseWriter, r *http.Request) {
	select {
	case <-l.started:
	case <-time.After(5 * time.Second):
		http.Error(w, "mqtt not ready", http.StatusServiceUnavailable)
		return
	}

	l.establishM.RLock()
	establish := l.establish
	l.establishM.RUnlock()
	if establish == nil {
		http.Error(w, "mqtt not ready", http.StatusServiceUnavailable)
		return
	}

	c, err := l.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer c.Close()

	err = establish(l.id, &wsConn{Conn: c.UnderlyingConn(), c: c})
	if err != nil && l.log != nil {
		l.log.Warn("mqtt websocket session", "error", err)
	}
}

// wsConn adapts gorilla websocket to net.Conn for mochi-mqtt (binary MQTT frames).
type wsConn struct {
	net.Conn
	c *websocket.Conn
	r io.Reader
}

func (ws *wsConn) Read(p []byte) (int, error) {
	if ws.r == nil {
		op, r, err := ws.c.NextReader()
		if err != nil {
			return 0, err
		}
		if op != websocket.BinaryMessage {
			return 0, errors.New("message type not binary")
		}
		ws.r = r
	}
	n, err := ws.r.Read(p)
	if err != nil {
		ws.r = nil
		if errors.Is(err, io.EOF) {
			err = nil
		}
	}
	return n, err
}

func (ws *wsConn) Write(p []byte) (int, error) {
	if err := ws.c.WriteMessage(websocket.BinaryMessage, p); err != nil {
		return 0, err
	}
	return len(p), nil
}

func (ws *wsConn) Close() error {
	return ws.c.Close()
}

func topicPrefix() string {
	p := strings.TrimSpace(os.Getenv("MQTT_TOPIC_PREFIX"))
	if p == "" {
		return "serpico/hard-data"
	}
	return strings.TrimRight(p, "/")
}

func SubscribeFilter() string {
	return topicPrefix() + "/#"
}

func disabled() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("MQTT_BROKER_URL")))
	return v == "off" || v == "disabled" || v == "none"
}

// Start mounts MQTT-over-WebSocket at GET /mqtt on the existing Gin engine
// and persists publishes under serpico/hard-data/# (or MQTT_TOPIC_PREFIX/#).
func Start(engine *gin.Engine, db *database.Database) (*Broker, error) {
	if disabled() {
		return nil, ErrDisabled
	}
	if engine == nil || db == nil || db.SQLite == nil {
		return nil, errors.New("mqtt broker requires gin engine and sqlite")
	}

	server := mqtt.New(&mqtt.Options{
		InlineClient: true,
		Logger:       slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	if err := server.AddHook(new(auth.AllowHook), nil); err != nil {
		return nil, err
	}

	ws := newGinWSListener("hard-data-ws")
	if err := server.AddListener(ws); err != nil {
		return nil, err
	}

	filter := SubscribeFilter()
	err := server.Subscribe(filter, 1, func(_ *mqtt.Client, _ packets.Subscription, pk packets.Packet) {
		payload := string(pk.Payload)
		if payload == "" {
			return
		}
		if _, err := database.InsertHardData(db.SQLite, pk.TopicName, payload, database.HardDataSourceMQTT); err != nil {
			log.Printf("hard-data mqtt insert: %v", err)
		}
	})
	if err != nil {
		return nil, err
	}

	go func() {
		if err := server.Serve(); err != nil {
			log.Printf("mqtt broker stopped: %v", err)
		}
	}()

	handler := func(c *gin.Context) {
		ws.Handler(c.Writer, c.Request)
	}
	engine.GET("/mqtt", handler)
	engine.GET("/mqtt/*path", handler)

	return &Broker{server: server, ws: ws}, nil
}

func (b *Broker) Close() {
	if b == nil || b.server == nil {
		return
	}
	_ = b.server.Close()
}

// Publish injects a message as if a client published (used in tests).
func (b *Broker) Publish(topic string, payload []byte) error {
	if b == nil || b.server == nil {
		return errors.New("broker not started")
	}
	return b.server.Publish(topic, payload, false, 0)
}

// Ready waits until the websocket listener can accept upgrades.
func (b *Broker) Ready(timeout time.Duration) bool {
	if b == nil || b.ws == nil {
		return false
	}
	select {
	case <-b.ws.started:
		return true
	case <-time.After(timeout):
		return false
	}
}
