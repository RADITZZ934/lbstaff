package models

import (
	"encoding/json"
	"time"
)

type ActivityLog struct {
	ID             int             `json:"id"`
	TimeEntryID    int             `json:"time_entry_id"`
	ScreenshotURL  *string         `json:"screenshot_url"`
	ScreenshotPath *string         `json:"screenshot_path"`
	AppAndURLs     json.RawMessage `json:"app_and_urls"`
	RecordedAt     time.Time       `json:"recorded_at"`
	CreatedAt      time.Time       `json:"created_at"`
	KeyboardClicks int             `json:"keyboard_clicks"`
	MouseMoves     int             `json:"mouse_moves"`
	LocationName   *string         `json:"location_name,omitempty"`
	Latitude       *float64        `json:"latitude,omitempty"`
	Longitude      *float64        `json:"longitude,omitempty"`
	IPAddress      *string         `json:"ip_address,omitempty"`
}

type LiveMonitoringUser struct {
	ID                       int        `json:"id"`
	Name                     string     `json:"name"`
	Alias                    *string    `json:"alias"`
	NIK                      string     `json:"nik"`
	AppVersion               string     `json:"app_version"`
	StartTime                *time.Time `json:"start_time"`
	EndTime                  *time.Time `json:"end_time"`
	SecondsSinceLastActivity int        `json:"seconds_since_last_activity"`
	LocationName             *string    `json:"location_name,omitempty"`
	Latitude                 *float64   `json:"latitude,omitempty"`
	Longitude                *float64   `json:"longitude,omitempty"`
	IPAddress                *string    `json:"ip_address,omitempty"`
}

type UserActivityDetail struct {
	ID           int        `json:"id"`
	UserID       int        `json:"user_id"`
	Name         string     `json:"name"`
	Alias        *string    `json:"alias"`
	NIK          string     `json:"nik"`
	AppVersion   string     `json:"app_version"`
	TimeEntryID  *int       `json:"time_entry_id"`
	StartTime    *time.Time `json:"start_time"`
	EndTime      *time.Time `json:"end_time"`
	LocationName *string    `json:"location_name,omitempty"`
	Latitude     *float64   `json:"latitude,omitempty"`
	Longitude    *float64   `json:"longitude,omitempty"`
	IPAddress    *string    `json:"ip_address,omitempty"`
}

type UserActivityResponse struct {
	Success  bool                `json:"success"`
	Message  string              `json:"message,omitempty"`
	User     *UserActivityDetail `json:"user,omitempty"`
	Sessions []TimeEntry         `json:"sessions,omitempty"`
	Logs     []ActivityLog       `json:"logs,omitempty"`
}

type CheckNewCountResponse struct {
	Success  bool `json:"success"`
	NewCount int  `json:"new_count"`
}
