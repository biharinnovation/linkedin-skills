"""API integration tests for all dashboard endpoints."""
import unittest
from starlette.testclient import TestClient
from dashboard.backend.app.main import app
from dashboard.backend.app.database import init_db


class TestAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)

    def test_root_endpoint(self):
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "operational")

    def test_system_health(self):
        resp = self.client.get("/api/system/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("status", data)
        self.assertEqual(data["active_skills_count"], 12)
        self.assertIsInstance(data["integrations"], list)

    def test_skills_list_discovers_12_skills(self):
        resp = self.client.get("/api/skills")
        self.assertEqual(resp.status_code, 200)
        skills = resp.json()
        self.assertEqual(len(skills), 12)
        names = {s["name"] for s in skills}
        self.assertIn("linkedin-humanizer", names)
        self.assertIn("linkedin-post-writer", names)
        self.assertIn("linkedin-content-planner", names)

    def test_skill_detail(self):
        resp = self.client.get("/api/skills/linkedin-humanizer")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["name"], "linkedin-humanizer")
        self.assertTrue(data["has_subskills"])
        self.assertIn("post-audit", data["subskills"])
        self.assertTrue(data["has_scripts"])

    def test_task_lifecycle(self):
        # 1. Create task
        create_payload = {
            "title": "API Test Task",
            "description": "Running selftest through API",
            "skill_name": "linkedin-pipeline-eval",
            "task_type": "selftest",
            "priority": "high",
            "auto_start": False,
        }
        res = self.client.post("/api/tasks", json=create_payload)
        self.assertEqual(res.status_code, 201)
        task = res.json()
        task_id = task["id"]
        self.assertEqual(task["status"], "pending")

        # 2. Update task
        patch_res = self.client.patch(f"/api/tasks/{task_id}", json={"priority": "urgent"})
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.json()["priority"], "urgent")

        # 3. Queue task
        queue_res = self.client.post(f"/api/tasks/{task_id}/queue")
        self.assertEqual(queue_res.status_code, 200)
        self.assertEqual(queue_res.json()["status"], "queued")

        # 4. Cancel task
        cancel_res = self.client.post(f"/api/tasks/{task_id}/cancel")
        self.assertEqual(cancel_res.status_code, 200)
        self.assertEqual(cancel_res.json()["status"], "cancelled")

        # 5. Retry task
        retry_res = self.client.post(f"/api/tasks/{task_id}/retry")
        self.assertEqual(retry_res.status_code, 200)
        self.assertEqual(retry_res.json()["status"], "queued")
        self.assertEqual(retry_res.json()["retry_count"], 1)

    def test_assets_listing_and_preview(self):
        resp = self.client.get("/api/assets")
        self.assertEqual(resp.status_code, 200)
        assets = resp.json()
        self.assertIsInstance(assets, list)

        # Preview docs file
        preview_resp = self.client.get("/api/assets/view?path=docs/DASHBOARD_IMPLEMENTATION_PLAN.md")
        self.assertEqual(preview_resp.status_code, 200)
        self.assertIn("content", preview_resp.json())

    def test_assets_traversal_blocked(self):
        resp = self.client.get("/api/assets/view?path=../../etc/passwd")
        self.assertEqual(resp.status_code, 403)


if __name__ == "__main__":
    unittest.main()
