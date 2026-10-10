# Build from the repository root (go.mod lives there):
#   docker build -f backend/Dockerfile -t homing .
# One image runs every role. The default command runs the API; override it with
# "/app/homing worker" or "/app/homing migrate up".
FROM golang:1.27-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY backend ./backend
ENV GOWORK=off CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/homing ./backend/cmd

# Alpine rather than distroless: hosts like Railway may run custom start commands
# through /bin/sh, which distroless doesn't have.
FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 homing
COPY --from=build /out/homing /app/homing
USER homing
CMD ["/app/homing", "api"]
