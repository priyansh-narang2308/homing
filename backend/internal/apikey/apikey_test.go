package apikey

import (
	"strings"
	"testing"
)

func TestLooksAcceptsCurrentAndLegacyKeys(t *testing.T) {
	for _, key := range []string{
		Prefix + strings.Repeat("a", 48),
		legacyPrefix + strings.Repeat("a", 48),
	} {
		if !Looks(key) {
			t.Errorf("Looks(%q) = false, want true", key[:len(Prefix)])
		}
	}
}

func TestLooksRejectsMalformedKeys(t *testing.T) {
	for _, key := range []string{
		Prefix + strings.Repeat("a", 47),
		"other" + strings.Repeat("a", 48),
	} {
		if Looks(key) {
			t.Errorf("Looks(%q) = true, want false", key[:min(len(key), len(Prefix))])
		}
	}
}
