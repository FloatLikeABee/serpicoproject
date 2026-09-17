package api

import (
	"net/http"

	"serpico/backend/internal/ai"

	"github.com/gin-gonic/gin"
)

func handleShuilemeBeds(c *gin.Context) {
	f := ai.ShuilemeBedFilter{
		Size: c.Query("size"),
		Fill: c.Query("fill"),
		Era:  c.Query("era"),
	}
	c.JSON(http.StatusOK, gin.H{"beds": ai.FilterShuilemeBeds(f)})
}

func handleShuilemeBedrooms(c *gin.Context) {
	f := ai.ShuilemeRoomFilter{
		Light:  c.Query("light"),
		Layout: c.Query("layout"),
	}
	c.JSON(http.StatusOK, gin.H{"bedrooms": ai.FilterShuilemeRooms(f)})
}

func handleShuilemeLore(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"articles": ai.ShuilemeLoreArticles()})
}

func handleShuilemeWiki(c *gin.Context) {
	handleLalemWiki(c)
}
