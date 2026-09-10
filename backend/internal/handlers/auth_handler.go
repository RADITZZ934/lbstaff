package handlers

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/raditzz/lbstaff-backend-go/internal/models"
)

type AuthHandler struct {
	DB *pgxpool.Pool
}

func NewAuthHandler(db *pgxpool.Pool) *AuthHandler {
	return &AuthHandler{DB: db}
}

// Login menangani POST/GET /api/login (dengan NIK dan versi aplikasi opsional)
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest

	// Coba bind dari JSON body jika ada
	if err := c.ShouldBind(&req); err != nil {
		// Abaikan error binding jika data dikirim via query
	}

	// Fallback ke query param jika belum terisi
	if req.NIK == "" {
		req.NIK = c.Query("nik")
	}

	// Tangkap header x-app-version jika app_version di body kosong
	if req.AppVersion == "" {
		req.AppVersion = c.GetHeader("x-app-version")
	}

	if req.NIK == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "NIK tidak boleh kosong",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	var alias sql.NullString
	var email sql.NullString
	var appVersion sql.NullString

	query := `SELECT id, name, alias, app_version, email, role, nik FROM users WHERE nik = $1 LIMIT 1`
	err := h.DB.QueryRow(ctx, query, req.NIK).Scan(
		&user.ID, &user.Name, &alias, &appVersion, &email, &user.Role, &user.NIK,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		// Pendaftaran otomatis jika NIK belum ada
		log.Printf("[Pendaftaran Otomatis] NIK %s tidak ditemukan. Membuat user baru...", req.NIK)

		var newAppVer *string
		if req.AppVersion != "" {
			newAppVer = &req.AppVersion
		}

		insertQuery := `
			INSERT INTO users (name, email, role, nik, password_hash, app_version)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id, name, alias, email, role, nik, app_version;
		`
		defaultName := fmt.Sprintf("Karyawan %s", req.NIK)
		defaultEmail := fmt.Sprintf("karyawan_%s@lbstaff.local", req.NIK)

		err = h.DB.QueryRow(ctx, insertQuery,
			defaultName, defaultEmail, "karyawan", req.NIK, "auto-generated", newAppVer,
		).Scan(&user.ID, &user.Name, &alias, &email, &user.Role, &user.NIK, &appVersion)

		if err != nil {
			log.Printf("❌ Error saat pendaftaran otomatis: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Terjadi kesalahan pada server"})
			return
		}
		log.Printf("✅ [User Baru Terdaftar] ID: %d, Nama: %s", user.ID, user.Name)
	} else if err != nil {
		log.Printf("❌ Error database saat login: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Terjadi kesalahan pada server"})
		return
	} else {
		// Update app_version jika ada versi baru yang dikirim
		if req.AppVersion != "" && (!appVersion.Valid || appVersion.String != req.AppVersion) {
			_, _ = h.DB.Exec(ctx, "UPDATE users SET app_version = $1 WHERE id = $2", req.AppVersion, user.ID)
			appVersion = sql.NullString{String: req.AppVersion, Valid: true}
		}
	}

	if alias.Valid {
		user.Alias = &alias.String
	}
	if email.Valid {
		user.Email = &email.String
	}
	if appVersion.Valid {
		user.AppVersion = &appVersion.String
	}

	// Buat Sesi Kerja baru di time_entries
	var sessionID int
	var sessionAppVer *string
	if req.AppVersion != "" {
		sessionAppVer = &req.AppVersion
	}

	sessionQuery := `INSERT INTO time_entries (user_id, start_time, app_version) VALUES ($1, NOW(), $2) RETURNING id`
	err = h.DB.QueryRow(ctx, sessionQuery, user.ID, sessionAppVer).Scan(&sessionID)
	if err != nil {
		log.Printf("❌ Error saat membuat sesi time_entry: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal membuat sesi kerja"})
		return
	}

	c.JSON(http.StatusOK, models.LoginResponse{
		Success:     true,
		Message:     "Login berhasil",
		User:        user,
		TimeEntryID: sessionID,
	})
}

// StopSession menangani POST /api/stop-session
func (h *AuthHandler) StopSession(c *gin.Context) {
	var req models.StopSessionRequest
	_ = c.ShouldBind(&req)

	if req.TimeEntryID == 0 {
		if val := c.Query("time_entry_id"); val != "" {
			fmt.Sscanf(val, "%d", &req.TimeEntryID)
		}
	}

	if req.TimeEntryID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "ID Sesi tidak ditemukan"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	updateQuery := `
		UPDATE time_entries 
		SET end_time = NOW(),
		    total_duration_seconds = ROUND(EXTRACT(EPOCH FROM (NOW() - start_time)))::INTEGER
		WHERE id = $1 
		RETURNING id, user_id, start_time, end_time, total_duration_seconds, app_version, created_at;
	`

	var entry models.TimeEntry
	var appVer sql.NullString

	err := h.DB.QueryRow(ctx, updateQuery, req.TimeEntryID).Scan(
		&entry.ID, &entry.UserID, &entry.StartTime, &entry.EndTime, &entry.TotalDurationSeconds, &appVer, &entry.CreatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Sesi tidak ditemukan"})
		return
	} else if err != nil {
		log.Printf("❌ Error saat menutup sesi: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Terjadi kesalahan pada server"})
		return
	}

	if appVer.Valid {
		entry.AppVersion = &appVer.String
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Sesi kerja berhasil diakhiri",
		"data":    entry,
	})
}
