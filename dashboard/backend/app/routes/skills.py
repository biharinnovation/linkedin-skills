"""Skills registry endpoints discovering skills dynamically from the repository."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException
import yaml
from ..config import ROOT_DIR
from ..database import get_db
from ..models import SkillSummary

router = APIRouter(prefix="/skills", tags=["Skills"])

FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n", re.S)


def _format_display_name(raw_name: str) -> str:
    cleaned = raw_name.replace("linkedin-", "").replace("-", " ")
    return cleaned.title()


def _get_skill_actions(skill_name: str) -> List[str]:
    """Map known safe actions supported by specific skills."""
    action_map = {
        "linkedin-humanizer": ["test_detectors", "audit_post", "explain_rules"],
        "linkedin-pipeline-eval": ["run_evals", "check_actor_inputs"],
        "linkedin-post": ["schedule_post_dry_run", "publish_post_live"],
        "linkedin-comment": ["post_comment_dry_run"],
    }
    return action_map.get(skill_name, ["selftest", "check_config"])


def parse_skill_dir(skill_dir: Path) -> Dict[str, Any]:
    skill_file = skill_dir / "SKILL.md"
    if not skill_file.is_file():
        raise FileNotFoundError(f"SKILL.md not found in {skill_dir}")

    content = skill_file.read_text(encoding="utf-8")
    match = FRONTMATTER_RE.match(content)
    frontmatter = {}
    body = content
    if match:
        try:
            frontmatter = yaml.safe_load(match.group(1)) or {}
            body = content[match.end():]
        except Exception:
            pass

    name = frontmatter.get("name", skill_dir.name)
    description = frontmatter.get("description", "")

    subskills_dir = skill_dir / "sub-skills"
    subskills = (
        [f.stem for f in subskills_dir.iterdir() if f.is_file() and f.suffix == ".md"]
        if subskills_dir.is_dir()
        else []
    )

    scripts_dir = skill_dir / "scripts"
    scripts = [f.name for f in scripts_dir.iterdir() if f.is_file() and not f.name.startswith(".")] if scripts_dir.is_dir() else []

    references_dir = skill_dir / "references"
    references = [f.name for f in references_dir.iterdir() if f.is_file() and not f.name.startswith(".")] if references_dir.is_dir() else []

    return {
        "name": name,
        "display_name": _format_display_name(name),
        "description": description,
        "has_subskills": bool(subskills),
        "subskills": subskills,
        "has_scripts": bool(scripts),
        "scripts": scripts,
        "references": references,
        "supported_actions": _get_skill_actions(name),
        "doc_path": str(skill_file.relative_to(ROOT_DIR)),
        "instructions_markdown": body,
    }


@router.get("", response_model=List[SkillSummary])
def list_skills():
    """Discover all 12 skills dynamically from the skills/ directory."""
    skills_dir = ROOT_DIR / "skills"
    if not skills_dir.is_dir():
        return []

    summaries = []
    for d in sorted(skills_dir.iterdir()):
        if d.is_dir() and (d / "SKILL.md").is_file():
            parsed = parse_skill_dir(d)
            summaries.append(
                SkillSummary(
                    name=parsed["name"],
                    display_name=parsed["display_name"],
                    description=parsed["description"],
                    has_subskills=parsed["has_subskills"],
                    subskills=parsed["subskills"],
                    has_scripts=parsed["has_scripts"],
                    scripts=parsed["scripts"],
                    supported_actions=parsed["supported_actions"],
                    doc_path=parsed["doc_path"],
                )
            )
    return summaries


@router.get("/{name}")
def get_skill_detail(name: str):
    """Retrieve full skill instructions, sub-skills, scripts, and recent related tasks."""
    skill_dir = ROOT_DIR / "skills" / name
    if not skill_dir.is_dir() or not (skill_dir / "SKILL.md").is_file():
        raise HTTPException(status_code=404, detail=f"Skill '{name}' not found")

    detail = parse_skill_dir(skill_dir)

    # Attach related tasks from DB
    related_tasks = []
    try:
        with get_db() as conn:
            cur = conn.execute(
                "SELECT id, title, status, created_at, completed_at FROM tasks WHERE skill_name = ? ORDER BY created_at DESC LIMIT 10",
                (name,),
            )
            related_tasks = [dict(row) for row in cur.fetchall()]
    except Exception:
        pass

    detail["related_tasks"] = related_tasks
    return detail
