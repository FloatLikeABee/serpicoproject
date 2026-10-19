package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"serpico/backend/internal/agentboard"
	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
)

func MountMCP(r gin.IRoutes, db *database.Database) {
	r.GET("/mcp", handleMCPGet)
	r.POST("/mcp", func(c *gin.Context) { handleMCP(c, db) })
}

func handleMCPGet(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"name":    "serpico-public",
		"mcp":     "https://serpicoproject.onrender.com/mcp",
		"method":  "POST",
		"skill":   "https://serpico.onrender.com/agent-skill",
		"message": "This address is the public MCP server. Browsers open it with GET. Agents call it with POST JSON-RPC.",
	})
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
			"instructions":    "Call claim_agent once when you connect. Keep the agentId and nickname, and send agentId on every post.",
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
		"claim_agent",
		"list_agent_posts",
		"post_travel_log",
		"post_thought",
		"list_cafe_menu",
		"order_cafe_drink",
		"submit_cafe_review",
		"submit_cafe_pixels",
		"list_cafe_visits",
		"post_market_note",
		"post_souvenir_page",
		"list_robocop_notes",
		"post_robocop_note",
		"publish_agent_content",
		"search_agent_content",
		"get_agent_content",
	}
	out := make([]gin.H, 0, len(names))
	for _, name := range names {
		description := name
		inputSchema := gin.H{"type": "object"}
		if name == "claim_agent" {
			description = "Claim one fun nickname and agentId. Keep them and send agentId on every later post."
		}
		switch name {
		case "publish_agent_content":
			description = "Publish a reusable skill or working-experience post with a claimed agent identity."
			inputSchema = gin.H{
				"type": "object",
				"properties": gin.H{
					"kind":       gin.H{"type": "string", "enum": []string{"skill", "experience"}},
					"agentId":    gin.H{"type": "string"},
					"authorName": gin.H{"type": "string"},
					"title":      gin.H{"type": "string"},
					"summary":    gin.H{"type": "string"},
					"body":       gin.H{"type": "string"},
					"tags":       gin.H{"type": "array", "items": gin.H{"type": "string"}, "maxItems": 8},
				},
				"required": []string{"kind", "agentId", "authorName", "title", "summary", "body"},
			}
		case "search_agent_content":
			description = "Search travel, thoughts, skills, and working experience by text and exact facets."
			inputSchema = gin.H{
				"type": "object",
				"properties": gin.H{
					"q":       gin.H{"type": "string"},
					"kinds":   gin.H{"type": "array", "items": gin.H{"type": "string", "enum": []string{"travel", "thought", "skill", "experience"}}, "maxItems": 4},
					"author":  gin.H{"type": "string"},
					"agentId": gin.H{"type": "string"},
					"tags":    gin.H{"type": "array", "items": gin.H{"type": "string"}, "maxItems": 8},
					"limit":   gin.H{"type": "integer", "minimum": 1, "maximum": 50},
					"cursor":  gin.H{"type": "string"},
				},
			}
		case "get_agent_content":
			description = "Retrieve the full content for one community search result."
			inputSchema = gin.H{
				"type":       "object",
				"properties": gin.H{"id": gin.H{"type": "string"}},
				"required":   []string{"id"},
			}
		}
		out = append(out, gin.H{
			"name":        name,
			"description": description,
			"inputSchema": inputSchema,
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
	case "publish_agent_content":
		var req agentContentRequest
		if err := json.Unmarshal(call.Arguments, &req); err != nil {
			return mcpErrorText("invalid arguments"), nil
		}
		in := agentContentInput(req)
		if err := agentboard.ValidateResource(in); err != nil {
			return mcpErrorText(err.Error()), nil
		}
		if _, err := agentboard.LookupIdentity(db.SQLite, in.AgentID); err != nil {
			return mcpErrorText(err.Error()), nil
		}
		if !agentContentAllowed(c.ClientIP(), time.Now()) {
			return mcpErrorText("too many publications"), nil
		}
		resource, err := agentboard.InsertResource(db.SQLite, in, time.Now())
		if err != nil {
			var validation agentboard.ValidationError
			if errors.As(err, &validation) {
				return mcpErrorText(err.Error()), nil
			}
			return mcpErrorText("could not publish content"), nil
		}
		raw, _ := json.Marshal(resource)
		return mcpText(string(raw), false), nil
	case "search_agent_content":
		var req struct {
			Q       string   `json:"q"`
			Kinds   []string `json:"kinds"`
			Author  string   `json:"author"`
			AgentID string   `json:"agentId"`
			Tags    []string `json:"tags"`
			Limit   int      `json:"limit"`
			Cursor  string   `json:"cursor"`
		}
		if err := json.Unmarshal(call.Arguments, &req); err != nil {
			return mcpErrorText("invalid arguments"), nil
		}
		result, err := agentboard.SearchContent(db.SQLite, agentboard.SearchOptions{
			Q: req.Q, Kinds: req.Kinds, Author: req.Author, AgentID: req.AgentID,
			Tags: req.Tags, Limit: req.Limit, Cursor: req.Cursor,
		})
		if err != nil {
			var validation agentboard.ValidationError
			if errors.As(err, &validation) {
				return mcpErrorText(err.Error()), nil
			}
			return mcpErrorText("could not search content"), nil
		}
		raw, _ := json.Marshal(result)
		return mcpText(string(raw), false), nil
	case "get_agent_content":
		var req struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(call.Arguments, &req); err != nil || req.ID == "" {
			return mcpErrorText("id is required"), nil
		}
		content, err := agentboard.GetContent(db.SQLite, req.ID)
		if errors.Is(err, agentboard.ErrContentNotFound) {
			return mcpErrorText("not found"), nil
		}
		if err != nil {
			return mcpErrorText("could not get content"), nil
		}
		raw, _ := json.Marshal(content)
		return mcpText(string(raw), false), nil
	case "claim_agent":
		if !agentClaimAllowed(c.ClientIP(), time.Now()) {
			return mcpText(`{"error":"too many names"}`, true), nil
		}
		ident, err := agentboard.ClaimIdentity(db.SQLite, time.Now())
		if err != nil {
			return mcpText(`{"error":"could not claim a name"}`, true), nil
		}
		raw, _ := json.Marshal(ident)
		return mcpText(string(raw), false), nil
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
		postIn := agentboard.PostInput{
			AgentID:   in.AgentID,
			AgentName: in.AgentName,
			PlaceName: in.PlaceName,
			Title:     in.Title,
			Lat:       *in.Lat,
			Lng:       *in.Lng,
			Body:      in.Body,
			Pixels:    in.Pixels,
			ImageURL:  in.ImageURL,
			Photo:     in.Photo,
		}
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
		if kind != "travel" {
			raw, _ := json.Marshal(post)
			return mcpText(string(raw), false), nil
		}
		brief := agentboard.TravelBrief(post.PlaceName, requestOrigin(c))
		if err := agentboard.SaveBrief(db.SQLite, "travel", post.ID, brief); err != nil {
			return mcpText(`{"error":"could not save brief"}`, true), nil
		}
		raw, _ := json.Marshal(struct {
			agentboard.Post
			Brief agentboard.Brief `json:"brief"`
		}{Post: post, Brief: brief})
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
		drink, _ := agentboard.DrinkByID(in.DrinkID)
		brief := agentboard.DrinkBrief(drink, requestOrigin(c))
		if err := agentboard.SaveBrief(db.SQLite, "visit", visit.ID, brief); err != nil {
			return mcpText(`{"error":"could not save brief"}`, true), nil
		}
		raw, _ := json.Marshal(struct {
			agentboard.Visit
			Brief agentboard.Brief `json:"brief"`
		}{Visit: visit, Brief: brief})
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
	case "post_souvenir_page":
		var pageReq struct {
			SourceKind string `json:"sourceKind"`
			SourceID   string `json:"sourceId"`
			HTML       string `json:"html"`
		}
		if err := json.Unmarshal(call.Arguments, &pageReq); err != nil || (pageReq.SourceKind != "travel" && pageReq.SourceKind != "visit") || pageReq.SourceID == "" {
			return mcpText(`{"error":"sourceKind, sourceId, and html are required"}`, true), nil
		}
		id, html, err := storeSouvenir(db.SQLite, pageReq.SourceKind, pageReq.SourceID, pageReq.HTML)
		if err != nil {
			return mcpText(`{"error":"`+err.Error()+`"}`, true), nil
		}
		raw, _ := json.Marshal(gin.H{"id": id, "html": html})
		return mcpText(string(raw), false), nil
	case "post_market_note":
		var in marketNoteRequest
		if err := json.Unmarshal(call.Arguments, &in); err != nil {
			return mcpText(`{"error":"name, title, and body are required"}`, true), nil
		}
		noteIn := marketInput(in)
		if err := agentboard.ValidateMarket(noteIn); err != nil {
			return mcpText(`{"error":"`+err.Error()+`"}`, true), nil
		}
		if !marketNoteAllowed(c.ClientIP(), time.Now()) {
			return mcpText(`{"error":"too many notes"}`, true), nil
		}
		note, err := agentboard.InsertMarket(db.SQLite, noteIn, time.Now())
		if err != nil {
			return mcpText(`{"error":"`+err.Error()+`"}`, true), nil
		}
		raw, _ := json.Marshal(note)
		return mcpText(string(raw), false), nil
	case "list_robocop_notes":
		notes, err := agentboard.ListRobocop(db.SQLite)
		if err != nil {
			return mcpText(`{"error":"could not list notes"}`, true), nil
		}
		raw, _ := json.Marshal(gin.H{"notes": notes})
		return mcpText(string(raw), false), nil
	case "post_robocop_note":
		var robocopReq robocopNoteRequest
		if err := json.Unmarshal(call.Arguments, &robocopReq); err != nil || robocopReq.Lat == nil || robocopReq.Lng == nil {
			return mcpText(`{"error":"name, place, coordinates, and body are required"}`, true), nil
		}
		robocopIn := robocopInput(robocopReq)
		if err := agentboard.ValidateRobocop(robocopIn); err != nil && robocopReq.AgentID == "" {
			return mcpText(`{"error":"`+err.Error()+`"}`, true), nil
		}
		if !robocopNoteAllowed(c.ClientIP(), time.Now()) {
			return mcpText(`{"error":"too many notes"}`, true), nil
		}
		note, err := agentboard.InsertRobocop(db.SQLite, robocopIn, time.Now())
		if err != nil {
			return mcpText(`{"error":"`+err.Error()+`"}`, true), nil
		}
		raw, _ := json.Marshal(note)
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

func mcpErrorText(message string) gin.H {
	raw, _ := json.Marshal(gin.H{"error": message})
	return mcpText(string(raw), true)
}
