package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"gorm.io/gorm"

	"github.com/priyansh-narang2308/homing/backend/internal/middleware"
	"github.com/priyansh-narang2308/homing/backend/internal/model"
	"github.com/priyansh-narang2308/homing/backend/internal/webhook"
)

type createWebhookRequest struct {
	URL         string `json:"url"`
	Description string `json:"description"`
	Events      string `json:"events"`
}

func (h *Handler) ListWebhookEndpoints(c *echo.Context) error {
	var endpoints []model.WebhookEndpoint
	err := h.DB.WithContext(c.Request().Context()).
		Where("user_id = ?", middleware.UserID(c)).
		Order("created_at DESC").
		Find(&endpoints).Error
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load webhook endpoints")
	}
	return c.JSON(http.StatusOK, map[string]any{"data": endpoints})
}

func (h *Handler) CreateWebhookEndpoint(c *echo.Context) error {
	var req createWebhookRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON body")
	}

	req.URL = strings.TrimSpace(req.URL)
	if req.URL == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "URL is required")
	}

	parsed, err := url.ParseRequestURI(req.URL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return echo.NewHTTPError(http.StatusBadRequest, "URL must be a valid HTTP or HTTPS address")
	}

	if req.Events == "" {
		req.Events = "*"
	}

	endpointID, _ := uuid.NewV7()
	secret := webhook.GenerateSecret()

	ep := model.WebhookEndpoint{
		Base:        model.Base{ID: endpointID},
		UserID:      middleware.UserID(c),
		URL:         req.URL,
		Description: req.Description,
		Secret:      secret,
		Events:      req.Events,
		IsActive:    true,
	}

	if err := h.DB.WithContext(c.Request().Context()).Create(&ep).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create webhook endpoint")
	}

	return c.JSON(http.StatusCreated, ep)
}

func (h *Handler) DeleteWebhookEndpoint(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid webhook endpoint id")
	}

	res := h.DB.WithContext(c.Request().Context()).
		Where("id = ? AND user_id = ?", id, middleware.UserID(c)).
		Delete(&model.WebhookEndpoint{})
	if res.Error != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete webhook endpoint")
	}
	if res.RowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Webhook endpoint not found")
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) TestWebhookEndpoint(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid webhook endpoint id")
	}

	var ep model.WebhookEndpoint
	err = h.DB.WithContext(c.Request().Context()).
		Where("id = ? AND user_id = ?", id, middleware.UserID(c)).
		Take(&ep).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "Webhook endpoint not found")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load webhook endpoint")
	}

	testPayload := map[string]any{
		"event":     "ping",
		"message":   "Test event dispatched from Homing Dashboard",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	delivery, _ := webhook.Dispatch(c.Request().Context(), h.DB, ep, "ping", testPayload)
	return c.JSON(http.StatusOK, map[string]any{"data": delivery})
}

func (h *Handler) ListWebhookDeliveries(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid webhook endpoint id")
	}

	var deliveries []model.WebhookDelivery
	err = h.DB.WithContext(c.Request().Context()).
		Where("endpoint_id = ? AND user_id = ?", id, middleware.UserID(c)).
		Order("created_at DESC").
		Limit(50).
		Find(&deliveries).Error
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load webhook deliveries")
	}

	return c.JSON(http.StatusOK, map[string]any{"data": deliveries})
}

func (h *Handler) ReplayWebhookDelivery(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid delivery id")
	}

	var delivery model.WebhookDelivery
	err = h.DB.WithContext(c.Request().Context()).
		Where("id = ? AND user_id = ?", id, middleware.UserID(c)).
		Take(&delivery).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "Webhook delivery not found")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load webhook delivery")
	}

	var ep model.WebhookEndpoint
	err = h.DB.WithContext(c.Request().Context()).
		Where("id = ? AND user_id = ?", delivery.EndpointID, middleware.UserID(c)).
		Take(&ep).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return echo.NewHTTPError(http.StatusBadRequest, "Original webhook endpoint has been deleted")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load webhook endpoint")
	}

	var rawPayload any
	_ = json.Unmarshal([]byte(delivery.Payload), &rawPayload)

	newDelivery, _ := webhook.Dispatch(c.Request().Context(), h.DB, ep, delivery.EventType, rawPayload)
	return c.JSON(http.StatusOK, map[string]any{"data": newDelivery})
}
