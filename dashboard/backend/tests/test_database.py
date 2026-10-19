"""Tests for database initialization, schema versioning, and crash recovery."""
import os
import tempfile
import unittest
from pathlib import Path
from dashboard.backend.app.database import get_db, init_db, recover_stale_tasks


class TestDatabase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test.sqlite3"

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_init_db_creates_tables(self):
        init_db(self.db_path)
        with get_db(self.db_path) as conn:
            cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = {row[0] for row in cur.fetchall()}
            self.assertIn("tasks", tables)
            self.assertIn("executions", tables)
            self.assertIn("approvals", tables)
            self.assertIn("evaluation_history", tables)
            self.assertIn("schema_versions", tables)

    def test_recover_stale_tasks(self):
        init_db(self.db_path)
        with get_db(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO tasks (id, title, task_type, status)
                VALUES ('t1', 'Running task', 'selftest', 'running')
                """
            )
            conn.execute(
                """
                INSERT INTO executions (id, task_id, command_name, status)
                VALUES ('e1', 't1', 'python scripts/selftest.py', 'running')
                """
            )

        recovered = recover_stale_tasks(self.db_path)
        self.assertEqual(recovered, 1)

        with get_db(self.db_path) as conn:
            task = conn.execute("SELECT status, error_message FROM tasks WHERE id = 't1'").fetchone()
            self.assertEqual(task[0], "failed")
            self.assertIn("interrupted by server restart", task[1])

            exec_row = conn.execute("SELECT status, stderr FROM executions WHERE id = 'e1'").fetchone()
            self.assertEqual(exec_row[0], "failed")
            self.assertIn("interrupted by server restart", exec_row[1])


if __name__ == "__main__":
    unittest.main()
