package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/raditzz/lbstaff-backend-go/internal/config"
	"github.com/raditzz/lbstaff-backend-go/internal/utils"
)

type UpdateHandler struct {
	Config *config.Config
	client *http.Client
}

func NewUpdateHandler(cfg *config.Config) *UpdateHandler {
	return &UpdateHandler{
		Config: cfg,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

type BramUpdateResponse struct {
	Versi      string `json:"versi"`
	UpdateDate string `json:"update_date"`
	Ukuran     string `json:"ukuran"`
	Nama       string `json:"nama"`
	Link       string `json:"link"`
}

// LatestYML menangani GET /updates/latest.yml & GET /api/updates/latest.yml
func (h *UpdateHandler) LatestYML(c *gin.Context) {
	fileId := h.Config.UpdateFileID
	bramURL := fmt.Sprintf("https://braminnovation.com/api/checkupdate/file/%s", fileId)

	resp, err := h.client.Get(bramURL)
	if err == nil && resp.StatusCode == http.StatusOK {
		defer resp.Body.Close()
		var bramData BramUpdateResponse
		if decErr := json.NewDecoder(resp.Body).Decode(&bramData); decErr == nil {
			downloadURL := strings.Replace(bramData.Link, "http://", "https://", 1)
			if downloadURL == "" {
				downloadURL = fmt.Sprintf("https://braminnovation.com/api/files/download/%s", fileId)
			}
			version := bramData.Versi
			if version == "" {
				version = "1.0.2"
			}
			updateDate := bramData.UpdateDate
			if updateDate == "" {
				updateDate = time.Now().Format(time.RFC3339)
			}

			ymlContent := fmt.Sprintf("version: %s\nfiles:\n  - url: %s\npath: %s\nreleaseDate: '%s'\n",
				version, downloadURL, downloadURL, updateDate)

			c.Header("Content-Type", "text/yaml; charset=utf-8")
			c.Header("Cache-Control", "no-cache")
			c.String(http.StatusOK, ymlContent)
			return
		}
	}

	// Fallback ke file fisik jika ada di disk lokal
	localYml := filepath.Join(h.Config.UpdatesDir, "latest.yml")
	if fi, statErr := os.Stat(localYml); statErr == nil && !fi.IsDir() {
		c.Header("Content-Type", "text/yaml; charset=utf-8")
		c.Header("Cache-Control", "no-cache")
		c.File(localYml)
		return
	}

	log.Printf("⚠️ [UpdateHandler] Gagal mengambil latest.yml dari Bram Innovation & disk lokal: %v", err)
	c.String(http.StatusNotFound, "Update metadata tidak ditemukan")
}

// ServeScreenshot menangani GET /api/screenshot dan static serve /uploads/*
func (h *UpdateHandler) ServeScreenshot(c *gin.Context) {
	requestedPath := c.Query("path")
	if requestedPath == "" {
		requestedPath = c.Query("url")
	}
	if requestedPath == "" {
		requestedPath = c.Param("filepath")
	}

	foundPath := utils.FindUploadFile(requestedPath, h.Config.UploadsDir)
	if foundPath != "" {
		c.Header("Cache-Control", "public, max-age=86400")
		c.File(foundPath)
		return
	}

	c.String(http.StatusNotFound, "Gambar tidak ditemukan")
}
