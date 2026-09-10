package database

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/raditzz/lbstaff-backend-go/internal/config"
)

func InitDB(cfg *config.Config) (*pgxpool.Pool, error) {
	escapedPassword := url.QueryEscape(cfg.DBPassword)
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		cfg.DBUser, escapedPassword, cfg.DBHost, cfg.DBPort, cfg.DBName)

	poolConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("gagal mem-parsing DSN database: %w", err)
	}

	poolConfig.MaxConns = 30
	poolConfig.MinConns = 5
	poolConfig.MaxConnLifetime = 1 * time.Hour
	poolConfig.MaxConnIdleTime = 30 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat connection pool postgresql: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("gagal ping database postgresql (%s:%d/%s): %w", cfg.DBHost, cfg.DBPort, cfg.DBName, err)
	}

	log.Printf("✅ [Database OK] Berhasil terhubung ke database PostgreSQL (%s:%d/%s)", cfg.DBHost, cfg.DBPort, cfg.DBName)

	// Jalankan migrasi tabel otomatis
	if err := RunMigrations(ctx, pool); err != nil {
		log.Printf("⚠️ [Database Migration Warning]: %v", err)
	}

	return pool, nil
}
