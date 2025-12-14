package api

import (
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
		users.PUT("/me", handleUpdateUser)
	}

	// Cases routes
	cases := r.Group("/cases")
	{
		cases.GET("", func(c *gin.Context) { handleGetCases(c, db) })
		cases.GET("/:id", func(c *gin.Context) { handleGetCase(c, db) })
		cases.POST("", func(c *gin.Context) { handleCreateCase(c, db) })
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

	// Chat routes
	chat := r.Group("/chat")
	{
		chat.POST("", func(c *gin.Context) { handleChat(c, aiService) })
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
		admin.GET("/users", func(c *gin.Context) { handleAdminGetAllUsers(c, db) })
	}

	// RAG Management routes
	rag := r.Group("/rag")
	{
		rag.GET("/documents", func(c *gin.Context) { handleRAGGetDocuments(c, aiService) })
		rag.GET("/documents/:id", func(c *gin.Context) { handleRAGGetDocument(c, aiService) })
		rag.POST("/documents", func(c *gin.Context) { handleRAGCreateDocument(c, aiService) })
		rag.PUT("/documents/:id", func(c *gin.Context) { handleRAGUpdateDocument(c, aiService) })
		rag.DELETE("/documents/:id", func(c *gin.Context) { handleRAGDeleteDocument(c, aiService) })
	}
}

