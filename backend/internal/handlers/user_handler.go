package handlers

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/raditzz/lbstaff-backend-go/internal/config"
	"github.com/raditzz/lbstaff-backend-go/internal/models"
)

type UserHandler struct {
	DB     *pgxpool.Pool
	Config *config.Config
}

func NewUserHandler(db *pgxpool.Pool, cfg *config.Config) *UserHandler {
	return &UserHandler{DB: db, Config: cfg}
}

// UpdateAlias menangani PUT /api/user/:nik/alias
func (h *UserHandler) UpdateAlias(c *gin.Context) {
	nik := c.Param("nik")
	var req models.UpdateAliasRequest
	_ = c.ShouldBindJSON(&req)

	var cleanedAlias *string
	if req.Alias != nil {
		trimmed := strings.TrimSpace(*req.Alias)
		if trimmed != "" {
			cleanedAlias = &trimmed
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := `
		UPDATE users 
		SET alias = $1 
		WHERE nik = $2 
		RETURNING id, name, alias, nik;
	`

	var user models.User
	var alias sql.NullString

	err := h.DB.QueryRow(ctx, query, cleanedAlias, nik).Scan(
		&user.ID, &user.Name, &alias, &user.NIK,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Karyawan tidak ditemukan"})
		return
	} else if err != nil {
		log.Printf("❌ Error saat memperbarui alias: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Terjadi kesalahan pada server"})
		return
	}

	if alias.Valid {
		user.Alias = &alias.String
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Alias karyawan berhasil diperbarui",
		"user":    user,
	})
}

// DeleteUser menangani DELETE /api/user/:nik
func (h *UserHandler) DeleteUser(c *gin.Context) {
	nik := c.Param("nik")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Cari user terlebih dahulu
	var user models.User
	var alias sql.NullString
	findQuery := `SELECT id, name, alias, nik FROM users WHERE nik = $1 LIMIT 1`

	err := h.DB.QueryRow(ctx, findQuery, nik).Scan(&user.ID, &user.Name, &alias, &user.NIK)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Karyawan tidak ditemukan"})
		return
	} else if err != nil {
		log.Printf("❌ Error saat mencari user sebelum hapus: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Terjadi kesalahan server"})
		return
	}

	if alias.Valid {
		user.Alias = &alias.String
	}

	// Hapus user dari DB (time_entries dan activity_logs terhapus otomatis via CASCADE)
	_, err = h.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", user.ID)
	if err != nil {
		log.Printf("❌ Error saat menghapus user dari DB: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Terjadi kesalahan server saat menghapus user"})
		return
	}

	// Hapus folder upload screenshot di disk
	userUploadsDir := filepath.Join(h.Config.UploadsDir, fmt.Sprintf("karyawan_%d", user.ID))
	if err := os.RemoveAll(userUploadsDir); err == nil {
		log.Printf("🗑️ [User Cleanup] Folder upload berhasil dihapus: %s", userUploadsDir)
	}

	displayName := user.Name
	if user.Alias != nil && *user.Alias != "" {
		displayName = *user.Alias
	}

	log.Printf("✅ [User Dihapus] User %s (NIK: %s) berhasil dihapus permanen.", user.Name, user.NIK)

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"message":      fmt.Sprintf("User %s (%s) berhasil dihapus permanen", displayName, user.NIK),
		"deleted_user": user,
	})
}
