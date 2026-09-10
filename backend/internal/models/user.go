package models

import "time"

type User struct {
	ID         int        `json:"id"`
	Name       string     `json:"name"`
	Alias      *string    `json:"alias"`
	Email      *string    `json:"email"`
	Role       string     `json:"role"`
	NIK        string     `json:"nik"`
	AppVersion *string    `json:"app_version"`
	CreatedAt  *time.Time `json:"created_at,omitempty"`
}

type LoginRequest struct {
	NIK        string `json:"nik" form:"nik"`
	AppVersion string `json:"app_version" form:"app_version"`
}

type LoginResponse struct {
	Success     bool   `json:"success"`
	Message     string `json:"message"`
	User        User   `json:"user"`
	TimeEntryID int    `json:"time_entry_id"`
}

type UpdateAliasRequest struct {
	Alias *string `json:"alias" form:"alias"`
}
