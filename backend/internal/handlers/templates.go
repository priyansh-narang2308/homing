package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"gorm.io/gorm"

	"github.com/priyansh-narang2308/homing/backend/internal/middleware"
	"github.com/priyansh-narang2308/homing/backend/internal/model"
	"github.com/priyansh-narang2308/homing/backend/internal/template"
)

var slugRegex = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

type createTemplateRequest struct {
	Name        string         `json:"name"`
	Slug        string         `json:"slug"`
	Description string         `json:"description"`
	Subject     string         `json:"subject"`
	HTMLContent string         `json:"html_content"`
	SampleVars  map[string]any `json:"sample_vars"`
}

type updateTemplateRequest struct {
	Name        string          `json:"name"`
	Slug        string          `json:"slug"`
	Description string          `json:"description"`
	Subject     string          `json:"subject"`
	HTMLContent string          `json:"html_content"`
	SampleVars  *map[string]any `json:"sample_vars"`
}

type previewTemplateRequest struct {
	Variables map[string]any `json:"variables"`
}

type testSendTemplateRequest struct {
	To        string         `json:"to"`
	Variables map[string]any `json:"variables"`
}

func (h *Handler) ListTemplates(c *echo.Context) error {
	var templates []model.Template
	err := h.DB.WithContext(c.Request().Context()).
		Where("user_id = ?", middleware.UserID(c)).
		Order("created_at DESC").
		Find(&templates).Error
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load email templates")
	}
	return c.JSON(http.StatusOK, map[string]any{"data": templates})
}

func (h *Handler) GetTemplate(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid template id")
	}

	var tmpl model.Template
	err = h.DB.WithContext(c.Request().Context()).
		Where("id = ? AND user_id = ?", id, middleware.UserID(c)).
		Take(&tmpl).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "Template not found")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load template")
	}

	detected := template.ExtractVariables(tmpl.Subject + " " + tmpl.HTMLContent)
	return c.JSON(http.StatusOK, map[string]any{
		"data":               tmpl,
		"detected_variables": detected,
	})
}

func (h *Handler) CreateTemplate(c *echo.Context) error {
	var req createTemplateRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON body")
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Slug = strings.TrimSpace(strings.ToLower(req.Slug))
	req.Subject = strings.TrimSpace(req.Subject)
	req.HTMLContent = strings.TrimSpace(req.HTMLContent)

	if req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Name is required")
	}
	if req.Slug == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Slug is required")
	}
	if !slugRegex.MatchString(req.Slug) {
		return echo.NewHTTPError(http.StatusBadRequest, "Slug must be lowercase alphanumeric with hyphens (e.g. welcome-email)")
	}
	if req.Subject == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Subject is required")
	}
	if req.HTMLContent == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "HTML content is required")
	}

	sampleJSON := "{}"
	if req.SampleVars != nil {
		b, err := json.Marshal(req.SampleVars)
		if err == nil {
			sampleJSON = string(b)
		}
	}

	id, _ := uuid.NewV7()
	tmpl := model.Template{
		Base:        model.Base{ID: id},
		UserID:      middleware.UserID(c),
		Name:        req.Name,
		Slug:        req.Slug,
		Description: req.Description,
		Subject:     req.Subject,
		HTMLContent: req.HTMLContent,
		SampleVars:  sampleJSON,
	}

	if err := h.DB.WithContext(c.Request().Context()).Create(&tmpl).Error; err != nil {
		if strings.Contains(err.Error(), "email_templates_user_slug_unique") || strings.Contains(err.Error(), "duplicate key") {
			return echo.NewHTTPError(http.StatusConflict, fmt.Sprintf("A template with slug %q already exists", req.Slug))
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create template")
	}

	return c.JSON(http.StatusCreated, map[string]any{"data": tmpl})
}

func (h *Handler) UpdateTemplate(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid template id")
	}

	var req updateTemplateRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON body")
	}

	var tmpl model.Template
	err = h.DB.WithContext(c.Request().Context()).
		Where("id = ? AND user_id = ?", id, middleware.UserID(c)).
		Take(&tmpl).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "Template not found")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load template")
	}

	if req.Name != "" {
		tmpl.Name = strings.TrimSpace(req.Name)
	}
	if req.Slug != "" {
		slug := strings.TrimSpace(strings.ToLower(req.Slug))
		if !slugRegex.MatchString(slug) {
			return echo.NewHTTPError(http.StatusBadRequest, "Slug must be lowercase alphanumeric with hyphens")
		}
		tmpl.Slug = slug
	}
	if req.Subject != "" {
		tmpl.Subject = strings.TrimSpace(req.Subject)
	}
	if req.HTMLContent != "" {
		tmpl.HTMLContent = strings.TrimSpace(req.HTMLContent)
	}
	tmpl.Description = strings.TrimSpace(req.Description)

	if req.SampleVars != nil {
		b, err := json.Marshal(req.SampleVars)
		if err == nil {
			tmpl.SampleVars = string(b)
		}
	}

	if err := h.DB.WithContext(c.Request().Context()).Save(&tmpl).Error; err != nil {
		if strings.Contains(err.Error(), "email_templates_user_slug_unique") || strings.Contains(err.Error(), "duplicate key") {
			return echo.NewHTTPError(http.StatusConflict, fmt.Sprintf("A template with slug %q already exists", tmpl.Slug))
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update template")
	}

	return c.JSON(http.StatusOK, map[string]any{"data": tmpl})
}

func (h *Handler) DeleteTemplate(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid template id")
	}

	res := h.DB.WithContext(c.Request().Context()).
		Where("id = ? AND user_id = ?", id, middleware.UserID(c)).
		Delete(&model.Template{})
	if res.Error != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete template")
	}
	if res.RowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Template not found")
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) PreviewTemplate(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid template id")
	}

	var req previewTemplateRequest
	_ = c.Bind(&req)

	var tmpl model.Template
	err = h.DB.WithContext(c.Request().Context()).
		Where("id = ? AND user_id = ?", id, middleware.UserID(c)).
		Take(&tmpl).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "Template not found")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load template")
	}

	vars := req.Variables
	if vars == nil {
		vars = make(map[string]any)
		_ = json.Unmarshal([]byte(tmpl.SampleVars), &vars)
	}

	renderedSubject := template.Render(tmpl.Subject, vars)
	renderedHTML := template.Render(tmpl.HTMLContent, vars)
	detected := template.ExtractVariables(tmpl.Subject + " " + tmpl.HTMLContent)

	return c.JSON(http.StatusOK, map[string]any{
		"subject":            renderedSubject,
		"html":               renderedHTML,
		"detected_variables": detected,
	})
}

func (h *Handler) TestSendTemplate(c *echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid template id")
	}

	var req testSendTemplateRequest
	_ = c.Bind(&req)

	user := middleware.CurrentUser(c)
	toAddress := strings.TrimSpace(req.To)
	if toAddress == "" {
		toAddress = user.Email
	}
	if toAddress == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Target email address is required")
	}

	var tmpl model.Template
	err = h.DB.WithContext(c.Request().Context()).
		Where("id = ? AND user_id = ?", id, user.ID).
		Take(&tmpl).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "Template not found")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load template")
	}

	vars := req.Variables
	if vars == nil {
		vars = make(map[string]any)
		_ = json.Unmarshal([]byte(tmpl.SampleVars), &vars)
	}

	renderedSubject := template.Render(tmpl.Subject, vars)
	renderedHTML := template.Render(tmpl.HTMLContent, vars)

	ids, err := h.queueEmails(c.Request().Context(), user.ID, []EmailInput{{
		From:    h.EmailFrom,
		To:      toAddress,
		Subject: renderedSubject,
		HTML:    renderedHTML,
	}}, "")
	if err != nil {
		return err
	}

	return c.JSON(http.StatusAccepted, map[string]any{"data": ids})
}
