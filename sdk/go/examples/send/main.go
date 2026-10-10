// Sends one email with the Homing Go SDK and waits until it is sent or fails.
//
//	HOMING_API_KEY=hom_... go run ./examples/send you@example.com
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	homing "github.com/priyansh-narang2308/homing/sdk/go"
)

func main() {
	apiKey := os.Getenv("HOMING_API_KEY")
	if apiKey == "" {
		log.Fatal("set HOMING_API_KEY to a key from the Homing dashboard")
	}
	to := "delivered@example.com"
	if len(os.Args) > 1 {
		to = os.Args[1]
	}

	opts := []homing.Option{}
	if baseURL := os.Getenv("HOMING_BASE_URL"); baseURL != "" {
		opts = append(opts, homing.WithBaseURL(baseURL))
	}
	client := homing.NewClient(apiKey, opts...)

	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	resp, err := client.Emails.Send(ctx, &homing.SendEmailRequest{
		From:    "Homing <onboarding@homing.dev>",
		To:      to,
		Subject: "Hello World",
		HTML:    "<p>Congrats on sending your <strong>first email</strong>!</p>",
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("queued:", resp.ID)

	for {
		email, err := client.Emails.Get(ctx, resp.ID)
		if err != nil {
			log.Fatal(err)
		}
		switch email.Status {
		case homing.StatusSent:
			fmt.Println("sent after", email.Attempts, "attempt(s)")
			return
		case homing.StatusFailed:
			log.Fatalf("failed: %s", email.LastError)
		}
		time.Sleep(time.Second)
	}
}
