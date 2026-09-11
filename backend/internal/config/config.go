package config

import (
	"os"
	"path/filepath"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	DBHost       string
	DBPort       int
	DBUser       string
	DBPassword   string
	DBName       string
	UploadsDir   string
	UpdatesDir   string
	UpdateFileID string
}

func LoadConfig() *Config {
	// Muat .env jika ada
	_ = godotenv.Load()
	_ = godotenv.Load("../.env")

	port := getEnv("PORT", "10002")
	dbHost := getEnv("DB_HOST", "localhost")
	dbPortStr := getEnv("DB_PORT", "5432")
	dbPort, err := strconv.Atoi(dbPortStr)
	if err != nil {
		dbPort = 5432
	}
	dbUser := getEnv("DB_USER", "postgres")
	dbPassword := getEnv("DB_PASSWORD", "postgres")
	dbName := getEnv("DB_NAME", "lbstaff")

	cwd, _ := os.Getwd()
	defaultUploads := filepath.Join(cwd, "uploads")
	uploadsDir := getEnv("UPLOADS_DIR", defaultUploads)
	updatesDir := getEnv("UPDATES_DIR", filepath.Join(cwd, "updates"))
	updateFileID := getEnv("UPDATE_FILE_ID", "file-dd44b3db0e88409f87e693cc4558905a")

	// Pastikan folder uploads & updates tercipta
	_ = os.MkdirAll(uploadsDir, 0755)
	_ = os.MkdirAll(updatesDir, 0755)

	return &Config{
		Port:         port,
		DBHost:       dbHost,
		DBPort:       dbPort,
		DBUser:       dbUser,
		DBPassword:   dbPassword,
		DBName:       dbName,
		UploadsDir:   filepath.Clean(uploadsDir),
		UpdatesDir:   filepath.Clean(updatesDir),
		UpdateFileID: updateFileID,
	}
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}
