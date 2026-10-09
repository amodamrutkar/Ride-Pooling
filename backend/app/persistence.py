"""
SQLite State Snapshot Persistence — PoolIQ

Snapshots simulation and dispatch state to SQLite for crash recovery and audit trails.
Owner: Ketan
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Optional


class PersistenceManager:
    """Manages periodic state snapshots into SQLite."""

    def __init__(self, db_path: str = "backend/data/pooliq.db") -> None:
        self.db_path = db_path
        self._memory_conn: Optional[sqlite3.Connection] = None
        # Ensure parent folder exists
        if db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        else:
            self._memory_conn = sqlite3.connect(":memory:")
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        if self._memory_conn is not None:
            return self._memory_conn
        return sqlite3.connect(self.db_path)

    def _init_db(self) -> None:
        try:
            with self._get_connection() as conn:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS snapshots (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        sim_time REAL NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        state_json TEXT NOT NULL
                    )
                    """
                )
                conn.commit()
        except Exception:
            # Non-blocking if file cannot be created
            pass

    def save_snapshot(self, sim_time: float, state_dict: dict[str, Any]) -> bool:
        """Save a snapshot of the current state. Returns True if successful."""
        try:
            state_json = json.dumps(state_dict)
            with self._get_connection() as conn:
                conn.execute(
                    "INSERT INTO snapshots (sim_time, state_json) VALUES (?, ?)",
                    (sim_time, state_json),
                )
                conn.commit()
            return True
        except Exception:
            return False

    def load_latest_snapshot(self) -> Optional[dict[str, Any]]:
        """Load the most recent snapshot if one exists."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT state_json FROM snapshots ORDER BY id DESC LIMIT 1"
                )
                row = cursor.fetchone()
                if row:
                    return json.loads(row[0])
            return None
        except Exception:
            return None

    def clear(self) -> None:
        """Clear all snapshots (e.g. on scenario reload or reset)."""
        try:
            with self._get_connection() as conn:
                conn.execute("DELETE FROM snapshots")
                conn.commit()
        except Exception:
            pass
