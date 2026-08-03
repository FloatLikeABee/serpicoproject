package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// userFromRequest resolves the authenticated user id from headers or query.
func userFromRequest(c *gin.Context) string {
	if id := c.GetHeader("X-User-Id"); id != "" {
		return id
	}
	if id := c.Query("userId"); id != "" {
		return id
	}
	return ""
}

func requireUserID(c *gin.Context) (string, bool) {
	id := userFromRequest(c)
	if id == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user id required"})
		return "", false
	}
	return id, true
}
