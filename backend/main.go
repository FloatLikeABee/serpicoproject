package main

import (
	"log"
	"os"

	"serpico/backend/internal/ai"
	"serpico/backend/internal/api"
	db "serpico/backend/internal/database"
	"serpico/backend/internal/middleware"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// @title Serpico API
// @version 0.1
// @description AI Agent assistant helper API for police forces and civilians
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.url http://www.serpico.com/support
// @contact.email support@serpico.com

// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html

// @host localhost:5092
// @BasePath /api/v1

func main() {
	// Initialize database
	database, err := db.Initialize()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Initialize AI service
	aiConfig := ai.LoadConfig()
	aiService, err := ai.NewAIService(aiConfig)
	if err != nil {
		log.Fatalf("Failed to initialize AI service: %v", err)
	}
	log.Println("AI service initialized successfully")

	// Set up router
	r := gin.Default()

	// CORS middleware
	r.Use(middleware.CORS())

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// API routes
	v1 := r.Group("/api/v1")
	{
		api.SetupRoutes(v1, database, aiService)
	}

	// Swagger documentation
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	port := os.Getenv("PORT")
	if port == "" {
		port = "5092"
	}

	log.Printf("Server starting on port %s", port)
	log.Printf("Swagger UI available at http://localhost:%s/swagger/index.html", port)
	
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

