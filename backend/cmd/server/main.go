package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/raditzz/lbstaff-backend-go/internal/config"
	"github.com/raditzz/lbstaff-backend-go/internal/database"
	"github.com/raditzz/lbstaff-backend-go/internal/handlers"
	"github.com/raditzz/lbstaff-backend-go/internal/middleware"
)

func main() {
	log.Println("🚀 Inisialisasi Lbstaff Backend (Golang)...")

	// 1. Muat konfigurasi
	cfg := config.LoadConfig()

	// 2. Koneksi ke Database PostgreSQL
	dbPool, err := database.InitDB(cfg)
	if err != nil {
		log.Fatalf("❌ Gagal inisialisasi database: %v", err)
	}
	defer dbPool.Close()

	// 3. Setup Gin Engine
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.Logger())
	r.Use(middleware.CORSMiddleware())

	// Batas ukuran form upload hingga 50 MB
	r.MaxMultipartMemory = 50 << 20

	// 4. Inisialisasi Handlers
	authHandler := handlers.NewAuthHandler(dbPool)
	trackHandler := handlers.NewTrackHandler(dbPool, cfg)
	monitoringHandler := handlers.NewMonitoringHandler(dbPool)
	userHandler := handlers.NewUserHandler(dbPool, cfg)
	updateHandler := handlers.NewUpdateHandler(cfg)

	// 5. Registrasi Routes API
	api := r.Group("/api")
	{
		// Autentikasi & Sesi
		api.Any("/login", authHandler.Login)
		api.POST("/stop-session", authHandler.StopSession)

		// Perekaman Aktivitas
		api.POST("/track", trackHandler.Track)

		// Live Monitoring & Detail Karyawan
		api.GET("/live-monitoring", monitoringHandler.LiveMonitoring)
		api.GET("/user-activity/:nik", monitoringHandler.UserActivity)
		api.GET("/user-activity/:nik/check-new", monitoringHandler.CheckNewLogCount)

		// Manajemen User
		api.PUT("/user/:nik/alias", userHandler.UpdateAlias)
		api.DELETE("/user/:nik", userHandler.DeleteUser)

		// Serve Screenshot
		api.GET("/screenshot", updateHandler.ServeScreenshot)
	}

	// Route Auto-Update (Bram Innovation dynamic latest.yml & static installers)
	updatesRouteHandler := func(c *gin.Context) {
		fp := c.Param("filepath")
		if fp == "/latest.yml" || fp == "latest.yml" || fp == "" {
			updateHandler.LatestYML(c)
			return
		}
		cleanPath := filepath.Join(cfg.UpdatesDir, filepath.Clean(fp))
		if fi, err := os.Stat(cleanPath); err == nil && !fi.IsDir() {
			if strings.HasSuffix(cleanPath, ".yml") {
				c.Header("Cache-Control", "no-cache")
			}
			c.File(cleanPath)
			return
		}
		c.Status(http.StatusNotFound)
	}

	r.GET("/updates/*filepath", updatesRouteHandler)
	api.GET("/updates/*filepath", updatesRouteHandler)

	// Melayani file gambar screenshot di /uploads dan /upload
	uploadsHandler := func(c *gin.Context) {
		updateHandler.ServeScreenshot(c)
	}
	r.GET("/uploads/*filepath", uploadsHandler)
	r.GET("/upload/*filepath", uploadsHandler)

	// Health check
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"app":     "Lbstaff Backend (Golang)",
			"status":  "healthy",
			"version": "1.0.0",
		})
	})
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// 6. Jalankan Server dengan Graceful Shutdown
	srv := &http.Server{
		Addr:         fmt.Sprintf("0.0.0.0:%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	go func() {
		log.Printf("⚡ Server Golang berjalan di http://0.0.0.0:%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ Error server: %v", err)
		}
	}()

	// Menunggu sinyal interupsi (SIGINT, SIGTERM)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Mematikan server secara graceful...")
	ctxShutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctxShutdown); err != nil {
		log.Fatalf("❌ Error saat mematikan server: %v", err)
	}

	log.Println("👋 Server Golang berhasil dimatikan dengan aman.")
}
