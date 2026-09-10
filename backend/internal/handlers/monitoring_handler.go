package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/raditzz/lbstaff-backend-go/internal/models"
)

type MonitoringHandler struct {
	DB *pgxpool.Pool
}

func NewMonitoringHandler(db *pgxpool.Pool) *MonitoringHandler {
	return &MonitoringHandler{DB: db}
}

// LiveMonitoring menangani GET /api/live-monitoring
func (h *MonitoringHandler) LiveMonitoring(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := `
		SELECT DISTINCT ON (u.nik)
			u.id,
			u.name, 
			u.alias,
			u.nik, 
			COALESCE(u.app_version, t.app_version, '1.0.1') as app_version,
			t.start_time,
			t.end_time,
			CASE 
				WHEN t.end_time IS NOT NULL THEN 999999
				ELSE EXTRACT(EPOCH FROM (NOW() - COALESCE(
					(SELECT MAX(recorded_at) FROM activity_logs WHERE user_id = u.id),
					t.start_time,
					NOW()
				)))::INTEGER
			END as seconds_since_last_activity
		FROM users u
		LEFT JOIN time_entries t ON u.id = t.user_id
		ORDER BY u.nik, t.start_time DESC NULLS LAST;
	`

	rows, err := h.DB.Query(ctx, query)
	if err != nil {
		log.Printf("❌ Error mengambil data live monitoring: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Terjadi kesalahan pada server"})
		return
	}
	defer rows.Close()

	users := make([]models.LiveMonitoringUser, 0)
	for rows.Next() {
		var u models.LiveMonitoringUser
		var alias sql.NullString
		var startTime sql.NullTime
		var endTime sql.NullTime

		err := rows.Scan(
			&u.ID, &u.Name, &alias, &u.NIK, &u.AppVersion,
			&startTime, &endTime, &u.SecondsSinceLastActivity,
		)
		if err != nil {
			log.Printf("⚠️ Error scan row live monitoring: %v", err)
			continue
		}

		if alias.Valid {
			u.Alias = &alias.String
		}
		if startTime.Valid {
			u.StartTime = &startTime.Time
		}
		if endTime.Valid {
			u.EndTime = &endTime.Time
		}

		users = append(users, u)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    users,
	})
}

// UserActivity menangani GET /api/user-activity/:nik
func (h *MonitoringHandler) UserActivity(c *gin.Context) {
	nik := c.Param("nik")
	sessionIDParam := c.Query("session_id")
	limitParam := c.DefaultQuery("limit", "100")

	limit, err := strconv.Atoi(limitParam)
	if err != nil || limit <= 0 {
		limit = 100
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Cari data user dan sesi terbarunya
	userQuery := `
		SELECT u.id as user_id, u.name, u.alias, u.nik, 
		       COALESCE(u.app_version, t.app_version, '1.0.1') as app_version,
		       t.id as time_entry_id, t.start_time, t.end_time
		FROM users u
		LEFT JOIN time_entries t ON u.id = t.user_id
		WHERE u.nik = $1
		ORDER BY (t.end_time IS NULL) DESC, t.start_time DESC NULLS LAST
		LIMIT 1;
	`

	var user models.UserActivityDetail
	var alias sql.NullString
	var appVer sql.NullString
	var activeTimeEntryID sql.NullInt32
	var startTime sql.NullTime
	var endTime sql.NullTime

	err = h.DB.QueryRow(ctx, userQuery, nik).Scan(
		&user.UserID, &user.Name, &alias, &user.NIK, &appVer,
		&activeTimeEntryID, &startTime, &endTime,
	)
	user.ID = user.UserID

	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Karyawan tidak ditemukan."})
		return
	} else if err != nil {
		log.Printf("❌ Error detail aktivitas user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Terjadi kesalahan pada server"})
		return
	}

	if alias.Valid {
		user.Alias = &alias.String
	}
	if appVer.Valid {
		user.AppVersion = appVer.String
	} else {
		user.AppVersion = "1.0.1"
	}
	if activeTimeEntryID.Valid {
		tID := int(activeTimeEntryID.Int32)
		user.TimeEntryID = &tID
	}
	if startTime.Valid {
		user.StartTime = &startTime.Time
	}
	if endTime.Valid {
		user.EndTime = &endTime.Time
	}

	// 2. Ambil riwayat sesi-sesi kerja
	sessionsQuery := `
		SELECT id, start_time, end_time, total_duration_seconds
		FROM time_entries
		WHERE user_id = $1
		ORDER BY start_time DESC
		LIMIT 20;
	`

	sessionRows, err := h.DB.Query(ctx, sessionsQuery, user.ID)
	sessions := make([]models.TimeEntry, 0)
	if err == nil {
		defer sessionRows.Close()
		for sessionRows.Next() {
			var s models.TimeEntry
			var sEnd sql.NullTime
			var sDur sql.NullInt32
			if scanErr := sessionRows.Scan(&s.ID, &s.StartTime, &sEnd, &sDur); scanErr == nil {
				if sEnd.Valid {
					s.EndTime = &sEnd.Time
				}
				if sDur.Valid {
					dur := int(sDur.Int32)
					s.TotalDurationSeconds = &dur
				}
				sessions = append(sessions, s)
			}
		}
	}

	// 3. Ambil log aktivitas
	var logsQuery string
	var queryArgs []interface{}

	if sessionIDParam != "" && sessionIDParam != "all" {
		targetSessionID := 0
		if sessionIDParam == "current" && activeTimeEntryID.Valid {
			targetSessionID = int(activeTimeEntryID.Int32)
		} else {
			targetSessionID, _ = strconv.Atoi(sessionIDParam)
		}

		logsQuery = `
			SELECT id, time_entry_id, screenshot_url, app_and_urls, recorded_at, keyboard_clicks, mouse_moves
			FROM activity_logs
			WHERE user_id = $1 AND time_entry_id = $2
			ORDER BY recorded_at DESC
			LIMIT $3;
		`
		queryArgs = []interface{}{user.ID, targetSessionID, limit}
	} else {
		logsQuery = `
			SELECT id, time_entry_id, screenshot_url, app_and_urls, recorded_at, keyboard_clicks, mouse_moves
			FROM activity_logs
			WHERE user_id = $1
			ORDER BY recorded_at DESC
			LIMIT $2;
		`
		queryArgs = []interface{}{user.ID, limit}
	}

	logRows, err := h.DB.Query(ctx, logsQuery, queryArgs...)
	logs := make([]models.ActivityLog, 0)
	if err == nil {
		defer logRows.Close()
		for logRows.Next() {
			var l models.ActivityLog
			var scURL sql.NullString
			var rawApps []byte

			if scanErr := logRows.Scan(
				&l.ID, &l.TimeEntryID, &scURL, &rawApps, &l.RecordedAt, &l.KeyboardClicks, &l.MouseMoves,
			); scanErr == nil {
				if scURL.Valid {
					l.ScreenshotURL = &scURL.String
					l.ScreenshotPath = &scURL.String
				}
				l.CreatedAt = l.RecordedAt
				if len(rawApps) > 0 {
					l.AppAndURLs = json.RawMessage(rawApps)
				} else {
					l.AppAndURLs = json.RawMessage("[]")
				}
				logs = append(logs, l)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"user":     user,
		"sessions": sessions,
		"logs":     logs,
	})
}

// CheckNewLogCount menangani GET /api/user-activity/:nik/check-new
func (h *MonitoringHandler) CheckNewLogCount(c *gin.Context) {
	nik := c.Param("nik")
	lastTime := c.Query("last_time")
	sessionIDParam := c.Query("session_id")

	if lastTime == "" {
		c.JSON(http.StatusOK, models.CheckNewCountResponse{Success: true, NewCount: 0})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var userID int
	err := h.DB.QueryRow(ctx, "SELECT id FROM users WHERE nik = $1 LIMIT 1", nik).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusOK, models.CheckNewCountResponse{Success: true, NewCount: 0})
		return
	}

	var countQuery string
	var countArgs []interface{}

	if sessionIDParam != "" && sessionIDParam != "all" {
		targetSessionID, _ := strconv.Atoi(sessionIDParam)
		countQuery = `
			SELECT COUNT(*)::INTEGER as count
			FROM activity_logs
			WHERE user_id = $1 AND time_entry_id = $2 AND recorded_at > $3;
		`
		countArgs = []interface{}{userID, targetSessionID, lastTime}
	} else {
		countQuery = `
			SELECT COUNT(*)::INTEGER as count
			FROM activity_logs
			WHERE user_id = $1 AND recorded_at > $2;
		`
		countArgs = []interface{}{userID, lastTime}
	}

	var count int
	_ = h.DB.QueryRow(ctx, countQuery, countArgs...).Scan(&count)

	c.JSON(http.StatusOK, models.CheckNewCountResponse{
		Success:  true,
		NewCount: count,
	})
}
