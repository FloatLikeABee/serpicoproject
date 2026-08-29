package api

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"serpico/backend/internal/ai"
	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func helperUserID(c *gin.Context) string {
	if id := strings.TrimSpace(c.GetHeader("X-User-Id")); id != "" {
		return id
	}
	if id := strings.TrimSpace(c.Query("userId")); id != "" {
		return id
	}
	return "guest"
}

func helperUploadRoot() string {
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "data"
	}
	return filepath.Join(dataDir, "investigation-helper", "uploads")
}

type helperSessionRow struct {
	ID        string `json:"id"`
	UserID    string `json:"userId"`
	Title     string `json:"title"`
	Summary   string `json:"summary"`
	Notes     string `json:"notes"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type helperMessageRow struct {
	ID        string `json:"id"`
	SessionID string `json:"sessionId"`
	Role      string `json:"role"`
	Content   string `json:"content"`
	CreatedAt string `json:"createdAt"`
}

type helperFileRow struct {
	ID        string `json:"id"`
	SessionID string `json:"sessionId"`
	Filename  string `json:"filename"`
	MimeType  string `json:"mimeType"`
	SizeBytes int64  `json:"sizeBytes"`
	URL       string `json:"url"`
	CreatedAt string `json:"createdAt"`
}

func helperOwnsSession(db *database.Database, sessionID, userID string) bool {
	var id string
	err := db.SQLite.QueryRow(
		`SELECT id FROM investigation_helper_sessions WHERE id = ? AND user_id = ?`,
		sessionID, userID,
	).Scan(&id)
	return err == nil
}

func listHelperMessages(db *database.Database, sessionID string) ([]helperMessageRow, error) {
	rows, err := db.SQLite.Query(`
		SELECT id, session_id, role, content, created_at
		FROM investigation_helper_messages
		WHERE session_id = ?
		ORDER BY created_at ASC`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []helperMessageRow{}
	for rows.Next() {
		var m helperMessageRow
		if err := rows.Scan(&m.ID, &m.SessionID, &m.Role, &m.Content, &m.CreatedAt); err == nil {
			out = append(out, m)
		}
	}
	return out, nil
}

func listHelperFiles(db *database.Database, sessionID string) ([]helperFileRow, error) {
	rows, err := db.SQLite.Query(`
		SELECT id, session_id, filename, COALESCE(mime_type,''), size_bytes, storage_path, created_at
		FROM investigation_helper_files
		WHERE session_id = ?
		ORDER BY created_at ASC`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []helperFileRow{}
	for rows.Next() {
		var f helperFileRow
		var storagePath string
		if err := rows.Scan(&f.ID, &f.SessionID, &f.Filename, &f.MimeType, &f.SizeBytes, &storagePath, &f.CreatedAt); err == nil {
			f.URL = "/api/v1/investigation-helper/files/" + f.ID
			out = append(out, f)
		}
	}
	return out, nil
}

func loadHelperSession(db *database.Database, sessionID, userID string) (gin.H, error) {
	var s helperSessionRow
	err := db.SQLite.QueryRow(`
		SELECT id, user_id, title, COALESCE(summary,''), COALESCE(notes,''), created_at, updated_at
		FROM investigation_helper_sessions WHERE id = ? AND user_id = ?`, sessionID, userID,
	).Scan(&s.ID, &s.UserID, &s.Title, &s.Summary, &s.Notes, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, err
	}
	messages, err := listHelperMessages(db, sessionID)
	if err != nil {
		return nil, err
	}
	files, err := listHelperFiles(db, sessionID)
	if err != nil {
		return nil, err
	}
	return gin.H{
		"session":  s,
		"messages": messages,
		"files":    files,
	}, nil
}

func handleHelperListSessions(c *gin.Context, db *database.Database) {
	userID := helperUserID(c)
	rows, err := db.SQLite.Query(`
		SELECT id, user_id, title, COALESCE(summary,''), COALESCE(notes,''), created_at, updated_at
		FROM investigation_helper_sessions
		WHERE user_id = ?
		ORDER BY updated_at DESC`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	sessions := []helperSessionRow{}
	for rows.Next() {
		var s helperSessionRow
		if err := rows.Scan(&s.ID, &s.UserID, &s.Title, &s.Summary, &s.Notes, &s.CreatedAt, &s.UpdatedAt); err == nil {
			sessions = append(sessions, s)
		}
	}
	c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

func handleHelperCreateSession(c *gin.Context, db *database.Database) {
	userID := helperUserID(c)
	var req struct {
		Title   string `json:"title"`
		Summary string `json:"summary"`
		Notes   string `json:"notes"`
	}
	_ = c.ShouldBindJSON(&req)
	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "Investigation " + time.Now().UTC().Format("Jan 2 15:04")
	}
	now := time.Now().UTC().Format(time.RFC3339)
	id := "invh-" + uuid.New().String()[:10]
	_, err := db.SQLite.Exec(`
		INSERT INTO investigation_helper_sessions (id, user_id, title, summary, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, userID, title, strings.TrimSpace(req.Summary), strings.TrimSpace(req.Notes), now, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	welcome := helperWelcomeMessage()
	msgID := "msg-" + uuid.New().String()[:8]
	_, _ = db.SQLite.Exec(`
		INSERT INTO investigation_helper_messages (id, session_id, role, content, created_at)
		VALUES (?, ?, 'assistant', ?, ?)`, msgID, id, welcome, now)

	payload, err := loadHelperSession(db, id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, payload)
}

func helperWelcomeMessage() string {
	return `### Investigation Helper

**10-4.** Upload crime-scene photos or case files, then brainstorm with me.

I can help you:
- organize facts and open questions
- spot gaps in the evidence picture
- draft **suspect interview questions** (PEACE / free recall / SUE — non-coercive)

**Start by:** uploading evidence, or pasting a short case brief (what happened, known facts, suspects, goals).`
}

func handleHelperGetSession(c *gin.Context, db *database.Database) {
	userID := helperUserID(c)
	payload, err := loadHelperSession(db, c.Param("id"), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}
	c.JSON(http.StatusOK, payload)
}

func handleHelperUpdateSession(c *gin.Context, db *database.Database) {
	userID := helperUserID(c)
	sessionID := c.Param("id")
	if !helperOwnsSession(db, sessionID, userID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}
	var req struct {
		Title   *string `json:"title"`
		Summary *string `json:"summary"`
		Notes   *string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)
		if title == "" {
			title = "Investigation"
		}
		_, _ = db.SQLite.Exec(`UPDATE investigation_helper_sessions SET title = ?, updated_at = ? WHERE id = ?`, title, now, sessionID)
	}
	if req.Summary != nil {
		_, _ = db.SQLite.Exec(`UPDATE investigation_helper_sessions SET summary = ?, updated_at = ? WHERE id = ?`, strings.TrimSpace(*req.Summary), now, sessionID)
	}
	if req.Notes != nil {
		_, _ = db.SQLite.Exec(`UPDATE investigation_helper_sessions SET notes = ?, updated_at = ? WHERE id = ?`, strings.TrimSpace(*req.Notes), now, sessionID)
	}
	payload, err := loadHelperSession(db, sessionID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, payload)
}

func handleHelperDeleteSession(c *gin.Context, db *database.Database) {
	userID := helperUserID(c)
	sessionID := c.Param("id")
	if !helperOwnsSession(db, sessionID, userID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}
	rows, err := db.SQLite.Query(`SELECT storage_path FROM investigation_helper_files WHERE session_id = ?`, sessionID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var sp string
			if rows.Scan(&sp) == nil {
				_ = os.Remove(filepath.Join(helperUploadRoot(), sp))
			}
		}
	}
	_, _ = db.SQLite.Exec(`DELETE FROM investigation_helper_messages WHERE session_id = ?`, sessionID)
	_, _ = db.SQLite.Exec(`DELETE FROM investigation_helper_files WHERE session_id = ?`, sessionID)
	_, _ = db.SQLite.Exec(`DELETE FROM investigation_helper_sessions WHERE id = ?`, sessionID)
	_ = os.RemoveAll(filepath.Join(helperUploadRoot(), sessionID))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func sanitizeUploadName(name string) string {
	name = filepath.Base(name)
	name = strings.ReplaceAll(name, "..", ".")
	name = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '.' || r == '-' || r == '_' {
			return r
		}
		return '_'
	}, name)
	if name == "" || name == "." {
		return "upload.bin"
	}
	return name
}

func handleHelperUpload(c *gin.Context, db *database.Database) {
	userID := helperUserID(c)
	sessionID := c.Param("id")
	if !helperOwnsSession(db, sessionID, userID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	if fileHeader.Size > 12<<20 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file too large (max 12MB)"})
		return
	}

	src, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer src.Close()

	fileID := "file-" + uuid.New().String()[:10]
	safeName := sanitizeUploadName(fileHeader.Filename)
	dir := filepath.Join(helperUploadRoot(), sessionID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	storageName := fileID + "_" + safeName
	absPath := filepath.Join(dir, storageName)
	dst, err := os.Create(absPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	written, err := io.Copy(dst, src)
	dst.Close()
	if err != nil {
		_ = os.Remove(absPath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	now := time.Now().UTC().Format(time.RFC3339)
	relPath := filepath.Join(sessionID, storageName)
	_, err = db.SQLite.Exec(`
		INSERT INTO investigation_helper_files (id, session_id, filename, mime_type, size_bytes, storage_path, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		fileID, sessionID, fileHeader.Filename, mimeType, written, relPath, now)
	if err != nil {
		_ = os.Remove(absPath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	_, _ = db.SQLite.Exec(`UPDATE investigation_helper_sessions SET updated_at = ? WHERE id = ?`, now, sessionID)

	c.JSON(http.StatusCreated, gin.H{
		"file": helperFileRow{
			ID: fileID, SessionID: sessionID, Filename: fileHeader.Filename,
			MimeType: mimeType, SizeBytes: written,
			URL: "/api/v1/investigation-helper/files/" + fileID, CreatedAt: now,
		},
	})
}

func handleHelperGetFile(c *gin.Context, db *database.Database) {
	fileID := c.Param("fileId")
	var sessionID, filename, mimeType, storagePath string
	err := db.SQLite.QueryRow(`
		SELECT session_id, filename, COALESCE(mime_type,''), storage_path
		FROM investigation_helper_files WHERE id = ?`, fileID,
	).Scan(&sessionID, &filename, &mimeType, &storagePath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}
	userID := helperUserID(c)
	if !helperOwnsSession(db, sessionID, userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}
	abs := filepath.Join(helperUploadRoot(), storagePath)
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	c.Header("Content-Disposition", `inline; filename="`+sanitizeUploadName(filename)+`"`)
	c.File(abs)
}

func handleHelperDeleteFile(c *gin.Context, db *database.Database) {
	userID := helperUserID(c)
	sessionID := c.Param("id")
	fileID := c.Param("fileId")
	if !helperOwnsSession(db, sessionID, userID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}
	var storagePath string
	err := db.SQLite.QueryRow(
		`SELECT storage_path FROM investigation_helper_files WHERE id = ? AND session_id = ?`,
		fileID, sessionID,
	).Scan(&storagePath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}
	_, _ = db.SQLite.Exec(`DELETE FROM investigation_helper_files WHERE id = ?`, fileID)
	_ = os.Remove(filepath.Join(helperUploadRoot(), storagePath))
	now := time.Now().UTC().Format(time.RFC3339)
	_, _ = db.SQLite.Exec(`UPDATE investigation_helper_sessions SET updated_at = ? WHERE id = ?`, now, sessionID)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func helperChatContext(c *gin.Context) string {
	ctx := "investigation-helper"
	if helperNation(c) == "cn" {
		ctx += "\n[nation:cn]"
	}
	return ctx
}

func handleHelperChat(c *gin.Context, db *database.Database, aiService interface{}) {
	userID := helperUserID(c)
	sessionID := c.Param("id")
	if !helperOwnsSession(db, sessionID, userID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}
	var req struct {
		Message string `json:"message"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Message) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "message is required"})
		return
	}

	var title, summary, notes string
	_ = db.SQLite.QueryRow(
		`SELECT title, COALESCE(summary,''), COALESCE(notes,'') FROM investigation_helper_sessions WHERE id = ?`,
		sessionID,
	).Scan(&title, &summary, &notes)

	files, _ := listHelperFiles(db, sessionID)
	prior, _ := listHelperMessages(db, sessionID)

	now := time.Now().UTC().Format(time.RFC3339)
	userMsgID := "msg-" + uuid.New().String()[:8]
	_, err := db.SQLite.Exec(`
		INSERT INTO investigation_helper_messages (id, session_id, role, content, created_at)
		VALUES (?, ?, 'user', ?, ?)`, userMsgID, sessionID, strings.TrimSpace(req.Message), now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	history := make([]ai.ChatHistoryMessage, 0, len(prior))
	for _, m := range prior {
		if m.Role != "user" && m.Role != "assistant" {
			continue
		}
		// skip welcome-only noise beyond a few turns by sending last 16
		history = append(history, ai.ChatHistoryMessage{Role: m.Role, Content: m.Content})
	}
	if len(history) > 16 {
		history = history[len(history)-16:]
	}

	var attach strings.Builder
	attach.WriteString("Session title: " + title + "\n")
	if summary != "" {
		attach.WriteString("Case summary: " + summary + "\n")
	}
	if notes != "" {
		attach.WriteString("Officer notes: " + notes + "\n")
	}
	if len(files) > 0 {
		attach.WriteString("Uploaded evidence files:\n")
	}
	rows, qerr := db.SQLite.Query(
		`SELECT filename, COALESCE(mime_type,''), storage_path FROM investigation_helper_files WHERE session_id = ?`,
		sessionID,
	)
	if qerr == nil {
		defer rows.Close()
		for rows.Next() {
			var fn, mt, sp string
			if rows.Scan(&fn, &mt, &sp) != nil {
				continue
			}
			attach.WriteString("- " + fn + " (" + mt + ")\n")
			lower := strings.ToLower(fn)
			if strings.HasPrefix(mt, "text/") || strings.HasSuffix(lower, ".txt") || strings.HasSuffix(lower, ".md") || strings.HasSuffix(lower, ".csv") || strings.HasSuffix(lower, ".json") {
				if snippet := readHelperTextSnippet(filepath.Join(helperUploadRoot(), sp)); snippet != "" {
					attach.WriteString("Content excerpt from " + fn + ":\n" + snippet + "\n")
				}
			} else if strings.HasPrefix(mt, "image/") {
				attach.WriteString("Image on file: " + fn + " — ask the officer what they observe in it if not yet described.\n")
			}
		}
	}

	userPrompt := attach.String() + "\nOfficer message:\n" + strings.TrimSpace(req.Message)

	aiSvc, ok := aiService.(interface {
		ProcessChat(userMessage string, context string, history []ai.ChatHistoryMessage) (string, error)
	})
	if !ok {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI service not available"})
		return
	}
	reply, err := aiSvc.ProcessChat(userPrompt, helperChatContext(c), history)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	asstID := "msg-" + uuid.New().String()[:8]
	asstNow := time.Now().UTC().Format(time.RFC3339)
	_, _ = db.SQLite.Exec(`
		INSERT INTO investigation_helper_messages (id, session_id, role, content, created_at)
		VALUES (?, ?, 'assistant', ?, ?)`, asstID, sessionID, reply, asstNow)
	_, _ = db.SQLite.Exec(`UPDATE investigation_helper_sessions SET updated_at = ? WHERE id = ?`, asstNow, sessionID)

	// Auto-title from first real user message if still default-ish
	if strings.HasPrefix(title, "Investigation ") && len(req.Message) > 8 {
		auto := strings.TrimSpace(req.Message)
		if len(auto) > 48 {
			auto = auto[:48] + "…"
		}
		_, _ = db.SQLite.Exec(`UPDATE investigation_helper_sessions SET title = ?, updated_at = ? WHERE id = ?`, auto, asstNow, sessionID)
	}

	payload, err := loadHelperSession(db, sessionID, userID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"message": helperMessageRow{ID: asstID, SessionID: sessionID, Role: "assistant", Content: reply, CreatedAt: asstNow},
		})
		return
	}
	c.JSON(http.StatusOK, payload)
}

func readHelperTextSnippet(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	if len(data) > 4000 {
		data = data[:4000]
	}
	return strings.TrimSpace(string(data))
}
