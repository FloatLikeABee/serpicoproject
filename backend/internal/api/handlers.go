package api

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"serpico/backend/internal/ai"
	"serpico/backend/internal/database"
)

// Mock login handler
func handleLogin(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Mock authentication - always succeeds
	user := gin.H{
		"id":    uuid.New().String(),
		"email": req.Email,
		"name":  "Demo User",
		"role":  "police",
		"rank":  "Officer",
	}

	c.JSON(http.StatusOK, gin.H{
		"user":  user,
		"token": "mock_token_" + uuid.New().String(),
	})
}

func handleGoogleLogin(c *gin.Context) {
	// Mock Google login
	user := gin.H{
		"id":    uuid.New().String(),
		"email": "user@gmail.com",
		"name":  "Google User",
		"role":  "police",
		"rank":  "Officer",
	}

	c.JSON(http.StatusOK, gin.H{
		"user":  user,
		"token": "mock_token_" + uuid.New().String(),
	})
}

func handleAppleLogin(c *gin.Context) {
	// Mock Apple login
	user := gin.H{
		"id":    uuid.New().String(),
		"email": "user@icloud.com",
		"name":  "Apple User",
		"role":  "police",
		"rank":  "Officer",
	}

	c.JSON(http.StatusOK, gin.H{
		"user":  user,
		"token": "mock_token_" + uuid.New().String(),
	})
}

func handleLogout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

func handleGetUser(c *gin.Context, db *database.Database) {
	// Get first user from database as demo
	var id, email, name, role, rank string
	err := db.SQLite.QueryRow("SELECT id, email, name, role, rank FROM users LIMIT 1").Scan(&id, &email, &name, &role, &rank)
	if err != nil {
		// Fallback to mock data if no users in database
		c.JSON(http.StatusOK, gin.H{
			"user": gin.H{
				"id":    "1",
				"email": "demo@serpico.com",
				"name":  "Demo User",
				"role":  "police",
				"rank":  "Officer",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":    id,
			"email": email,
			"name":  name,
			"role":  role,
			"rank":  rank,
		},
	})
}

func handleUpdateUser(c *gin.Context) {
	var req struct {
		Name  string `json:"name"`
		Email string `json:"email"`
		Role  string `json:"role"`
		Rank  string `json:"rank"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User updated successfully",
		"user": gin.H{
			"name":  req.Name,
			"email": req.Email,
			"role":  req.Role,
			"rank":  req.Rank,
		},
	})
}

func handleGetCases(c *gin.Context, db *database.Database) {
	rows, err := db.SQLite.Query("SELECT id, type, location, date, status, description, solved FROM cases ORDER BY date DESC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var cases []gin.H
	for rows.Next() {
		var id, caseType, location, date, status, description string
		var solved int
		if err := rows.Scan(&id, &caseType, &location, &date, &status, &description, &solved); err != nil {
			continue
		}
		cases = append(cases, gin.H{
			"id":          id,
			"type":        caseType,
			"location":    location,
			"date":        date,
			"status":      status,
			"description": description,
			"solved":      solved == 1,
		})
	}

	c.JSON(http.StatusOK, gin.H{"cases": cases})
}

func handleGetCase(c *gin.Context, db *database.Database) {
	id := c.Param("id")

	var caseType, location, date, status, description string
	var solved int
	err := db.SQLite.QueryRow("SELECT type, location, date, status, description, solved FROM cases WHERE id = ?", id).
		Scan(&caseType, &location, &date, &status, &description, &solved)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Case not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          id,
		"type":        caseType,
		"location":    location,
		"date":        date,
		"status":      status,
		"description": description,
		"solved":      solved == 1,
	})
}

func handleCreateCase(c *gin.Context, db *database.Database) {
	var req struct {
		Type        string `json:"type"`
		Location    string `json:"location"`
		Date        string `json:"date"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := "case-" + uuid.New().String()
	_, err := db.SQLite.Exec("INSERT INTO cases (id, type, location, date, status, description, solved) VALUES (?, ?, ?, ?, ?, ?, ?)",
		id, req.Type, req.Location, req.Date, "Open", req.Description, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":          id,
		"type":        req.Type,
		"location":    req.Location,
		"date":        req.Date,
		"status":      "Open",
		"description": req.Description,
		"solved":      false,
	})
}

func handleGetPerps(c *gin.Context, db *database.Database) {
	rows, err := db.SQLite.Query("SELECT id, alias, location, last_seen, status FROM perps ORDER BY last_seen DESC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var perps []gin.H
	for rows.Next() {
		var id, alias, location, lastSeen, status string
		if err := rows.Scan(&id, &alias, &location, &lastSeen, &status); err != nil {
			continue
		}

		// Count related cases
		var caseCount int
		db.SQLite.QueryRow("SELECT COUNT(*) FROM cases WHERE location LIKE ?", "%"+location+"%").Scan(&caseCount)

		perps = append(perps, gin.H{
			"id":        id,
			"alias":     alias,
			"lastSeen":  lastSeen,
			"location":  location,
			"status":    status,
			"cases":     caseCount,
		})
	}

	c.JSON(http.StatusOK, gin.H{"perps": perps})
}

func handleGetPerp(c *gin.Context, db *database.Database) {
	id := c.Param("id")

	var alias, location, lastSeen, status string
	err := db.SQLite.QueryRow("SELECT alias, location, last_seen, status FROM perps WHERE id = ?", id).
		Scan(&alias, &location, &lastSeen, &status)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Perp not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var caseCount int
	db.SQLite.QueryRow("SELECT COUNT(*) FROM cases WHERE location LIKE ?", "%"+location+"%").Scan(&caseCount)

	c.JSON(http.StatusOK, gin.H{
		"id":        id,
		"alias":     alias,
		"lastSeen":  lastSeen,
		"location":  location,
		"status":    status,
		"cases":     caseCount,
	})
}

func handleGetOfficers(c *gin.Context, db *database.Database) {
	rows, err := db.SQLite.Query("SELECT id, name, rank, vehicle_plate, vehicle_number, current_location, status FROM officers WHERE status IN ('On Duty', 'On Patrol')")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var officers []gin.H
	for rows.Next() {
		var id, name, rank, vehiclePlate, vehicleNumber, currentLocation, status string
		if err := rows.Scan(&id, &name, &rank, &vehiclePlate, &vehicleNumber, &currentLocation, &status); err != nil {
			continue
		}
		officers = append(officers, gin.H{
			"id":              id,
			"name":            name,
			"rank":            rank,
			"vehiclePlate":    vehiclePlate,
			"vehicleNumber":   vehicleNumber,
			"currentLocation": currentLocation,
			"status":          status,
		})
	}

	c.JSON(http.StatusOK, gin.H{"officers": officers})
}

func handleGetNearbyOfficers(c *gin.Context, db *database.Database) {
	// lat := c.Query("lat")
	// lng := c.Query("lng")
	// In real app, would filter by distance using lat/lng

	// Get all officers (in real app, would filter by distance)
	rows, err := db.SQLite.Query("SELECT id, name, rank, vehicle_plate, vehicle_number, current_location FROM officers WHERE status IN ('On Duty', 'On Patrol') LIMIT 5")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var officers []gin.H
	for rows.Next() {
		var id, name, rank, vehiclePlate, vehicleNumber, currentLocation string
		if err := rows.Scan(&id, &name, &rank, &vehiclePlate, &vehicleNumber, &currentLocation); err != nil {
			continue
		}
		officers = append(officers, gin.H{
			"id":              id,
			"name":            name,
			"rank":            rank,
			"vehiclePlate":    vehiclePlate,
			"vehicleNumber":   vehicleNumber,
			"currentLocation": currentLocation,
			"distance":        "0.5 miles", // Mock distance
		})
	}

	c.JSON(http.StatusOK, gin.H{"officers": officers})
}

func handleGetEmergencies(c *gin.Context, db *database.Database) {
	rows, err := db.SQLite.Query("SELECT id, type, location, priority, category, assigned_officer_id, status, created_at FROM emergencies WHERE status = 'Active' ORDER BY created_at DESC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var emergencies []gin.H
	for rows.Next() {
		var id, emergencyType, location, priority, category, assignedOfficerID, status, createdAt string
		if err := rows.Scan(&id, &emergencyType, &location, &priority, &category, &assignedOfficerID, &status, &createdAt); err != nil {
			continue
		}
		emergencies = append(emergencies, gin.H{
			"id":         id,
			"type":       emergencyType,
			"priority":   priority,
			"location":   location,
			"category":   category,
			"status":     status,
			"createdAt":  createdAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"emergencies": emergencies})
}

func handleCreateEmergency(c *gin.Context, db *database.Database) {
	var req struct {
		Type     string `json:"type"`
		Location string `json:"location"`
		Priority string `json:"priority"`
		Category string `json:"category"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := "emergency-" + uuid.New().String()
	createdAt := time.Now().Format(time.RFC3339)
	_, err := db.SQLite.Exec("INSERT INTO emergencies (id, type, location, priority, category, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		id, req.Type, req.Location, req.Priority, req.Category, "Active", createdAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":         id,
		"type":       req.Type,
		"location":   req.Location,
		"priority":   req.Priority,
		"category":   req.Category,
		"status":     "Active",
		"createdAt":  createdAt,
	})
}

func handleGetEmergency(c *gin.Context, db *database.Database) {
	id := c.Param("id")

	var emergencyType, location, priority, category, status, createdAt string
	err := db.SQLite.QueryRow("SELECT type, location, priority, category, status, created_at FROM emergencies WHERE id = ?", id).
		Scan(&emergencyType, &location, &priority, &category, &status, &createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Emergency not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         id,
		"type":       emergencyType,
		"priority":   priority,
		"location":   location,
		"category":   category,
		"status":     status,
		"createdAt":  createdAt,
	})
}

func handleChat(c *gin.Context, aiService interface{}) {
	var req struct {
		Message string `json:"message"`
		Context string `json:"context"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Type assert to get AIService
	ai, ok := aiService.(interface {
		ProcessChat(userMessage string, context string) (string, error)
	})
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service not available"})
		return
	}

	// Process chat with AI service
	content, err := ai.ProcessChat(req.Message, req.Context)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response := gin.H{
		"id":        uuid.New().String(),
		"role":      "assistant",
		"content":   content,
		"timestamp": time.Now().Format(time.RFC3339),
	}

	c.JSON(http.StatusOK, gin.H{"response": response})
}

func handleGetRouteRecommendations(c *gin.Context) {
	from := c.Query("from")
	to := c.Query("to")

	// Mock route recommendations
	routes := []gin.H{
		{
			"id":       "1",
			"from":     from,
			"to":       to,
			"safety":   "High",
			"time":     "15 min",
			"distance": "3.2 miles",
			"waypoints": []string{"38.8814,-94.8191", "38.8914,-94.8091"},
		},
	}

	c.JSON(http.StatusOK, gin.H{"routes": routes})
}

func handleGetPursuitRecommendations(c *gin.Context) {
	// Mock pursuit recommendations
	recommendations := []gin.H{
		{
			"id":          "1",
			"type":        "Route Suggestion",
			"description": "Based on historical data, this route has a 85% success rate",
			"confidence":  0.85,
		},
	}

	c.JSON(http.StatusOK, gin.H{"recommendations": recommendations})
}

// Admin handlers
func handleAdminGetAllCases(c *gin.Context, db *database.Database) {
	rows, err := db.SQLite.Query("SELECT id, type, date, location, status, description FROM cases ORDER BY date DESC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	cases := []gin.H{}
	for rows.Next() {
		var id, caseType, date, location, status, description string
		if err := rows.Scan(&id, &caseType, &date, &location, &status, &description); err != nil {
			continue
		}
		cases = append(cases, gin.H{
			"id":          id,
			"type":        caseType,
			"date":        date,
			"location":    location,
			"status":      status,
			"description": description,
		})
	}

	c.JSON(http.StatusOK, gin.H{"cases": cases, "total": len(cases)})
}

func handleAdminGetAllPerps(c *gin.Context, db *database.Database) {
	rows, err := db.SQLite.Query("SELECT id, alias, last_seen, location, status FROM perps ORDER BY last_seen DESC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	perps := []gin.H{}
	for rows.Next() {
		var id, alias, lastSeen, location, status string
		if err := rows.Scan(&id, &alias, &lastSeen, &location, &status); err != nil {
			continue
		}
		perps = append(perps, gin.H{
			"id":        id,
			"alias":     alias,
			"last_seen": lastSeen,
			"location":  location,
			"status":    status,
		})
	}

	c.JSON(http.StatusOK, gin.H{"perps": perps, "total": len(perps)})
}

func handleAdminGetAllOfficers(c *gin.Context, db *database.Database) {
	rows, err := db.SQLite.Query("SELECT id, name, rank, vehicle_plate, vehicle_number, current_location, status FROM officers ORDER BY name")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	officers := []gin.H{}
	for rows.Next() {
		var id, name, rank, vehiclePlate, vehicleNumber, currentLocation, status string
		if err := rows.Scan(&id, &name, &rank, &vehiclePlate, &vehicleNumber, &currentLocation, &status); err != nil {
			continue
		}
		officers = append(officers, gin.H{
			"id":               id,
			"name":             name,
			"rank":             rank,
			"vehicle_plate":    vehiclePlate,
			"vehicle_number":   vehicleNumber,
			"current_location": currentLocation,
			"status":           status,
		})
	}

	c.JSON(http.StatusOK, gin.H{"officers": officers, "total": len(officers)})
}

func handleAdminGetAllEmergencies(c *gin.Context, db *database.Database) {
	rows, err := db.SQLite.Query("SELECT id, type, priority, location, category, assigned_officer_id, status, created_at FROM emergencies ORDER BY created_at DESC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	emergencies := []gin.H{}
	for rows.Next() {
		var id, emergencyType, priority, location, category, assignedOfficerID, status, createdAt string
		if err := rows.Scan(&id, &emergencyType, &priority, &location, &category, &assignedOfficerID, &status, &createdAt); err != nil {
			continue
		}
		emergencies = append(emergencies, gin.H{
			"id":                id,
			"type":              emergencyType,
			"priority":          priority,
			"location":          location,
			"category":          category,
			"assigned_officer_id": assignedOfficerID,
			"status":            status,
			"created_at":        createdAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"emergencies": emergencies, "total": len(emergencies)})
}

func handleAdminGetAllUsers(c *gin.Context, db *database.Database) {
	rows, err := db.SQLite.Query("SELECT id, email, name, role, rank FROM users ORDER BY name")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	users := []gin.H{}
	for rows.Next() {
		var id, email, name, role, rank string
		if err := rows.Scan(&id, &email, &name, &role, &rank); err != nil {
			continue
		}
		users = append(users, gin.H{
			"id":    id,
			"email": email,
			"name":  name,
			"role":  role,
			"rank":  rank,
		})
	}

	c.JSON(http.StatusOK, gin.H{"users": users, "total": len(users)})
}

// Admin login handler
func handleAdminLogin(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Single admin user
	if req.Username == "g@transfdr" && req.Password == "eight88" {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"user": gin.H{
				"username": req.Username,
				"role":     "admin",
			},
			"token": "admin_token_" + uuid.New().String(),
		})
	} else {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid username or password",
		})
	}
}

// Admin create handlers
func handleAdminCreateCase(c *gin.Context, db *database.Database) {
	var req struct {
		Type        string `json:"type"`
		Location    string `json:"location"`
		Date        string `json:"date"`
		Description string `json:"description"`
		Status      string `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Status == "" {
		req.Status = "Open"
	}

	id := "case-" + uuid.New().String()
	solved := 0
	if req.Status == "Solved" {
		solved = 1
	}

	_, err := db.SQLite.Exec("INSERT INTO cases (id, type, location, date, status, description, solved) VALUES (?, ?, ?, ?, ?, ?, ?)",
		id, req.Type, req.Location, req.Date, req.Status, req.Description, solved)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":          id,
		"type":        req.Type,
		"location":    req.Location,
		"date":        req.Date,
		"status":      req.Status,
		"description": req.Description,
		"solved":      solved == 1,
	})
}

func handleAdminCreatePerp(c *gin.Context, db *database.Database) {
	var req struct {
		Alias    string `json:"alias"`
		Location string `json:"location"`
		LastSeen string `json:"last_seen"`
		Status   string `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Status == "" {
		req.Status = "Active"
	}

	id := "perp-" + uuid.New().String()
	_, err := db.SQLite.Exec("INSERT INTO perps (id, alias, location, last_seen, status) VALUES (?, ?, ?, ?, ?)",
		id, req.Alias, req.Location, req.LastSeen, req.Status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":        id,
		"alias":     req.Alias,
		"location":  req.Location,
		"last_seen": req.LastSeen,
		"status":    req.Status,
	})
}

func handleAdminCreateOfficer(c *gin.Context, db *database.Database) {
	var req struct {
		Name            string `json:"name"`
		Rank            string `json:"rank"`
		VehiclePlate    string `json:"vehicle_plate"`
		VehicleNumber   string `json:"vehicle_number"`
		CurrentLocation string `json:"current_location"`
		Status          string `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Status == "" {
		req.Status = "Active"
	}

	id := "officer-" + uuid.New().String()
	_, err := db.SQLite.Exec("INSERT INTO officers (id, name, rank, vehicle_plate, vehicle_number, current_location, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
		id, req.Name, req.Rank, req.VehiclePlate, req.VehicleNumber, req.CurrentLocation, req.Status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":               id,
		"name":             req.Name,
		"rank":             req.Rank,
		"vehicle_plate":    req.VehiclePlate,
		"vehicle_number":   req.VehicleNumber,
		"current_location": req.CurrentLocation,
		"status":           req.Status,
	})
}

func handleAdminCreateEmergency(c *gin.Context, db *database.Database) {
	var req struct {
		Type            string `json:"type"`
		Location        string `json:"location"`
		Priority        string `json:"priority"`
		Category        string `json:"category"`
		AssignedOfficerID string `json:"assigned_officer_id"`
		Status          string `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Status == "" {
		req.Status = "Open"
	}
	if req.Priority == "" {
		req.Priority = "Medium"
	}

	id := "emergency-" + uuid.New().String()
	_, err := db.SQLite.Exec("INSERT INTO emergencies (id, type, location, priority, category, assigned_officer_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
		id, req.Type, req.Location, req.Priority, req.Category, req.AssignedOfficerID, req.Status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":                id,
		"type":              req.Type,
		"location":          req.Location,
		"priority":          req.Priority,
		"category":          req.Category,
		"assigned_officer_id": req.AssignedOfficerID,
		"status":            req.Status,
	})
}

// RAG Management handlers
func handleRAGGetDocuments(c *gin.Context, aiService interface{}) {
	service, ok := aiService.(*ai.AIService)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service type assertion failed"})
		return
	}

	ragDB := service.GetRAGDatabase()
	documents := ragDB.GetAllDocuments()
	c.JSON(http.StatusOK, gin.H{"documents": documents, "total": len(documents)})
}

func handleRAGGetDocument(c *gin.Context, aiService interface{}) {
	id := c.Param("id")
	
	service, ok := aiService.(*ai.AIService)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service type assertion failed"})
		return
	}

	ragDB := service.GetRAGDatabase()
	doc := ragDB.GetDocumentByID(id)
	if doc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"document": doc})
}

func handleRAGCreateDocument(c *gin.Context, aiService interface{}) {
	var req struct {
		Title    string   `json:"title"`
		Content  string   `json:"content"`
		Category string   `json:"category"`
		Location string   `json:"location,omitempty"`
		Tags     []string `json:"tags"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service, ok := aiService.(*ai.AIService)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service type assertion failed"})
		return
	}

	// Generate ID
	docID := "rag-" + uuid.New().String()
	doc := ai.RAGDocument{
		ID:       docID,
		Title:    req.Title,
		Content:  req.Content,
		Category: req.Category,
		Location: req.Location,
		Tags:     req.Tags,
	}

	ragDB := service.GetRAGDatabase()
	if err := ragDB.AddDocument(doc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"document": doc})
}

func handleRAGUpdateDocument(c *gin.Context, aiService interface{}) {
	id := c.Param("id")
	var req struct {
		Title    string   `json:"title"`
		Content  string   `json:"content"`
		Category string   `json:"category"`
		Location string   `json:"location,omitempty"`
		Tags     []string `json:"tags"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service, ok := aiService.(*ai.AIService)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service type assertion failed"})
		return
	}

	doc := ai.RAGDocument{
		ID:       id,
		Title:    req.Title,
		Content:  req.Content,
		Category: req.Category,
		Location: req.Location,
		Tags:     req.Tags,
	}

	ragDB := service.GetRAGDatabase()
	if err := ragDB.UpdateDocument(id, doc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"document": doc})
}

func handleRAGDeleteDocument(c *gin.Context, aiService interface{}) {
	id := c.Param("id")

	service, ok := aiService.(*ai.AIService)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service type assertion failed"})
		return
	}

	ragDB := service.GetRAGDatabase()
	if err := ragDB.DeleteDocument(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Document deleted successfully", "id": id})
}
