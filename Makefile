.PHONY: up down backend ai frontend install clean

# Infrastructure
up:
	docker compose up -d

down:
	docker compose down

# Services
backend:
	cd backend && npx tsx watch src/server.ts

ai:
	cd ai_services && .venv/bin/python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

frontend:
	cd frontend && npm run dev

# Setup & Dependencies
install:
	@echo "Installing Backend dependencies..."
	cd backend && npm install
	@echo "Installing Frontend dependencies..."
	cd frontend && npm install
	@echo "Installing AI dependencies..."
	cd ai_services && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

clean:
	@echo "Cleaning node_modules and .venv..."
	cd backend && rm -rf node_modules
	cd frontend && rm -rf node_modules
	cd ai_services && rm -rf .venv
