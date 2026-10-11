package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"testing"
)

func TestGenerateSecret(t *testing.T) {
	s1 := GenerateSecret()
	s2 := GenerateSecret()

	if !strings.HasPrefix(s1, "whsec_") {
		t.Fatalf("expected secret to start with 'whsec_', got %s", s1)
	}
	if s1 == s2 {
		t.Fatalf("expected unique secrets, got %s and %s", s1, s2)
	}
	if len(s1) != len("whsec_")+48 {
		t.Fatalf("expected 48 hex chars after prefix, got len %d", len(s1))
	}
}

func TestSign(t *testing.T) {
	secret := "whsec_test1234567890abcdef"
	payload := []byte(`{"event":"email.sent","id":"123"}`)
	timestamp := int64(1700000000)

	sigHeader := Sign(payload, secret, timestamp)
	expectedPrefix := "t=1700000000,v1="
	if !strings.HasPrefix(sigHeader, expectedPrefix) {
		t.Fatalf("expected header to start with %q, got %q", expectedPrefix, sigHeader)
	}

	sigHex := strings.TrimPrefix(sigHeader, expectedPrefix)

	// Independently recompute HMAC
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%d.%s", timestamp, string(payload))))
	expectedHex := hex.EncodeToString(mac.Sum(nil))

	if sigHex != expectedHex {
		t.Fatalf("signature mismatch: got %s, expected %s", sigHex, expectedHex)
	}
}

func TestMatchesEvent(t *testing.T) {
	tests := []struct {
		pattern  string
		event    string
		expected bool
	}{
		{"*", "email.sent", true},
		{"", "email.sent", true},
		{"email.sent", "email.sent", true},
		{"email.sent,email.failed", "email.failed", true},
		{"email.sent,email.failed", "email.dlq", false},
		{"email.dlq", "email.sent", false},
	}

	for _, tt := range tests {
		got := MatchesEvent(tt.pattern, tt.event)
		if got != tt.expected {
			t.Errorf("MatchesEvent(%q, %q) = %v; want %v", tt.pattern, tt.event, got, tt.expected)
		}
	}
}
