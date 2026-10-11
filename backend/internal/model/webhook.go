package model

import (
	"github.com/google/uuid"
)

type WebhookEndpoint struct {
	Base
	UserID      uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	URL         string    `json:"url"`
	Description string    `json:"description"`
	Secret      string    `json:"secret"`
	Events      string    `json:"events"`
	IsActive    bool      `json:"is_active"`
}

type WebhookDeliveryStatus string

const (
	DeliveryPending   WebhookDeliveryStatus = "pending"
	DeliveryDelivered WebhookDeliveryStatus = "delivered"
	DeliveryFailed    WebhookDeliveryStatus = "failed"
)

type WebhookDelivery struct {
	Base
	EndpointID   uuid.UUID             `gorm:"type:uuid;not null;index" json:"endpoint_id"`
	UserID       uuid.UUID             `gorm:"type:uuid;not null;index" json:"user_id"`
	EventType    string                `json:"event_type"`
	Payload      string                `gorm:"type:jsonb;default:'{}'" json:"payload"`
	ResponseCode int                   `json:"response_code"`
	ResponseBody string                `json:"response_body"`
	Error        string                `json:"error,omitempty"`
	LatencyMS    int                   `json:"latency_ms"`
	Status       WebhookDeliveryStatus `json:"status"`
}
