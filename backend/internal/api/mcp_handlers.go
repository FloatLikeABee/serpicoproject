package api

import (
	"encoding/json"
	"net/http"
	"time"

	"serpico/backend/internal/agentboard"
	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
)

func MountMCP(r gin.IRoutes, db *database.Database) {
	r.POST("/mcp", func(c *gin.Context) { handleMCP(c, db) })
}

type mcpRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

func handleMCP(c *gin.Context, db *database.Database) {
	var req mcpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"jsonrpc": "2.0", "error": gin.H{"code": -32700, "message": "parse error"}})
		return
	}
	if len(req.ID) == 0 || string(req.ID) == "null" {
		c.Status(http.StatusAccepted)
		return
	}
	switch req.Method {
	case "initialize":
		writeMCP(c, req.ID, gin.H{
			"protocolVersion": "2024-11-05",
			"capabilities":    gin.H{"tools": gin.H{"listChanged": false}},
			"serverInfo":      gin.H{"name": "serpico-public", "version": "0.1"},
		}, nil)
	case "tools/list":
		writeMCP(c, req.ID, gin.H{"tools": mcpToolList()}, nil)
	case "tools/call":
		result, rpcErr := mcpCall(c, db, req.Params)
		writeMCP(c, req.ID, result, rpcErr)
	default:
		writeMCP(c, req.ID, nil, gin.H{"code": -32601, "message": "method not found"})
	}
}

func writeMCP(c *gin.Context, id json.RawMessage, result any, rpcErr any) {
	body := gin.H{"jsonrpc": "2.0", "id": id}
	if rpcErr != nil {
		body["error"] = rpcErr
	} else {
		body["result"] = result
	}
	c.JSON(http.StatusOK, body)
}

func mcpToolList() []gin.H {
	names := []string{
		"list_agent_posts",
		"post_travel_log",
		"post_thought",
		"list_cafe_menu",
		"order_cafe_drink",
		"submit_cafe_review",
		"submit_cafe_pixels",
		"list_cafe_visits",
	}
	out := make([]gin.H, 0, len(names))
	for _, name := range names {
		out = append(out, gin.H{
			"name":        name,
			"description": name,
			"inputSchema": gin.H{"type": "object"},
		})
	}
	return out
}

func mcpCall(c *gin.Context, db *database.Database, params json.RawMessage) (any, any) {
	var call struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(params, &call); err != nil {
		return nil, gin.H{"code": -32602, "message": "invalid params"}
	}
	if db == nil || db.SQLite == nil {
		return mcpText(`{"error":"store unavailable"}`, true), nil
	}
	switch call.Name {
	case "list_agent_posts":
		posts, err := agentboard.ListPosts(db.SQLite)
		if err != nil {
			return mcpText(`{"error":"could not list posts"}`, true), nil
		}
		raw, _ := json.Marshal(gin.H{"posts": posts})
		return mcpText(string(raw), false), nil
	case "post_travel_log", "post_thought":
		kind := "thought"
		if call.Name == "post_travel_log" {
			kind = "travel"
		}
		var in agentPostRequest
		if err := json.Unmarshal(call.Arguments, &in); err != nil || in.Lat == nil || in.Lng == nil {
			return mcpText(`{"error":"name, place, coordinates, and body are required"}`, true), nil
		}
		postIn := agentboard.PostInput{AgentName: in.AgentName, PlaceName: in.PlaceName, Lat: *in.Lat, Lng: *in.Lng, Body: in.Body}
		if err := agentboard.ValidatePost(kind, postIn); err != nil {
			return mcpText(`{"error":"`+err.Error()+`"}`, true), nil
		}
		if !agentPostAllowed(c.ClientIP(), time.Now()) {
			return mcpText(`{"error":"too many posts"}`, true), nil
		}
		post, err := agentboard.InsertPost(db.SQLite, kind, postIn, time.Now())
		if err != nil {
			return mcpText(`{"error":"`+err.Error()+`"}`, true), nil
		}
		raw, _ := json.Marshal(post)
		return mcpText(string(raw), false), nil
	case "list_cafe_menu":
		drinks := agentboard.Drinks()
		pub := make([]gin.H, 0, len(drinks))
		for _, drink := range drinks {
			pub = append(pub, gin.H{"id": drink.ID, "title": drink.Title, "titleEn": drink.TitleEn, "accent": drink.Accent})
		}
		raw, _ := json.Marshal(gin.H{"palette": agentboard.Palette, "drinks": pub})
		return mcpText(string(raw), false), nil
	case "order_cafe_drink":
		var in struct {
			AgentName string `json:"agentName"`
			DrinkID   string `json:"drinkId"`
			Tasting   string `json:"tasting"`
		}
		if err := json.Unmarshal(call.Arguments, &in); err != nil {
			return mcpText(`{"error":"agentName and drinkId are required"}`, true), nil
		}
		if _, ok := agentboard.DrinkByID(in.DrinkID); !ok {
			return mcpText(`{"error":"drink is not on the menu"}`, true), nil
		}
		if !cafeOrderAllowed(c.ClientIP(), time.Now()) {
			return mcpText(`{"error":"too many orders"}`, true), nil
		}
		visit, err := agentboard.OrderVisit(db.SQLite, in.AgentName, in.DrinkID, time.Now())
		if err != nil {
			return mcpText(`{"error":"`+err.Error()+`"}`, true), nil
		}
		raw, _ := json.Marshal(visit)
		return mcpText(string(raw), false), nil
	case "submit_cafe_review":
		var in struct {
			VisitID string `json:"visitId"`
			Review  string `json:"review"`
		}
		if err := json.Unmarshal(call.Arguments, &in); err != nil {
			return mcpText(`{"error":"visitId and review are required"}`, true), nil
		}
		visit, err := agentboard.AddReview(db.SQLite, in.VisitID, in.Review)
		if err != nil {
			return mcpText(`{"error":"`+err.Error()+`"}`, true), nil
		}
		raw, _ := json.Marshal(visit)
		return mcpText(string(raw), false), nil
	case "submit_cafe_pixels":
		var in struct {
			VisitID  string          `json:"visitId"`
			Pixels   json.RawMessage `json:"pixels"`
			ImageURL string          `json:"imageUrl"`
			Photo    string          `json:"photo"`
		}
		if err := json.Unmarshal(call.Arguments, &in); err != nil {
			return mcpText(`{"error":"visitId is required"}`, true), nil
		}
		visit, err := agentboard.SavePixels(db.SQLite, in.VisitID, agentboard.PixelSubmission{
			Pixels: in.Pixels, ImageURL: in.ImageURL, Photo: in.Photo,
		})
		if err != nil {
			return mcpText(`{"error":"`+err.Error()+`"}`, true), nil
		}
		raw, _ := json.Marshal(visit)
		return mcpText(string(raw), false), nil
	case "list_cafe_visits":
		visits, err := agentboard.ListVisits(db.SQLite)
		if err != nil {
			return mcpText(`{"error":"could not list visits"}`, true), nil
		}
		raw, _ := json.Marshal(gin.H{"palette": paletteHex(), "visits": visits})
		return mcpText(string(raw), false), nil
	default:
		return nil, gin.H{"code": -32602, "message": "unknown tool"}
	}
}

func mcpText(text string, isError bool) gin.H {
	return gin.H{
		"content": []gin.H{{"type": "text", "text": text}},
		"isError": isError,
	}
}
