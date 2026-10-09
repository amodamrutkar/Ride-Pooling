.PHONY: setup run test bench clean

# ─── Setup: create venv, install Python deps, install frontend deps ───
setup:
	python -m venv .venv
ifeq ($(OS),Windows_NT)
	.venv\Scripts\pip install --upgrade pip
	.venv\Scripts\pip install -r backend/requirements.txt
else
	.venv/bin/pip install --upgrade pip
	.venv/bin/pip install -r backend/requirements.txt
endif
	cd frontend && npm install

# ─── Run: start backend (uvicorn) and frontend (vite) ─────────────────
run:
ifeq ($(OS),Windows_NT)
	start /B .venv\Scripts\uvicorn backend.app.main:app --reload --port 8000
else
	.venv/bin/uvicorn backend.app.main:app --reload --port 8000 &
endif
	cd frontend && npm run dev

# ─── Test: run pytest ─────────────────────────────────────────────────
test:
ifeq ($(OS),Windows_NT)
	.venv\Scripts\pytest backend/tests/ -v
else
	.venv/bin/pytest backend/tests/ -v
endif

# ─── Bench: run benchmark script ─────────────────────────────────────
bench:
ifeq ($(OS),Windows_NT)
	.venv\Scripts\python scripts/benchmark.py
else
	.venv/bin/python scripts/benchmark.py
endif

# ─── Clean: remove generated files ───────────────────────────────────
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf .venv frontend/node_modules frontend/dist
