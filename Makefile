.PHONY: help install dev build deploy clean test lint

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install all dependencies
	npm install
	cd edge-cv && pip install -r requirements.txt

dev: ## Run development servers
	@echo "Starting Workers dev server..."
	npm run dev:worker

dev-frontend: ## Run frontend dev server
	npm run dev

dev-edge: ## Run edge CV (requires .env setup)
	cd edge-cv && python main.py

build: ## Build all components
	npm run build

deploy: ## Deploy to Cloudflare
	npm run deploy

db-create: ## Create D1 database
	wrangler d1 create kitcheneye-db

db-migrate: ## Run database migrations
	wrangler d1 migrations apply kitcheneye-db

db-console: ## Open D1 console
	wrangler d1 execute kitcheneye-db --command "SELECT 'Connected to KitchenEye DB' as status"

clean: ## Clean build artifacts
	rm -rf dist/
	rm -rf node_modules/
	rm -rf .wrangler/
	rm -rf edge-cv/__pycache__/
	rm -rf edge-cv/captures/

test: ## Run tests
	npm test

lint: ## Run linter
	npm run lint

docker-build: ## Build edge CV Docker image
	cd edge-cv && docker build -t kitcheneye-edgecv:latest .

docker-run: ## Run edge CV in Docker
	cd edge-cv && docker-compose up -d

docker-stop: ## Stop edge CV Docker containers
	cd edge-cv && docker-compose down

docker-logs: ## View edge CV logs
	cd edge-cv && docker-compose logs -f

setup-env: ## Create .env files from examples
	@if [ ! -f edge-cv/.env ]; then \
		cp edge-cv/.env.example edge-cv/.env; \
		echo "Created edge-cv/.env - please edit with your configuration"; \
	fi

init: install setup-env db-create db-migrate ## Initialize project (first time setup)
	@echo ""
	@echo "✅ Project initialized!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Update wrangler.toml with your database IDs"
	@echo "  2. Configure edge-cv/.env with your camera settings"
	@echo "  3. Run 'make deploy' to deploy to Cloudflare"
	@echo "  4. Run 'make dev-edge' to start edge CV"
	@echo ""
