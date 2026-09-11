package handlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/raditzz/lbstaff-backend-go/internal/config"
)

type TrackHandler struct {
	DB     *pgxpool.Pool
	Config *config.Config
}

func NewTrackHandler(db *pgxpool.Pool, cfg *config.Config) *TrackHandler {
	return &TrackHandler{DB: db, Config: cfg}
}

var base64PrefixRegex = regexp.MustCompile(`^data:image/\w+;base64,`)

type TrackJSONPayload struct {
	UserID           int         `json:"user_id"`
	TimeEntryID      interface{} `json:"time_entry_id"`
	KeyboardClicks   int         `json:"keyboard_clicks"`
	MouseMoves       int         `json:"mouse_moves"`
	AppAndURLs       interface{} `json:"app_and_urls"`
	ScreenshotBase64 string      `json:"screenshot_base64"`
	RecordedAt       string      `json:"recorded_at"`
	AppVersion       string      `json:"app_version"`
	LocationName     string      `json:"location_name"`
	Latitude         *float64    `json:"latitude"`
	Longitude        *float64    `json:"longitude"`
	IPAddress        string      `json:"ip_address"`
}

// Track menangani POST /api/track
func (h *TrackHandler) Track(c *gin.Context) {
	var userID int = 1
	var timeEntryID int = 0
	var keyboardClicks int = 0
	var mouseMoves int = 0
	var appAndURLs string = "[]"
	var screenshotBase64 string
	var recordedAtStr string
	var detectedVersion string
	var locationNameStr string
	var latitudeVal *float64
	var longitudeVal *float64
	var ipAddressStr string

	contentType := c.ContentType()
	if strings.Contains(contentType, "application/json") {
		var jsonPayload TrackJSONPayload
		if err := c.ShouldBindJSON(&jsonPayload); err == nil {
			if jsonPayload.UserID > 0 {
				userID = jsonPayload.UserID
			}
			keyboardClicks = jsonPayload.KeyboardClicks
			mouseMoves = jsonPayload.MouseMoves
			screenshotBase64 = jsonPayload.ScreenshotBase64
			recordedAtStr = jsonPayload.RecordedAt
			detectedVersion = jsonPayload.AppVersion
			locationNameStr = jsonPayload.LocationName
			latitudeVal = jsonPayload.Latitude
			longitudeVal = jsonPayload.Longitude
			ipAddressStr = jsonPayload.IPAddress

			// Parse time_entry_id (bisa int atau string dari offline queue)
			switch v := jsonPayload.TimeEntryID.(type) {
			case float64:
				timeEntryID = int(v)
			case int:
				timeEntryID = v
			case string:
				fmt.Sscanf(v, "%d", &timeEntryID)
			}

			// Format app_and_urls
			if jsonPayload.AppAndURLs != nil {
				if b, err := json.Marshal(jsonPayload.AppAndURLs); err == nil {
					appAndURLs = string(b)
				}
			}
		}
	} else {
		// Form data / Multipart
		userIDStr := c.PostForm("user_id")
		timeEntryIDStr := c.PostForm("time_entry_id")
		keyboardClicksStr := c.PostForm("keyboard_clicks")
		mouseMovesStr := c.PostForm("mouse_moves")
		appAndURLs = c.PostForm("app_and_urls")
		screenshotBase64 = c.PostForm("screenshot_base64")
		recordedAtStr = c.PostForm("recorded_at")
		detectedVersion = c.PostForm("app_version")
		locationNameStr = c.PostForm("location_name")
		ipAddressStr = c.PostForm("ip_address")
		latStr := c.PostForm("latitude")
		lngStr := c.PostForm("longitude")

		if lat, err := strconv.ParseFloat(latStr, 64); err == nil {
			latitudeVal = &lat
		}
		if lng, err := strconv.ParseFloat(lngStr, 64); err == nil {
			longitudeVal = &lng
		}

		if v, err := strconv.Atoi(userIDStr); err == nil && v > 0 {
			userID = v
		}
		if v, err := strconv.Atoi(timeEntryIDStr); err == nil && v > 0 {
			timeEntryID = v
		}
		if v, err := strconv.Atoi(keyboardClicksStr); err == nil {
			keyboardClicks = v
		}
		if v, err := strconv.Atoi(mouseMovesStr); err == nil {
			mouseMoves = v
		}
	}

	if ipAddressStr == "" {
		ipAddressStr = c.ClientIP()
	}

	if detectedVersion == "" {
		detectedVersion = c.GetHeader("x-app-version")
	}

	logTimestamp := time.Now()
	if recordedAtStr != "" {
		if parsed, err := time.Parse(time.RFC3339, recordedAtStr); err == nil {
			logTimestamp = parsed
		} else if parsed, err := time.Parse("2006-01-02 15:04:05", recordedAtStr); err == nil {
			logTimestamp = parsed
		}
	}

	monthYear := logTimestamp.Format("2006-01")
	targetDir := filepath.Join(h.Config.UploadsDir, fmt.Sprintf("karyawan_%d", userID), monthYear)
	_ = os.MkdirAll(targetDir, 0755)

	var screenshotURL *string

	// 1. Cek upload file multipart 'screenshot' (jika form-data)
	file, err := c.FormFile("screenshot")
	if err == nil && file != nil {
		filename := fmt.Sprintf("screenshot_%d.jpg", time.Now().UnixMilli())
		fullPath := filepath.Join(targetDir, filename)
		if saveErr := c.SaveUploadedFile(file, fullPath); saveErr == nil {
			relPath, _ := filepath.Rel(h.Config.UploadsDir, fullPath)
			urlStr := "/uploads/" + strings.ReplaceAll(relPath, "\\", "/")
			screenshotURL = &urlStr
			log.Printf("[BERHASIL] File screenshot tersimpan di: %s (URL: %s)", fullPath, urlStr)
		} else {
			log.Printf("⚠️ Gagal menyimpan screenshot upload: %v", saveErr)
		}
	} else if screenshotBase64 != "" {
		// 2. Cek payload Base64
		cleaned := base64PrefixRegex.ReplaceAllString(screenshotBase64, "")
		data, decErr := base64.StdEncoding.DecodeString(cleaned)
		if decErr == nil {
			filename := fmt.Sprintf("screenshot_%d_%d.jpg", time.Now().UnixMilli(), rand.Intn(1000))
			fullPath := filepath.Join(targetDir, filename)
			if writeErr := os.WriteFile(fullPath, data, 0644); writeErr == nil {
				relPath, _ := filepath.Rel(h.Config.UploadsDir, fullPath)
				urlStr := "/uploads/" + strings.ReplaceAll(relPath, "\\", "/")
				screenshotURL = &urlStr
				log.Printf("[BERHASIL Base64] File screenshot tersimpan di: %s (URL: %s)", fullPath, urlStr)
			}
		}
	}

	// Validasi JSON apps
	parsedApps := "[]"
	if appAndURLs != "" {
		var js json.RawMessage
		if json.Unmarshal([]byte(appAndURLs), &js) == nil {
			parsedApps = appAndURLs
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Update versi user jika ada
	if detectedVersion != "" && userID > 0 {
		_, _ = h.DB.Exec(ctx, "UPDATE users SET app_version = $1 WHERE id = $2", detectedVersion, userID)
	}

	var locationNamePtr *string
	if locationNameStr != "" {
		locationNamePtr = &locationNameStr
	}
	var ipAddressPtr *string
	if ipAddressStr != "" {
		ipAddressPtr = &ipAddressStr
	}

	// Verifikasi / Temukan Sesi Aktif
	activeTimeEntryID := timeEntryID
	if activeTimeEntryID == 0 {
		var foundID int
		err := h.DB.QueryRow(ctx,
			"SELECT id FROM time_entries WHERE user_id = $1 AND end_time IS NULL ORDER BY start_time DESC LIMIT 1",
			userID,
		).Scan(&foundID)

		if err == nil && foundID > 0 {
			activeTimeEntryID = foundID
			_, _ = h.DB.Exec(ctx,
				"UPDATE time_entries SET app_version = COALESCE(NULLIF($1, ''), app_version), location_name = COALESCE($2, location_name), latitude = COALESCE($3, latitude), longitude = COALESCE($4, longitude), ip_address = COALESCE($5, ip_address) WHERE id = $6",
				detectedVersion, locationNamePtr, latitudeVal, longitudeVal, ipAddressPtr, activeTimeEntryID)
		} else {
			// Buat sesi baru
			var newID int
			var appVer *string
			if detectedVersion != "" {
				appVer = &detectedVersion
			}
			insErr := h.DB.QueryRow(ctx,
				"INSERT INTO time_entries (user_id, start_time, app_version, location_name, latitude, longitude, ip_address) VALUES ($1, NOW(), $2, $3, $4, $5, $6) RETURNING id",
				userID, appVer, locationNamePtr, latitudeVal, longitudeVal, ipAddressPtr,
			).Scan(&newID)
			if insErr == nil {
				activeTimeEntryID = newID
			}
		}
	} else {
		_, _ = h.DB.Exec(ctx,
			"UPDATE time_entries SET app_version = COALESCE(NULLIF($1, ''), app_version), location_name = COALESCE($2, location_name), latitude = COALESCE($3, latitude), longitude = COALESCE($4, longitude), ip_address = COALESCE($5, ip_address) WHERE id = $6",
			detectedVersion, locationNamePtr, latitudeVal, longitudeVal, ipAddressPtr, activeTimeEntryID)
	}

	// Insert ke activity_logs
	insertQuery := `
		INSERT INTO activity_logs 
		(user_id, time_entry_id, recorded_at, screenshot_url, keyboard_clicks, mouse_moves, app_and_urls, location_name, latitude, longitude, ip_address) 
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
		RETURNING id;
	`

	var logID int
	err = h.DB.QueryRow(ctx, insertQuery,
		userID, activeTimeEntryID, logTimestamp, screenshotURL, keyboardClicks, mouseMoves, parsedApps, locationNamePtr, latitudeVal, longitudeVal, ipAddressPtr,
	).Scan(&logID)

	if err != nil {
		log.Printf("❌ Error saat menyimpan activity_log: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	log.Printf("✅ [Log Disimpan] ID: %d untuk User: %d, Sesi: %d (Waktu: %s)",
		logID, userID, activeTimeEntryID, logTimestamp.Format(time.RFC3339))

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Data aktivitas berhasil disimpan",
		"log_id":  logID,
	})
}
