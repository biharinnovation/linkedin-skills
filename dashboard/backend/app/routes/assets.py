"""Asset Library endpoints: safe file browsing, preview, and downloads."""
from __future__ import annotations

import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, PlainTextResponse
from ..config import ALLOWED_ASSET_DIRECTORIES, ROOT_DIR
from ..models import AssetFile
from ..security import validate_safe_path

router = APIRouter(prefix="/assets", tags=["Assets"])

SAFE_EXTENSIONS = {".md", ".json", ".txt", ".py", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".pdf"}


def _get_category(rel_path: str) -> str:
    if rel_path.startswith("docs"):
        return "documentation"
    elif rel_path.startswith("references"):
        return "reference"
    elif rel_path.startswith("evals"):
        return "evaluation"
    elif rel_path.startswith("testing"):
        return "test_artifact"
    elif rel_path.startswith("dashboard/data/exports"):
        return "exported_post"
    return "general"


@router.get("", response_model=List[AssetFile])
def list_assets(
    category: Optional[str] = None,
    extension: Optional[str] = None,
    search: Optional[str] = None,
):
    """Scan and list safe project assets across allowed directories."""
    assets = []

    for base_dir in ALLOWED_ASSET_DIRECTORIES:
        if not base_dir.is_dir():
            continue

        for p in base_dir.rglob("*"):
            if not p.is_file():
                continue
            if p.name.startswith("."):
                continue
            if p.suffix.lower() not in SAFE_EXTENSIONS:
                continue

            try:
                rel = p.relative_to(ROOT_DIR)
                rel_str = str(rel)
                cat = _get_category(rel_str)
                ext = p.suffix.lower()

                if category and cat != category:
                    continue
                if extension and ext != extension.lower():
                    continue
                if search and search.lower() not in p.name.lower() and search.lower() not in rel_str.lower():
                    continue

                stat = p.stat()
                mtime = datetime.datetime.fromtimestamp(stat.st_mtime, tz=datetime.timezone.utc).isoformat()

                assets.append(
                    AssetFile(
                        name=p.name,
                        relative_path=rel_str,
                        size_bytes=stat.st_size,
                        extension=ext,
                        category=cat,
                        modified_at=mtime,
                    )
                )
            except Exception:
                continue

    return sorted(assets, key=lambda x: x.modified_at, reverse=True)


@router.get("/view")
def view_asset(path: str = Query(...)):
    """Safely preview text, json, markdown, or image file contents."""
    try:
        resolved = validate_safe_path(path)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    ext = resolved.suffix.lower()
    if ext in {".png", ".jpg", ".jpeg", ".webp", ".svg", ".pdf"}:
        return FileResponse(str(resolved))

    # For text files, read and return content
    try:
        content = resolved.read_text(encoding="utf-8", errors="replace")
        return {"path": path, "extension": ext, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {e}")


@router.get("/download")
def download_asset(path: str = Query(...)):
    """Safely download an allowed asset file with strict path validation."""
    try:
        resolved = validate_safe_path(path)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return FileResponse(str(resolved), filename=resolved.name)
