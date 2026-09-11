package models

import "time"

type TimeEntry struct {
	ID                   int        `json:"id"`
	UserID               int        `json:"user_id,omitempty"`
	StartTime            time.Time  `json:"start_time"`
	EndTime              *time.Time `json:"end_time"`
	TotalDurationSeconds *int       `json:"total_duration_seconds"`
	AppVersion           *string    `json:"app_version,omitempty"`
	LocationName         *string    `json:"location_name,omitempty"`
	Latitude             *float64   `json:"latitude,omitempty"`
	Longitude            *float64   `json:"longitude,omitempty"`
	IPAddress            *string    `json:"ip_address,omitempty"`
	CreatedAt            *time.Time `json:"created_at,omitempty"`
}

type StopSessionRequest struct {
	TimeEntryID int `json:"time_entry_id" form:"time_entry_id"`
}
