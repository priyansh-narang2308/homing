package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"gorm.io/gorm"

	"github.com/priyansh-narang2308/homing/backend/internal/middleware"
	"github.com/priyansh-narang2308/homing/backend/internal/model"
	"github.com/priyansh-narang2308/homing/backend/internal/queue"
	"github.com/priyansh-narang2308/homing/backend/internal/template"
)

const maxEmailsPerRequest = 100

type EmailInput struct {
	From         string         `json:"from"`
	To           string         `json:"to"`
	Subject      string         `json:"subject"`
	HTML         string         `json:"html"`
	Text         string         `json:"text"`
	TemplateSlug string         `json:"template_slug,omitempty"`
	Variables    map[string]any `json:"variables,omitempty"`
}

type sendEmailsRequest struct {
	Emails []EmailInput `json:"emails"`
}

type emailID struct {
	ID uuid.UUID `json:"id"`
}

// SendEmails handles POST /email for API key callers (the SDK).
func (h *Handler) SendEmails(c *echo.Context) error {
	var req sendEmailsRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON body")
	}
	if len(req.Emails) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "'emails' must contain at least one email")
	}
	if len(req.Emails) > maxEmailsPerRequest {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("At most %d emails per request", maxEmailsPerRequest))
	}

	userID := middleware.UserID(c)
	idempotencyKey := strings.TrimSpace(c.Request().Header.Get("Idempotency-Key"))

	// Idempotency check: if caller provided an Idempotency-Key and sends a single email,
	// check if we already processed it to prevent duplicate sending and double billing.
	if idempotencyKey != "" && len(req.Emails) == 1 {
		var existing model.Email
		err := h.DB.WithContext(c.Request().Context()).
			Where("user_id = ? AND idempotency_key = ?", userID, idempotencyKey).
			Take(&existing).Error
		if err == nil {
			c.Response().Header().Set("Idempotent-Replay", "true")
			return c.JSON(http.StatusOK, map[string]any{"data": []emailID{{ID: existing.ID}}})
		}
	}

	ids, err := h.queueEmails(c.Request().Context(), userID, req.Emails, idempotencyKey)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusAccepted, map[string]any{"data": ids})
}

// GetEmail handles GET /email/:id; callers only see their own emails.
func (h *Handler) GetEmail(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid email id")
	}

	var email model.Email
	err = h.DB.WithContext(c.Request().Context()).
		Preload("Events", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at ASC")
		}).
		Where("id = ? AND user_id = ?", id, middleware.UserID(c)).
		Take(&email).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "Email not found")
	}
	if err != nil {
		log.Error().Err(err).Str("id", id.String()).Msg("failed to load email")
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load email")
	}
	return c.JSON(http.StatusOK, email)
}

// GetEmailEvents handles GET /dashboard/emails/:id/events to return the lifecycle timeline.
func (h *Handler) GetEmailEvents(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid email id")
	}

	userID := middleware.UserID(c)
	var count int64
	if err := h.DB.WithContext(c.Request().Context()).Model(&model.Email{}).
		Where("id = ? AND user_id = ?", id, userID).Count(&count).Error; err != nil || count == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Email not found")
	}

	var events []model.EmailEvent
	if err := h.DB.WithContext(c.Request().Context()).
		Where("email_id = ?", id).
		Order("created_at ASC").
		Find(&events).Error; err != nil {
		log.Error().Err(err).Str("id", id.String()).Msg("failed to load email events")
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load events")
	}
	return c.JSON(http.StatusOK, map[string]any{"data": events})
}

// RetryEmail handles POST /email/:id/retry and POST /dashboard/emails/:id/retry
// to replay a failed or Dead-Letter Queue (DLQ) email back into the pipeline.
func (h *Handler) RetryEmail(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid email id")
	}

	userID := middleware.UserID(c)
	var email model.Email
	err = h.DB.WithContext(c.Request().Context()).
		Where("id = ? AND user_id = ?", id, userID).
		Take(&email).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "Email not found")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load email")
	}

	if email.Status != model.StatusFailed && email.Status != model.StatusDLQ {
		return echo.NewHTTPError(http.StatusBadRequest, "Only failed or DLQ emails can be retried")
	}

	eventID, _ := uuid.NewV7()
	replayEvent := model.EmailEvent{
		Base:      model.Base{ID: eventID},
		EmailID:   email.ID,
		EventType: model.EventReplayed,
		Attempt:   email.Attempts + 1,
		WorkerID:  "manual-replay",
		Details:   "Replayed from Dead-Letter Queue (DLQ) by user",
	}

	err = h.DB.WithContext(c.Request().Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.Email{}).Where("id = ?", email.ID).Updates(map[string]any{
			"status":     model.StatusQueued,
			"last_error": "",
			"updated_at": gorm.Expr("now()"),
		}).Error; err != nil {
			return err
		}
		return tx.Create(&replayEvent).Error
	})
	if err != nil {
		log.Error().Err(err).Str("id", id.String()).Msg("failed to update email status for replay")
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update email for retry")
	}

	if err := queue.Enqueue(c.Request().Context(), h.RDB, []uuid.UUID{email.ID}); err != nil {
		log.Error().Err(err).Str("id", id.String()).Msg("failed to re-enqueue email")
		return echo.NewHTTPError(http.StatusServiceUnavailable, "Failed to re-enqueue email")
	}

	log.Info().Str("email_id", email.ID.String()).Str("user_id", userID.String()).Msg("email replayed from DLQ")
	return c.JSON(http.StatusOK, map[string]any{"data": map[string]any{"id": email.ID, "status": model.StatusQueued}})
}

// queueEmails saves the emails first (Postgres is the source of truth), then pushes only
// their IDs to Redis. Workers do the actual sending.
func (h *Handler) queueEmails(ctx context.Context, userID uuid.UUID, inputs []EmailInput, idempotencyKey string) ([]emailID, error) {
	if h.OnlySendToSelf {
		s, err := h.loadSender(ctx, userID)
		if err != nil {
			log.Error().Err(err).Str("user_id", userID.String()).Msg("failed to load sender")
			return nil, echo.NewHTTPError(http.StatusInternalServerError, "Failed to load your account")
		}
		if err := h.checkRecipients(s, inputs); err != nil {
			return nil, err
		}
		for i := range inputs {
			inputs[i].From = h.EmailFrom
		}
	}

	emails := make([]model.Email, len(inputs))
	ids := make([]uuid.UUID, len(inputs))
	events := make([]model.EmailEvent, len(inputs))

	for i, in := range inputs {
		if in.TemplateSlug != "" {
			var tmpl model.Template
			if err := h.DB.WithContext(ctx).Where("user_id = ? AND slug = ?", userID, in.TemplateSlug).Take(&tmpl).Error; err == nil {
				if in.Subject == "" {
					in.Subject = template.Render(tmpl.Subject, in.Variables)
				}
				if in.HTML == "" {
					in.HTML = template.Render(tmpl.HTMLContent, in.Variables)
				}
			}
		}

		id, err := uuid.NewV7()
		if err != nil {
			return nil, echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate email id")
		}
		ids[i] = id

		var idempPtr *string
		if idempotencyKey != "" && len(inputs) == 1 {
			idempPtr = &idempotencyKey
		}

		emails[i] = model.Email{
			Base:           model.Base{ID: id},
			UserID:         userID,
			From:           in.From,
			To:             in.To,
			Subject:        in.Subject,
			HTML:           in.HTML,
			Text:           in.Text,
			Status:         model.StatusQueued,
			IdempotencyKey: idempPtr,
		}

		eventID, _ := uuid.NewV7()
		events[i] = model.EmailEvent{
			Base:      model.Base{ID: eventID},
			EmailID:   id,
			EventType: model.EventQueued,
			Attempt:   1,
			WorkerID:  "api-gateway",
			Details:   "Accepted by API and enqueued into Redis stream",
		}
	}

	// Counting and saving in one transaction means a failed insert never uses up quota.
	err := h.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if h.DailyLimit > 0 {
			if err := reserveQuota(tx, userID, len(emails), h.DailyLimit); err != nil {
				return err
			}
		}
		if err := tx.Create(&emails).Error; err != nil {
			return err
		}
		return tx.Create(&events).Error
	})
	if errors.Is(err, errQuotaExceeded) {
		return nil, h.quotaExceededError()
	}
	if err != nil {
		log.Error().Err(err).Int("count", len(emails)).Msg("failed to save emails")
		return nil, echo.NewHTTPError(http.StatusInternalServerError, "Failed to save emails")
	}

	if err := queue.Enqueue(ctx, h.RDB, ids); err != nil {
		log.Error().Err(err).Int("count", len(ids)).Msg("failed to enqueue emails")
		markErr := h.DB.WithContext(context.WithoutCancel(ctx)).Model(&model.Email{}).
			Where("id IN ?", ids).
			Updates(map[string]any{"status": model.StatusFailed, "last_error": "failed to enqueue"}).Error
		if markErr != nil {
			log.Error().Err(markErr).Msg("failed to mark unqueued emails as failed")
		}
		return nil, echo.NewHTTPError(http.StatusServiceUnavailable, "Failed to queue emails, please retry")
	}

	log.Info().Int("count", len(ids)).Str("user_id", userID.String()).Msg("emails queued")

	out := make([]emailID, len(ids))
	for i, id := range ids {
		out[i] = emailID{ID: id}
	}
	return out, nil
}
