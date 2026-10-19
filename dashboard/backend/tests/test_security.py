"""Tests for security utilities: path traversal protection and secret redaction."""
import unittest
from pathlib import Path
from dashboard.backend.app.security import sanitize_log, validate_safe_path
from dashboard.backend.app.config import ROOT_DIR


class TestSecurity(unittest.TestCase):
    def test_sanitize_log_redacts_apify_tokens(self):
        log = "Connecting to Apify with apify_api_1234567890abcdef12345678"
        sanitized = sanitize_log(log)
        self.assertNotIn("apify_api_1234567890abcdef12345678", sanitized)
        self.assertIn("[REDACTED_SECRET]", sanitized)

    def test_sanitize_log_redacts_publora_keys(self):
        log = "Publora request using sk_live_9876543210abcdef9876"
        sanitized = sanitize_log(log)
        self.assertNotIn("sk_live_9876543210abcdef9876", sanitized)
        self.assertIn("[REDACTED_SECRET]", sanitized)

    def test_sanitize_log_redacts_gemini_keys(self):
        log = "Calling Gemini API with key AIzaSyD9876543210zyxwvutsrqponmlkjihg"
        sanitized = sanitize_log(log)
        self.assertNotIn("AIzaSyD9876543210zyxwvutsrqponmlkjihg", sanitized)
        self.assertIn("[REDACTED_SECRET]", sanitized)

    def test_validate_safe_path_allows_docs(self):
        p = validate_safe_path("docs/DASHBOARD_IMPLEMENTATION_PLAN.md")
        self.assertTrue(p.exists())
        self.assertTrue(p.is_file())

    def test_validate_safe_path_allows_references(self):
        p = validate_safe_path("references/voice-rules.md")
        self.assertTrue(p.exists())
        self.assertTrue(p.is_file())

    def test_validate_safe_path_rejects_traversal(self):
        with self.assertRaises(PermissionError):
            validate_safe_path("../../../etc/passwd")

    def test_validate_safe_path_rejects_env_file(self):
        with self.assertRaises(PermissionError):
            validate_safe_path(".env")

    def test_validate_safe_path_rejects_keys(self):
        with self.assertRaises(PermissionError):
            validate_safe_path("testing/id_rsa")


if __name__ == "__main__":
    unittest.main()
