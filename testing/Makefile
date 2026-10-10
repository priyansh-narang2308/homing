key ?= $(HOMING_API_KEY)
base ?= http://localhost:8080
to ?= test@example.com
n ?= 50

run = HOMING_API_KEY=$(key) HOMING_BASE_URL=$(base) go run .

.PHONY: help single batch all prod

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-8s %s\n", $$1, $$2}'

single: ## Send one HTML email: make single key=hom_... [to=you@example.com] [base=URL]
	@test -n "$(key)" || (echo "usage: make single key=hom_... [to=you@example.com]" && exit 1)
	$(run) -mode single -to $(to)

batch: ## Send n HTML emails at once (default 50): make batch key=hom_... [n=500]
	@test -n "$(key)" || (echo "usage: make batch key=hom_... [n=50]" && exit 1)
	$(run) -mode batch -batch $(n)

prod: ## Run the dashboard SDK snippet against production: make prod key=hom_... to=<your login email>
	@test -n "$(key)" && test "$(to)" != "test@example.com" || (echo "usage: make prod key=hom_... to=<your Homing login email>" && exit 1)
	HOMING_API_KEY=$(key) go run prod_testing.go -to $(to)

all: ## Send the single email, then the batch
	@test -n "$(key)" || (echo "usage: make all key=hom_... [to=you@example.com] [n=50]" && exit 1)
	$(run) -mode all -to $(to) -batch $(n)

