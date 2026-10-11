package template

import (
	"reflect"
	"testing"
)

func TestExtractVariables(t *testing.T) {
	content := `Hello {{name}}, your order {{ order_id }} is ready! Click {{reset_link}} or {{ name }}.`
	vars := ExtractVariables(content)
	expected := []string{"name", "order_id", "reset_link"}

	if !reflect.DeepEqual(vars, expected) {
		t.Fatalf("ExtractVariables got %v, want %v", vars, expected)
	}
}

func TestRender(t *testing.T) {
	tmpl := `Hi {{ name }}, your balance is ${{balance}}. Missing: [{{missing}}].`
	vars := map[string]any{
		"name":    "Alice",
		"balance": 150,
	}

	rendered := Render(tmpl, vars)
	expected := `Hi Alice, your balance is $150. Missing: [].`

	if rendered != expected {
		t.Fatalf("Render got %q, want %q", rendered, expected)
	}
}
