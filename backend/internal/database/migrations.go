package database

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

func RunMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	migrationSQL := `
		CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			email VARCHAR(255) UNIQUE,
			role VARCHAR(50) DEFAULT 'karyawan',
			nik VARCHAR(50) UNIQUE NOT NULL,
			password_hash VARCHAR(255),
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS time_entries (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			end_time TIMESTAMP WITH TIME ZONE,
			total_duration_seconds INTEGER,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS activity_logs (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			time_entry_id INTEGER NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
			recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			screenshot_url TEXT,
			keyboard_clicks INTEGER DEFAULT 0,
			mouse_moves INTEGER DEFAULT 0,
			app_and_urls JSONB DEFAULT '[]'::jsonb
		);

		CREATE INDEX IF NOT EXISTS idx_users_nik ON users(nik);
		CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
		CREATE INDEX IF NOT EXISTS idx_time_entries_active ON time_entries(user_id, start_time DESC) WHERE end_time IS NULL;
		CREATE INDEX IF NOT EXISTS idx_activity_logs_time_entry ON activity_logs(time_entry_id, recorded_at DESC);

		ALTER TABLE users ADD COLUMN IF NOT EXISTS alias VARCHAR(255);
		ALTER TABLE users ADD COLUMN IF NOT EXISTS app_version VARCHAR(50);
		ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS app_version VARCHAR(50);
	`

	_, err := pool.Exec(ctx, migrationSQL)
	if err != nil {
		return fmt.Errorf("gagal menjalankan migrasi schema database: %w", err)
	}

	log.Println("✅ [Database Schema] Struktur tabel (users, time_entries, activity_logs) siap digunakan.")
	return nil
}
