package api

import (
	"serpico/backend/internal/ai"
	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.RouterGroup, db *database.Database, aiService interface{}) {
	// Auth routes (mock)
	auth := r.Group("/auth")
	{
		auth.POST("/login", handleLogin)
		auth.POST("/login/google", handleGoogleLogin)
		auth.POST("/login/apple", handleAppleLogin)
		auth.POST("/logout", handleLogout)
	}

	// User routes
	users := r.Group("/users")
	{
		users.GET("/me", func(c *gin.Context) { handleGetUser(c, db) })
		users.PUT("/me", func(c *gin.Context) { handleUpdateUser(c, db) })
	}

	// Cases + investigation timeline nodes
	cases := r.Group("/cases")
	{
		cases.GET("", func(c *gin.Context) { handleGetCases(c, db) })
		cases.POST("", func(c *gin.Context) { handleCreateCase(c, db) })
		cases.GET("/:id", func(c *gin.Context) { handleGetCaseWithNodes(c, db) })
		cases.GET("/:id/nodes", func(c *gin.Context) { handleListCaseNodes(c, db) })
		cases.POST("/:id/nodes", func(c *gin.Context) { handleCreateCaseNode(c, db) })
		cases.POST("/:id/nodes/assist", func(c *gin.Context) { handleAssistCaseNode(c, db, aiService) })
	}

	nodes := r.Group("/nodes")
	{
		nodes.PUT("/:id", func(c *gin.Context) { handleUpdateNode(c, db) })
		nodes.DELETE("/:id", func(c *gin.Context) { handleDeleteNode(c, db) })
	}

	// Perps routes
	perps := r.Group("/perps")
	{
		perps.GET("", func(c *gin.Context) { handleGetPerps(c, db) })
		perps.GET("/:id", func(c *gin.Context) { handleGetPerp(c, db) })
	}

	// Officers routes
	officers := r.Group("/officers")
	{
		officers.GET("", func(c *gin.Context) { handleGetOfficers(c, db) })
		officers.GET("/nearby", func(c *gin.Context) { handleGetNearbyOfficers(c, db) })
	}

	// Emergencies routes
	emergencies := r.Group("/emergencies")
	{
		emergencies.GET("", func(c *gin.Context) { handleGetEmergencies(c, db) })
		emergencies.POST("", func(c *gin.Context) { handleCreateEmergency(c, db) })
		emergencies.GET("/:id", func(c *gin.Context) { handleGetEmergency(c, db) })
	}

	// Hard data ingest — MQTT twin over HTTP (no officer auth)
	hardData := r.Group("/hard-data")
	{
		hardData.POST("", func(c *gin.Context) { handleIngestHardData(c, db) })
		hardData.GET("", func(c *gin.Context) { handleListHardData(c, db) })
	}

	// Chat routes
	chat := r.Group("/chat")
	{
		chat.POST("", func(c *gin.Context) { handleChat(c, aiService) })
	}

	// Chase Game routes
	chaseGame := r.Group("/chase-game")
	{
		chaseGame.POST("/start", func(c *gin.Context) { handleChaseGameStart(c, aiService) })
		chaseGame.GET("/:id", func(c *gin.Context) { handleChaseGameGet(c, aiService) })
		chaseGame.POST("/:id/respond", func(c *gin.Context) { handleChaseGameRespond(c, aiService) })
	}

	// Investigation Helper — brainstorm crime scenes + interview questions
	invHelper := r.Group("/investigation-helper")
	{
		invHelper.GET("/sessions", func(c *gin.Context) { handleHelperListSessions(c, db) })
		invHelper.POST("/sessions", func(c *gin.Context) { handleHelperCreateSession(c, db) })
		invHelper.GET("/sessions/:id", func(c *gin.Context) { handleHelperGetSession(c, db) })
		invHelper.PUT("/sessions/:id", func(c *gin.Context) { handleHelperUpdateSession(c, db) })
		invHelper.DELETE("/sessions/:id", func(c *gin.Context) { handleHelperDeleteSession(c, db) })
		invHelper.POST("/sessions/:id/uploads", func(c *gin.Context) { handleHelperUpload(c, db) })
		invHelper.DELETE("/sessions/:id/files/:fileId", func(c *gin.Context) { handleHelperDeleteFile(c, db) })
		invHelper.POST("/sessions/:id/chat", func(c *gin.Context) { handleHelperChat(c, db, aiService) })
		invHelper.GET("/files/:fileId", func(c *gin.Context) { handleHelperGetFile(c, db) })
	}

	// Fleet map — stations, vehicles, crime/event markers
	fleet := r.Group("/fleet")
	{
		fleet.GET("/markers", func(c *gin.Context) { handleFleetListMarkers(c, db) })
		fleet.POST("/markers", func(c *gin.Context) { handleFleetCreateMarker(c, db) })
		fleet.PUT("/markers/:id", func(c *gin.Context) { handleFleetUpdateMarker(c, db) })
		fleet.DELETE("/markers/:id", func(c *gin.Context) { handleFleetDeleteMarker(c, db) })
	}

	// Pursuit Exam routes (per-user map strategy training)
	pursuitExam := r.Group("/pursuit-exam")
	{
		pursuitExam.GET("/state", func(c *gin.Context) { handlePursuitExamState(c, aiService) })
		pursuitExam.POST("/start", func(c *gin.Context) { handlePursuitExamStart(c, aiService) })
		pursuitExam.POST("/arm", func(c *gin.Context) { handlePursuitExamArm(c, aiService) })
		pursuitExam.POST("/pursue", func(c *gin.Context) { handlePursuitExamPursue(c, aiService) })
		pursuitExam.POST("/deploy", func(c *gin.Context) { handlePursuitExamDeploy(c, aiService) })
		pursuitExam.POST("/evaluate", func(c *gin.Context) { handlePursuitExamEvaluate(c, aiService) })
		pursuitExam.POST("/location-evaluate", func(c *gin.Context) { handleLocationTacticsEvaluate(c, aiService) })
	}

	// Mysteries desk — missing persons, cold cases, briefings, insights
	mysteries := r.Group("/mysteries")
	{
		mysteries.GET("/status", func(c *gin.Context) { handleMysteriesStatus(c, aiService) })
		mysteries.GET("/cases", func(c *gin.Context) { handleMysteriesListCases(c, aiService) })
		mysteries.POST("/cases/refresh", func(c *gin.Context) { handleMysteriesRefreshCases(c, aiService) })
		mysteries.GET("/briefings", func(c *gin.Context) { handleMysteriesListBriefings(c, aiService) })
		mysteries.POST("/briefings/refresh", func(c *gin.Context) { handleMysteriesRefreshBriefing(c, aiService) })
		mysteries.GET("/insights", func(c *gin.Context) { handleMysteriesListInsights(c, aiService) })
		mysteries.POST("/insights", func(c *gin.Context) { handleMysteriesSubmitInsight(c, aiService) })
	}

	// Recommendations routes
	recommendations := r.Group("/recommendations")
	{
		recommendations.GET("/routes", handleGetRouteRecommendations)
		recommendations.GET("/pursuit", handleGetPursuitRecommendations)
	}

	// Admin routes
	admin := r.Group("/admin")
	{
		admin.POST("/login", handleAdminLogin)
		admin.GET("/cases", func(c *gin.Context) { handleAdminGetAllCases(c, db) })
		admin.POST("/cases", func(c *gin.Context) { handleAdminCreateCase(c, db) })
		admin.GET("/perps", func(c *gin.Context) { handleAdminGetAllPerps(c, db) })
		admin.POST("/perps", func(c *gin.Context) { handleAdminCreatePerp(c, db) })
		admin.GET("/officers", func(c *gin.Context) { handleAdminGetAllOfficers(c, db) })
		admin.POST("/officers", func(c *gin.Context) { handleAdminCreateOfficer(c, db) })
		admin.GET("/emergencies", func(c *gin.Context) { handleAdminGetAllEmergencies(c, db) })
		admin.POST("/emergencies", func(c *gin.Context) { handleAdminCreateEmergency(c, db) })
		admin.GET("/mysteries", func(c *gin.Context) { handleAdminGetAllMysteries(c, db) })
		admin.POST("/mysteries", func(c *gin.Context) { handleAdminCreateMystery(c, db) })
		admin.GET("/users", func(c *gin.Context) { handleAdminGetAllUsers(c, db) })
		admin.POST("/hardware", func(c *gin.Context) { handleRegisterHardware(c, db) })
		admin.GET("/hardware", func(c *gin.Context) { handleListHardware(c, db) })
		admin.GET("/hardware/:id", func(c *gin.Context) { handleGetHardware(c, db) })
		admin.GET("/hardware/:id/messages", func(c *gin.Context) { handleListHardwareMessages(c, db) })
	}

	// RAG Management routes
	rag := r.Group("/rag")
	{
		rag.GET("/documents", func(c *gin.Context) { handleRAGGetDocuments(c, aiService) })
		rag.GET("/documents/:id", func(c *gin.Context) { handleRAGGetDocument(c, aiService) })
		rag.POST("/documents", func(c *gin.Context) { handleRAGCreateDocument(c, aiService) })
		rag.PUT("/documents/:id", func(c *gin.Context) { handleRAGUpdateDocument(c, aiService) })
		rag.DELETE("/documents/:id", func(c *gin.Context) { handleRAGDeleteDocument(c, aiService) })
		rag.GET("/summaries", func(c *gin.Context) {
			service, ok := aiService.(*ai.AIService)
			if !ok {
				c.JSON(500, gin.H{"error": "AI service type assertion failed"})
				return
			}
			handleGetRAGSummaries(c, service)
		})
	}

	// Data Collection routes (admin only)
	collection := r.Group("/admin/collection")
	{
		collection.POST("/url", func(c *gin.Context) {
			service, ok := aiService.(*ai.AIService)
			if !ok {
				c.JSON(500, gin.H{"error": "AI service type assertion failed"})
				return
			}
			handleCollectFromURL(c, service)
		})
		collection.POST("/api", func(c *gin.Context) {
			service, ok := aiService.(*ai.AIService)
			if !ok {
				c.JSON(500, gin.H{"error": "AI service type assertion failed"})
				return
			}
			handleCollectFromAPI(c, service)
		})
		collection.POST("/file", func(c *gin.Context) {
			service, ok := aiService.(*ai.AIService)
			if !ok {
				c.JSON(500, gin.H{"error": "AI service type assertion failed"})
				return
			}
			handleCollectFromFile(c, service)
		})
		collection.GET("/intel/status", func(c *gin.Context) {
			service, ok := aiService.(*ai.AIService)
			if !ok {
				c.JSON(500, gin.H{"error": "AI service type assertion failed"})
				return
			}
			handleDailyIntelStatus(c, service)
		})
		collection.GET("/intel/news", func(c *gin.Context) {
			service, ok := aiService.(*ai.AIService)
			if !ok {
				c.JSON(500, gin.H{"error": "AI service type assertion failed"})
				return
			}
			handleDailyIntelNews(c, service)
		})
		collection.POST("/intel/run", func(c *gin.Context) {
			service, ok := aiService.(*ai.AIService)
			if !ok {
				c.JSON(500, gin.H{"error": "AI service type assertion failed"})
				return
			}
			handleDailyIntelRun(c, service)
		})
	}
}

