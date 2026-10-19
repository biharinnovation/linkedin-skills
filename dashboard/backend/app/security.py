"""Security utilities: path validation, traversal protection, and secret redaction."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Sequence
from .config import ROOT_DIR, ALLOWED_ASSET_DIRECTORIES

# Patterns for sensitive tokens and keys
SECRET_PATTERNS = [
    re.compile(r"sk_[A-Za-z0-9_\-]{16,}", re.IGNORECASE),
    re.compile(r"apify_api_[A-Za-z0-9_\-]{16,}", re.IGNORECASE),
    re.compile(r"pf_live_[A-Za-z0-9_\-]{16,}", re.IGNORECASE),
    re.compile(r"AIzaSy[A-Za-z0-9_\-]{30,}", re.IGNORECASE),
    re.compile(r"(?:api[_-]?key|token|secret|password)\s*[:=]\s*['\"]?([A-Za-z0-9_\-\.]{8,})['\"]?", re.IGNORECASE),
    re.compile(r"Bearer\s+([A-Za-z0-9_\-\.]{16,})", re.IGNORECASE),
]

DISALLOWED_FILE_PATTERNS = [
    re.compile(r"^\.env.*", re.IGNORECASE),
    re.compile(r".*\.pem$", re.IGNORECASE),
    re.compile(r".*\.key$", re.IGNORECASE),
    re.compile(r".*id_rsa.*", re.IGNORECASE),
    re.compile(r".*\.sqlite3.*", re.IGNORECASE),
]


def sanitize_log(text: str) -> str:
    """Redact sensitive keys, tokens, and authorization headers from logs and outputs."""
    if not text:
        return ""
    sanitized = text
    for pattern in SECRET_PATTERNS:
        sanitized = pattern.sub("[REDACTED_SECRET]", sanitized)
    return sanitized


def validate_safe_path(requested_path: str | Path, allowed_dirs: Sequence[Path] | None = None) -> Path:
    """Validate that a requested file path resolves safely within allowed directories.
    
    Raises:
        PermissionError: If path attempts traversal or targets sensitive files.
        FileNotFoundError: If the file does not exist.
    """
    allowed = allowed_dirs or ALLOWED_ASSET_DIRECTORIES
    raw_path = Path(requested_path)
    
    # Check for direct path traversal attempts in raw path string
    str_path = str(requested_path)
    if ".." in str_path.split("/") or ".." in str_path.split("\\"):
        raise PermissionError(f"Access denied: path traversal not permitted ({requested_path})")

    # If relative, resolve relative to ROOT_DIR
    resolved = (ROOT_DIR / raw_path).resolve() if not raw_path.is_absolute() else raw_path.resolve()

    # Reject forbidden filename patterns (.env, keys, etc.)
    filename = resolved.name
    for forbidden in DISALLOWED_FILE_PATTERNS:
        if forbidden.match(filename):
            raise PermissionError(f"Access denied: sensitive file type forbidden ({filename})")

    # Reject hidden files or hidden directories in path
    for part in resolved.parts:
        if part.startswith(".") and part not in (".", ".."):
            raise PermissionError(f"Access denied: hidden path access forbidden ({part})")

    # Check if resolved path is within at least one allowed directory
    is_allowed = False
    for allowed_dir in allowed:
        resolved_allowed = allowed_dir.resolve()
        if resolved == resolved_allowed or resolved_allowed in resolved.parents:
            is_allowed = True
            break

    if not is_allowed:
        raise PermissionError(f"Access denied: path outside allowed directories ({resolved})")

    if not resolved.exists():
        raise FileNotFoundError(f"File not found: {resolved}")

    return resolved
