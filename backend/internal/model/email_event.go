package model

import "github.com/google/uuid"

type EmailEventType string

const (
	EventQueued         EmailEventType = "queued"
	EventClaimed        EmailEventType = "claimed"
	EventSent           EmailEventType = "sent"
	EventRetryScheduled EmailEventType = "retry_scheduled"
	EventFailed         EmailEventType = "failed"
	EventDLQMoved       EmailEventType = "dlq_moved"
	EventReplayed       EmailEventType = "replayed"
)

type EmailEvent struct {
	Base
	EmailID   uuid.UUID      `gorm:"type:uuid;not null;index" json:"email_id"`
	EventType EmailEventType `json:"event_type"`
	Attempt   int            `json:"attempt"`
	WorkerID  string         `json:"worker_id"`
	Details   string         `json:"details"`
	Metadata  string         `gorm:"type:jsonb;default:'{}'" json:"metadata,omitempty"`
}
