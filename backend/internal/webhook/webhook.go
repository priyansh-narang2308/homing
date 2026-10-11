package webhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/priyansh-narang2308/homing/backend/internal/logger"
	"github.com/priyansh-narang2308/homing/backend/internal/model"
)

var httpClient = &http.Client{
	Timeout: 10 * time.Second,
}

// GenerateSecret generates a cryptographically secure whsec_ signing secret.
func GenerateSecret() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return "whsec_" + hex.EncodeToString(b)
}

// Sign computes the HMAC-SHA256 signature for a payload.
// Format: t={timestamp},v1={hex_hash}
func Sign(payload []byte, secret string, timestamp int64) string {
	toSign := fmt.Sprintf("%d.%s", timestamp, string(payload))
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(toSign))
	sig := hex.EncodeToString(mac.Sum(nil))
	return fmt.Sprintf("t=%d,v1=%s", timestamp, sig)
}

// MatchesEvent returns true if the endpoint's configured events match eventType.
func MatchesEvent(endpointEvents, eventType string) bool {
	if endpointEvents == "*" || endpointEvents == "" {
		return true
	}
	parts := strings.Split(endpointEvents, ",")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "*" || p == eventType {
			return true
		}
	}
	return false
}

// Dispatch sends an event payload to a webhook endpoint and logs the delivery attempt.
func Dispatch(ctx context.Context, db *gorm.DB, endpoint model.WebhookEndpoint, eventType string, payload any) (*model.WebhookDelivery, error) {
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	deliveryID, _ := uuid.NewV7()
	now := time.Now()
	timestamp := now.Unix()
	signature := Sign(bodyBytes, endpoint.Secret, timestamp)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.URL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Homing-Webhooks/1.0")
	req.Header.Set("Homing-Signature", signature)
	req.Header.Set("Homing-Event-Type", eventType)
	req.Header.Set("Homing-Delivery-ID", deliveryID.String())

	start := time.Now()
	resp, sendErr := httpClient.Do(req)
	latency := int(time.Since(start).Milliseconds())

	var statusCode int
	var respBody string
	var status model.WebhookDeliveryStatus = model.DeliveryFailed
	var errStr string

	if sendErr != nil {
		errStr = sendErr.Error()
	} else {
		statusCode = resp.StatusCode
		defer resp.Body.Close()
		lr := io.LimitReader(resp.Body, 2048)
		b, _ := io.ReadAll(lr)
		respBody = string(b)
		if statusCode >= 200 && statusCode < 300 {
			status = model.DeliveryDelivered
		} else {
			errStr = fmt.Sprintf("HTTP %d: %s", statusCode, respBody)
		}
	}

	delivery := model.WebhookDelivery{
		Base:         model.Base{ID: deliveryID},
		EndpointID:   endpoint.ID,
		UserID:       endpoint.UserID,
		EventType:    eventType,
		Payload:      string(bodyBytes),
		ResponseCode: statusCode,
		ResponseBody: respBody,
		Error:        errStr,
		LatencyMS:    latency,
		Status:       status,
	}

	if err := db.WithContext(context.WithoutCancel(ctx)).Create(&delivery).Error; err != nil {
		logger.Log.Error().Err(err).Str("delivery_id", deliveryID.String()).Msg("failed to record webhook delivery")
	}

	return &delivery, sendErr
}

// TriggerEvent finds all active webhook endpoints for a user and dispatches asynchronously.
func TriggerEvent(db *gorm.DB, userID uuid.UUID, eventType string, payload any) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		var endpoints []model.WebhookEndpoint
		err := db.WithContext(ctx).
			Where("user_id = ? AND is_active = true", userID).
			Find(&endpoints).Error
		if err != nil || len(endpoints) == 0 {
			return
		}

		for _, ep := range endpoints {
			if !MatchesEvent(ep.Events, eventType) {
				continue
			}
			_, _ = Dispatch(ctx, db, ep, eventType, payload)
		}
	}()
}
