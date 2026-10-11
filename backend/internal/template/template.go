package template

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// varRegex matches {{variable_name}} or {{ variable_name }} with optional surrounding whitespace.
var varRegex = regexp.MustCompile(`\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}`)

// ExtractVariables finds all unique variable keys referenced inside content.
func ExtractVariables(content string) []string {
	matches := varRegex.FindAllStringSubmatch(content, -1)
	if len(matches) == 0 {
		return nil
	}

	seen := make(map[string]struct{})
	var vars []string
	for _, m := range matches {
		if len(m) > 1 {
			key := strings.TrimSpace(m[1])
			if _, exists := seen[key]; !exists {
				seen[key] = struct{}{}
				vars = append(vars, key)
			}
		}
	}
	sort.Strings(vars)
	return vars
}

// Render replaces all {{variable}} placeholders with the string representation of their value.
// If a variable is missing from vars, it is replaced with an empty string.
func Render(content string, vars map[string]any) string {
	if vars == nil {
		vars = make(map[string]any)
	}

	return varRegex.ReplaceAllStringFunc(content, func(match string) string {
		sub := varRegex.FindStringSubmatch(match)
		if len(sub) < 2 {
			return match
		}
		key := strings.TrimSpace(sub[1])
		val, exists := vars[key]
		if !exists || val == nil {
			return ""
		}
		return fmt.Sprintf("%v", val)
	})
}
