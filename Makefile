.PHONY: run test lint format typecheck check clean up down logs db-shell

run:
	uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

test:
	pytest tests/ -v

lint:
	ruff check src/ tests/

format:
	ruff format src/ tests/

typecheck:
	mypy src/

check: lint format test

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name .ruff_cache -exec rm -rf {} +

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f backend

db-shell:
	docker compose exec db psql -U p151 -d p151
