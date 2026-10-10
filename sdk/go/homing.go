// Package homing is the Go client for the Homing email API.
//
//	client := homing.NewClient("hom_...")
//	resp, err := client.Emails.Send(ctx, &homing.SendEmailRequest{
//		From:    "Acme <onboarding@homing.dev>",
//		To:      "user@example.com",
//		Subject: "Hello World",
//		HTML:    "<strong>It works!</strong>",
//	})
package homing

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	Version        = "0.1.0"
	DefaultBaseURL = "https://api.homing.dev"
)

type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client

	Emails *EmailsService
}

type Option func(*Client)

// WithBaseURL points the client at a different Homing API, for example a deployed instance.
func WithBaseURL(url string) Option {
	return func(c *Client) { c.baseURL = strings.TrimRight(url, "/") }
}

// WithHTTPClient replaces the default HTTP client (30s timeout).
func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) { c.httpClient = hc }
}

func NewClient(apiKey string, opts ...Option) *Client {
	c := &Client{
		apiKey:     apiKey,
		baseURL:    DefaultBaseURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
	for _, opt := range opts {
		opt(c)
	}
	c.Emails = &EmailsService{client: c}
	return c
}

// Error is returned for any non-2xx response from the API.
type Error struct {
	StatusCode int
	Message    string
}

func (e *Error) Error() string {
	return fmt.Sprintf("homing: %d %s", e.StatusCode, e.Message)
}

func (c *Client) do(ctx context.Context, method, path string, body, out any) error {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("homing: encode request: %w", err)
		}
		reqBody = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reqBody)
	if err != nil {
		return fmt.Errorf("homing: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "homing-go/"+Version)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("homing: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		apiErr := &Error{StatusCode: resp.StatusCode, Message: http.StatusText(resp.StatusCode)}
		var payload struct {
			Message string `json:"message"`
		}
		if json.NewDecoder(resp.Body).Decode(&payload) == nil && payload.Message != "" {
			apiErr.Message = payload.Message
		}
		return apiErr
	}

	if out == nil {
		return nil
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("homing: decode response: %w", err)
	}
	return nil
}
