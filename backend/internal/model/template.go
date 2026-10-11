package model

import (
	"github.com/google/uuid"
)

type Template struct {
	Base
	UserID      uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	Name        string    `json:"name"`
	Slug        string    `gorm:"index" json:"slug"`
	Description string    `json:"description"`
	Subject     string    `json:"subject"`
	HTMLContent string    `gorm:"column:html_content" json:"html_content"`
	SampleVars  string    `gorm:"type:jsonb;default:'{}'" json:"sample_vars"`
}

func (Template) TableName() string {
	return "email_templates"
}
