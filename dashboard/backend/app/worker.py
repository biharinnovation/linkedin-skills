"""Background Task Worker & Subprocess Supervisor."""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import time
import uuid
from typing import Any, Dict, List, Optional
from .config import ROOT_DIR, DATA_DIR
from .database import get_db
from .security import sanitize_log


class TaskWorker:
    """Async background worker that processes queued tasks safely."""

    def __init__(self, poll_interval: float = 1.0):
        self.poll_interval = poll_interval
        self._running = False
        self._current_process: Optional[subprocess.Popen] = None
        self._current_execution_id: Optional[str] = None

    async def start(self) -> None:
        """Start the background worker loop."""
        self._running = True
        while self._running:
            try:
                task = self._fetch_next_queued_task()
                if task:
                    await self._execute_task(task)
                else:
                    await asyncio.sleep(self.poll_interval)
            except Exception as e:
                print(f"[Worker Error] {type(e).__name__}: {e}", file=sys.stderr)
                await asyncio.sleep(self.poll_interval)

    def stop(self) -> None:
        """Stop worker and kill any actively running subprocess."""
        self._running = False
        if self._current_process and self._current_process.poll() is None:
            try:
                self._current_process.terminate()
            except Exception:
                pass

    def _fetch_next_queued_task(self) -> Optional[Dict[str, Any]]:
        with get_db() as conn:
            cur = conn.execute(
                """
                SELECT * FROM tasks
                WHERE status = 'queued'
                ORDER BY
                    CASE priority
                        WHEN 'urgent' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3
                        WHEN 'low' THEN 4
                        ELSE 5
                    END,
                    created_at ASC
                LIMIT 1
                """
            )
            row = cur.fetchone()
            if row:
                task_dict = dict(row)
                # Atomically transition to running
                conn.execute(
                    "UPDATE tasks SET status = 'running', started_at = CURRENT_TIMESTAMP, progress = 10 WHERE id = ?",
                    (task_dict["id"],),
                )
                return task_dict
        return None

    async def _execute_task(self, task: Dict[str, Any]) -> None:
        task_id = task["id"]
        task_type = task["task_type"]
        raw_params = task.get("parameters_json") or "{}"
        try:
            params = json.loads(raw_params)
        except Exception:
            params = {}

        execution_id = f"exec_{uuid.uuid4().hex[:12]}"
        self._current_execution_id = execution_id
        cmd, backend_model, requires_approval, approval_preview = self._resolve_command(task_type, params)

        # If task requires human approval before proceeding
        if requires_approval:
            with get_db() as conn:
                cur = conn.execute(
                    "SELECT id FROM approvals WHERE task_id = ? AND status = 'approved' ORDER BY decided_at DESC LIMIT 1",
                    (task_id,),
                )
                already_approved = cur.fetchone() is not None

                if not already_approved:
                    # Check if pending approval already exists
                    cur_pending = conn.execute(
                        "SELECT id FROM approvals WHERE task_id = ? AND status = 'pending' LIMIT 1",
                        (task_id,),
                    )
                    if not cur_pending.fetchone():
                        approval_id = f"appr_{uuid.uuid4().hex[:12]}"
                        conn.execute(
                            """
                            INSERT INTO approvals (id, task_id, title, action_type, target_url, content_preview, status)
                            VALUES (?, ?, ?, ?, ?, ?, 'pending')
                            """,
                            (
                                approval_id,
                                task_id,
                                task["title"],
                                params.get("action_type", "publish"),
                                params.get("target_url"),
                                approval_preview,
                            ),
                        )
                    conn.execute(
                        "UPDATE tasks SET status = 'needs_approval', progress = 50 WHERE id = ?",
                        (task_id,),
                    )
                    return

        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO executions (id, task_id, command_name, backend_model, status, started_at)
                VALUES (?, ?, ?, ?, 'running', CURRENT_TIMESTAMP)
                """,
                (execution_id, task_id, " ".join(cmd), backend_model),
            )

        started = time.time()
        stdout_acc, stderr_acc, exit_code = "", "", -1

        try:
            # Execute subprocess asynchronously
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(ROOT_DIR),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUNBUFFERED": "1"},
            )

            stdout_bytes, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=420.0)
            exit_code = proc.returncode
            stdout_acc = stdout_bytes.decode("utf-8", errors="replace")
            stderr_acc = stderr_bytes.decode("utf-8", errors="replace")
        except asyncio.TimeoutError:
            exit_code = -9
            stderr_acc = "Execution timed out after 420 seconds"
        except Exception as e:
            exit_code = -1
            stderr_acc = f"Execution error: {type(e).__name__}: {e}"
        finally:
            duration = round(time.time() - started, 2)
            clean_stdout = sanitize_log(stdout_acc)
            clean_stderr = sanitize_log(stderr_acc)
            final_status = "completed" if exit_code == 0 else "failed"

            with get_db() as conn:
                conn.execute(
                    """
                    UPDATE executions
                    SET status = ?, exit_code = ?, stdout = ?, stderr = ?, ended_at = CURRENT_TIMESTAMP, duration_seconds = ?
                    WHERE id = ?
                    """,
                    (final_status, exit_code, clean_stdout, clean_stderr, duration, execution_id),
                )
                error_msg = clean_stderr.strip().splitlines()[-1][:200] if exit_code != 0 and clean_stderr else None
                conn.execute(
                    """
                    UPDATE tasks
                    SET status = ?, completed_at = CURRENT_TIMESTAMP, progress = 100, error_message = ?,
                        result_json = ?
                    WHERE id = ?
                    """,
                    (
                        final_status,
                        error_msg,
                        json.dumps({"exit_code": exit_code, "output_summary": clean_stdout[:500]}),
                        task_id,
                    ),
                )
            self._current_execution_id = None

    def _resolve_command(
        self, task_type: str, params: Dict[str, Any]
    ) -> tuple[List[str], Optional[str], bool, str]:
        """Map task type to strict, validated command arrays (no shell interpolation)."""
        py = sys.executable

        if task_type == "selftest":
            return [py, "scripts/selftest.py"], None, False, ""
        elif task_type == "check_config":
            return [py, "scripts/check_config.py", "--offline"], None, False, ""
        elif task_type == "check_frontmatter":
            return [py, "scripts/check_frontmatter.py"], None, False, ""
        elif task_type == "check_no_secrets":
            return [py, "scripts/check_no_secrets.py"], None, False, ""
        elif task_type == "check_actor_inputs":
            return [py, "scripts/check_actor_inputs.py"], None, False, ""
        elif task_type == "check_markdown_refs":
            return [py, "scripts/check_markdown_references.py"], None, False, ""
        elif task_type == "test_detectors":
            text = params.get("text", "Automating LinkedIn outreach with data pipelines")
            return [py, "skills/linkedin-humanizer/scripts/test_detectors.py", "--demo", "--text", text], None, False, ""
        elif task_type == "run_evals":
            backend = params.get("backend", "gemini")
            model = params.get("model")
            case = params.get("case")
            save_path = str(DATA_DIR / f"eval_output_{int(time.time())}.json")
            cmd = [py, "evals/run_evals.py", "--backend", backend, "--save", save_path]
            if model:
                cmd.extend(["--model", model])
            if case:
                cmd.extend(["--case", case])
            return cmd, model or ("gemini-3.7-flash" if backend == "gemini" else "claude"), False, ""
        elif task_type == "schedule_post_dry_run":
            return [py, "scripts/schedule_post.py", "--dry-run"], None, False, ""
        elif task_type == "post_comment_dry_run":
            url = params.get("url", "https://www.linkedin.com/posts/example_activity-7321583293986988033")
            msg = params.get("message", "Great insight on system design!")
            return [py, "scripts/post_comment.py", url, msg, "--dry-run"], None, False, ""
        elif task_type == "publish_post_live":
            content = params.get("content", "")
            return [py, "scripts/schedule_post.py", "--dry-run"], None, True, content
        else:
            # Default safe fallback: run selftest
            return [py, "scripts/selftest.py"], None, False, ""


_worker_instance: Optional[TaskWorker] = None


def get_worker() -> TaskWorker:
    global _worker_instance
    if _worker_instance is None:
        _worker_instance = TaskWorker()
    return _worker_instance
