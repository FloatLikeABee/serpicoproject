package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var fleetKinds = map[string]bool{
	"police_station": true,
	"personnel":      true,
	"police_vehicle": true,
	"investigation":  true,
}

type fleetEnrichment struct {
	Summary   string `json:"summary"`
	FetchedAt string `json:"fetchedAt"`
}

type fleetMarkerRow struct {
	ID         string           `json:"id"`
	UserID     string           `json:"userId"`
	CityID     string           `json:"cityId"`
	Kind       string           `json:"kind"`
	Name       string           `json:"name"`
	Lat        float64          `json:"lat"`
	Lng        float64          `json:"lng"`
	Address    string           `json:"address,omitempty"`
	Notes      string           `json:"notes"`
	Enrichment *fleetEnrichment `json:"enrichment,omitempty"`
	CreatedAt  string           `json:"createdAt"`
	UpdatedAt  string           `json:"updatedAt"`
}

type fleetMarkerRequest struct {
	ID         string           `json:"id"`
	CityID     string           `json:"cityId"`
	Kind       string           `json:"kind"`
	Name       string           `json:"name"`
	Lat        *float64         `json:"lat"`
	Lng        *float64         `json:"lng"`
	Address    *string          `json:"address"`
	Notes      *string          `json:"notes"`
	Enrichment *fleetEnrichment `json:"enrichment"`
}

const fleetMarkerSelect = `id, user_id, city_id, kind, name, lat, lng, address, notes, enrichment, created_at, updated_at`

func encodeFleetEnrichment(e *fleetEnrichment) string {
	if e == nil || strings.TrimSpace(e.Summary) == "" {
		return ""
	}
	b, err := json.Marshal(fleetEnrichment{
		Summary:   strings.TrimSpace(e.Summary),
		FetchedAt: strings.TrimSpace(e.FetchedAt),
	})
	if err != nil {
		return ""
	}
	return string(b)
}

func decodeFleetEnrichment(raw sql.NullString) *fleetEnrichment {
	if !raw.Valid || strings.TrimSpace(raw.String) == "" {
		return nil
	}
	var e fleetEnrichment
	if err := json.Unmarshal([]byte(raw.String), &e); err != nil {
		return nil
	}
	if strings.TrimSpace(e.Summary) == "" {
		return nil
	}
	return &e
}

func scanFleetMarker(scanner interface {
	Scan(dest ...any) error
}) (fleetMarkerRow, error) {
	var row fleetMarkerRow
	var address, notes, enrichment sql.NullString
	err := scanner.Scan(
		&row.ID, &row.UserID, &row.CityID, &row.Kind, &row.Name,
		&row.Lat, &row.Lng, &address, &notes, &enrichment, &row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return row, err
	}
	if address.Valid {
		row.Address = address.String
	}
	if notes.Valid {
		row.Notes = notes.String
	}
	row.Enrichment = decodeFleetEnrichment(enrichment)
	return row, nil
}

func loadFleetMarker(db *database.Database, id, userID string) (fleetMarkerRow, error) {
	row := db.SQLite.QueryRow(`
		SELECT `+fleetMarkerSelect+`
		FROM fleet_markers
		WHERE id = ? AND user_id = ?`, id, userID)
	return scanFleetMarker(row)
}

func handleFleetListMarkers(c *gin.Context, db *database.Database) {
	userID := helperUserID(c)
	cityID := strings.TrimSpace(c.Query("cityId"))

	query := `
		SELECT ` + fleetMarkerSelect + `
		FROM fleet_markers
		WHERE user_id = ?`
	args := []any{userID}
	if cityID != "" {
		query += ` AND city_id = ?`
		args = append(args, cityID)
	}
	query += ` ORDER BY updated_at DESC`

	rows, err := db.SQLite.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	markers := []fleetMarkerRow{}
	for rows.Next() {
		row, err := scanFleetMarker(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		markers = append(markers, row)
	}
	c.JSON(http.StatusOK, gin.H{"markers": markers})
}

func handleFleetCreateMarker(c *gin.Context, db *database.Database) {
	userID := helperUserID(c)
	var req fleetMarkerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	kind := strings.TrimSpace(req.Kind)
	if !fleetKinds[kind] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "kind must be police_station, personnel, police_vehicle, or investigation"})
		return
	}
	cityID := strings.TrimSpace(req.CityID)
	if cityID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cityId is required"})
		return
	}
	if req.Lat == nil || req.Lng == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "lat and lng are required"})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = "Fleet pin"
	}
	id := strings.TrimSpace(req.ID)
	if id == "" {
		id = "flt-" + uuid.New().String()[:12]
	}
	now := time.Now().UTC().Format(time.RFC3339)
	address := ""
	if req.Address != nil {
		address = strings.TrimSpace(*req.Address)
	}
	notes := ""
	if req.Notes != nil {
		notes = strings.TrimSpace(*req.Notes)
	}
	enrichment := encodeFleetEnrichment(req.Enrichment)

	res, err := db.SQLite.Exec(`
		INSERT INTO fleet_markers (id, user_id, city_id, kind, name, lat, lng, address, notes, enrichment, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			city_id = excluded.city_id,
			kind = excluded.kind,
			name = excluded.name,
			lat = excluded.lat,
			lng = excluded.lng,
			address = excluded.address,
			notes = excluded.notes,
			enrichment = excluded.enrichment,
			updated_at = excluded.updated_at
		WHERE fleet_markers.user_id = excluded.user_id`,
		id, userID, cityID, kind, name, *req.Lat, *req.Lng, address, notes, enrichment, now, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Marker id already exists"})
		return
	}

	row, err := loadFleetMarker(db, id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	status := http.StatusCreated
	if row.CreatedAt != row.UpdatedAt {
		status = http.StatusOK
	}
	c.JSON(status, gin.H{"marker": row})
}

func handleFleetUpdateMarker(c *gin.Context, db *database.Database) {
	userID := helperUserID(c)
	id := strings.TrimSpace(c.Param("id"))
	existing, err := loadFleetMarker(db, id, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Marker not found"})
		return
	}

	var req fleetMarkerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	kind := existing.Kind
	if strings.TrimSpace(req.Kind) != "" {
		kind = strings.TrimSpace(req.Kind)
		if !fleetKinds[kind] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "kind must be police_station, personnel, police_vehicle, or investigation"})
			return
		}
	}
	cityID := existing.CityID
	if strings.TrimSpace(req.CityID) != "" {
		cityID = strings.TrimSpace(req.CityID)
	}
	name := existing.Name
	if req.Name != "" {
		name = strings.TrimSpace(req.Name)
		if name == "" {
			name = existing.Name
		}
	}
	lat := existing.Lat
	if req.Lat != nil {
		lat = *req.Lat
	}
	lng := existing.Lng
	if req.Lng != nil {
		lng = *req.Lng
	}
	address := existing.Address
	if req.Address != nil {
		address = strings.TrimSpace(*req.Address)
	}
	notes := existing.Notes
	if req.Notes != nil {
		notes = strings.TrimSpace(*req.Notes)
	}
	enrichment := encodeFleetEnrichment(existing.Enrichment)
	if req.Enrichment != nil {
		enrichment = encodeFleetEnrichment(req.Enrichment)
	}
	now := time.Now().UTC().Format(time.RFC3339)

	_, err = db.SQLite.Exec(`
		UPDATE fleet_markers
		SET city_id = ?, kind = ?, name = ?, lat = ?, lng = ?, address = ?, notes = ?, enrichment = ?, updated_at = ?
		WHERE id = ? AND user_id = ?`,
		cityID, kind, name, lat, lng, address, notes, enrichment, now, id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := loadFleetMarker(db, id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"marker": row})
}

func handleFleetDeleteMarker(c *gin.Context, db *database.Database) {
	userID := helperUserID(c)
	id := strings.TrimSpace(c.Param("id"))
	res, err := db.SQLite.Exec(`DELETE FROM fleet_markers WHERE id = ? AND user_id = ?`, id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Marker not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
