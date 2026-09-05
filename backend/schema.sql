-- =============================================
-- LBSTAFF DATABASE INITIALIZATION SCHEMA
-- =============================================

-- 1. Buat Tabel Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    role VARCHAR(50) DEFAULT 'karyawan',
    nik VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Buat Tabel Time Entries (Sesi Kerja)
CREATE TABLE IF NOT EXISTS time_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    total_duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Buat Tabel Activity Logs (Screenshot & Input Tracker)
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

-- Indexing untuk query cepat
CREATE INDEX IF NOT EXISTS idx_users_nik ON users(nik);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_active ON time_entries(user_id, start_time DESC) WHERE end_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_time_entry ON activity_logs(time_entry_id, recorded_at DESC);
