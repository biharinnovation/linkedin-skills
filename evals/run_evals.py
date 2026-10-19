#!/usr/bin/env python3
"""Do the skills actually do what they claim?

    python3 evals/run_evals.py              # every case
    python3 evals/run_evals.py --case reply-parent
    python3 evals/run_evals.py --list

The tests in `tests/` check the plumbing and the documents. Nothing checks the
thing the bundle actually is: 7,000 lines of instructions an agent follows. This
does, by running the agent against a fixture and grading what comes back.

Each case pastes its input into the prompt rather than relying on a key, which
is both cheaper and the path most users are on: with no APIFY_TOKEN the reading
skills ask you to paste, so this exercises the manual flow end to end.

Graders are deterministic and narrow on purpose. They check claims that have a
right answer — the parentComment for a nested reply, whether a scrubbed draft
kept the user's real numbers — not whether the prose is any good. A grader that
needs taste is a grader that will drift.

Costs one model call per case.
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from typing import Optional

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
FIXTURES = ROOT / "tests" / "fixtures"

from lib._env import load_env

load_env()

GREEN, RED, YELLOW, GREY, BOLD, OFF = "\033[32m", "\033[31m", "\033[33m", "\033[90m", "\033[1m", "\033[0m"
if not sys.stdout.isatty():
    GREEN = RED = YELLOW = GREY = BOLD = OFF = ""


def load(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


# --------------------------------------------------------------- fixtures ---
def thread_for_prompt() -> tuple[str, dict]:
    """The recorded comment thread, rendered the way a user would paste it."""
    comments = load("apify_comments.json")
    threaded = next(c for c in comments if c.get("replies"))
    lines = [f"POST: https://www.linkedin.com/feed/update/urn:li:activity:7320867199693246465/", ""]
    lines.append(f"Top-level comment by {threaded['author']['name']} "
                 f"(comment id {threaded['comment_id']}):")
    lines.append(f"  {threaded['text']}")
    for reply in threaded["replies"]:
        lines.append(f"  -> Reply by {reply['author']['name']} (comment id {reply['comment_id']}):")
        lines.append(f"       {reply['text']}")
    return "\n".join(lines), threaded


# ------------------------------------------------------------------ cases ---
def case_reply_parent():
    """LinkedIn flattens threads to two levels. Replying to a reply must target
    the TOP comment's urn. Getting this wrong is a 400 or a misplaced reply, and
    it is the single most specific claim any skill in this bundle makes."""
    thread, threaded = thread_for_prompt()
    deepest = threaded["replies"][-1]
    prompt = (
        "Use the linkedin-reply-handler skill.\n\n"
        f"{thread}\n\n"
        f"I want to reply to the LAST reply, the one by {deepest['author']['name']} "
        f"(comment id {deepest['comment_id']}).\n\n"
        "Draft the reply. Do not publish anything. In your answer, state the exact "
        "parentComment URN you would send to the API on a line of its own."
    )

    def grade(output: str):
        top, wrong = str(threaded["comment_id"]), str(deepest["comment_id"])
        # Only urns carrying real digits count. An answer may also quote a
        # placeholder like `urn:li:comment:(activity:...,...)` while explaining
        # the format, and grading on the last match would read that instead.
        urns = [u for u in re.findall(r"urn:li:comment:\([^)]*\)", output)
                if re.search(r"\d{6,}", u)]
        if not urns:
            return False, "no parentComment urn with real ids stated"
        misdirected = [u for u in urns if wrong in u and top not in u]
        if misdirected:
            return False, f"targets the reply's own id {wrong}: the flattening rule was missed"
        if not any(top in u for u in urns):
            return False, f"never targets the top-level comment {top}; said {urns[:2]}"
        return True, f"correct top-level target {top}"

    return prompt, grade


def case_reply_no_invention():
    """Drafting against a pasted thread, the reply must not attribute claims to
    people who never made them."""
    thread, threaded = thread_for_prompt()
    prompt = ("Use the linkedin-reply-handler skill.\n\n" + thread +
              "\n\nDraft a reply to the top-level comment. Do not publish. Show the draft only.")

    def grade(output: str):
        invented = [n for n in ("Satya Nadella", "Microsoft CEO") if n in output]
        draft = output.lower()
        if "http" in draft and "linkedin.com" not in draft:
            return False, "the draft carries an outside link nobody asked for"
        if invented:
            return False, f"puts words on people not in the thread: {invented}"
        return True, "no invented participants, no stray links"

    return prompt, grade


def case_hook_formula():
    """hook-extractor claims it returns which of the 20 canonical formulas a
    post used. The answer must be one that exists."""
    defined = set(re.findall(r"^## (F\d+) ",
                             (ROOT / "references" / "hook-formulas.md").read_text(encoding="utf-8"), re.M))
    post = ("I deleted our $40k/yr analytics stack on a Tuesday.\n\n"
            "Three weeks later nobody on the team had noticed.\n\n"
            "Here is what we replaced it with, and the one thing that actually broke.")
    prompt = ("Use the linkedin-hook-extractor skill on this post. Do not fetch anything, "
              "the text is here.\n\n" + post +
              "\n\nName the formula by its F-number and quote the hook line you matched.")

    def grade(output: str):
        cited = set(re.findall(r"\b(F\d{1,2})\b", output))
        if not cited:
            return False, "named no formula at all"
        unknown = cited - defined
        if unknown:
            return False, f"cited formulas that do not exist: {sorted(unknown)}"
        if "deleted our $40k" not in output and "$40k" not in output:
            return False, "did not quote the hook line from the post"
        return True, f"cited {sorted(cited)} and quoted the hook"

    return prompt, grade


def case_humanizer_keeps_facts():
    """The scrub must remove AI vocabulary and keep the user's real numbers. A
    humanizer that launders away a figure is worse than none."""
    draft = ("In today's rapidly evolving landscape, we leveraged a robust framework to "
             "unlock synergies. We cut deploy time from 47 minutes to 6, and support "
             "tickets fell 31% in Q3. It's not just about speed, it's about delving deeper "
             "into what truly matters for our stakeholders.")
    prompt = ("Use the linkedin-humanizer skill on this draft. Return the rewritten draft "
              "only, no commentary.\n\n" + draft)

    def grade(output: str):
        missing = [n for n in ("47", "6", "31", "Q3") if n not in output]
        if missing:
            return False, f"dropped the user's own figures: {missing}"
        markers = [w for w in ("leverage", "robust", "synergie", "delve", "rapidly evolving",
                               "it's not just about", "truly matters") if w in output.lower()]
        if markers:
            return False, f"left AI markers in place: {markers}"
        return True, "figures kept, markers gone"

    return prompt, grade


def case_humanizer_audit_flags_blockers():
    """Audit mode should detect known blockers instead of silently treating
    a problematic draft as ready to publish."""
    draft = (
        "AI is transforming everything — and we need to act now — because this "
        "is a robust, comprehensive, groundbreaking framework for the future — "
        "truly a game changer.\n\n"
        "Here's the thing: we cut deploy time from 47 minutes to 6. "
        "Read the full story at https://example.com/report"
    )
    prompt = (
        "Use the linkedin-humanizer skill with --mode audit on this draft. "
        "Return the audit report only. Do not rewrite the full post.\n\n" + draft
    )

    def grade(output: str):
        lower = output.lower()

        if "fail" not in lower:
            return False, "audit did not produce a failing result"

        if "blocker" not in lower:
            return False, "audit did not report blockers"

        if "em dash" not in lower:
            return False, "audit did not identify the em dash issue"

        if "external" not in lower or "link" not in lower:
            return False, "audit did not identify the external-link issue"

        return True, "audit reported the expected blockers"

    return prompt, grade


def case_engagers_no_fabrication():
    """Segmenting must work from the people supplied, and only those.

    Graded on two things with a right answer: every supplied engager appears,
    and any roster size the answer states matches what it was given. Inventing a
    person shows up as an inflated count; dropping one shows up directly.

    Not graded: whether the ICP scoring is any good, or whether an attribute was
    embellished. Those need judgement, and a grader that needs judgement drifts.
    """
    engagers = load("apify_engagers.json")
    listed = "\n".join(
        f"- {e.get('name')} | {e.get('subtitle')} | {e.get('type')}" for e in engagers)
    prompt = ("Use the linkedin-engager-analytics skill. Here are the engagers, already "
              "fetched, so do not fetch anything and do not invent any.\n\n" + listed +
              "\n\nMy ICP is B2B SaaS founders. Segment these and give the outbound actions.")

    def grade(output: str):
        real = [str(e["name"]) for e in engagers if e.get("name")]
        dropped = [n for n in real if n not in output]
        if dropped:
            return False, f"silently dropped supplied engagers: {dropped}"
        # Any roster size the answer commits to has to be the size it was handed.
        claimed = {int(n) for n in re.findall(
            r"\b(\d{1,3})\s+(?:engagers?|people|profiles?|total)\b", output, re.I)}
        inflated = sorted(n for n in claimed if n > len(real))
        if inflated:
            return False, f"claims {inflated} engagers, was given {len(real)}"
        return True, f"all {len(real)} supplied used, no inflated roster"

    return prompt, grade


CASES = {
    "reply-parent": ("linkedin-reply-handler: the 2-level flattening rule", case_reply_parent),
    "reply-no-invention": ("linkedin-reply-handler: invents no participants", case_reply_no_invention),
    "hook-formula": ("linkedin-hook-extractor: names a formula that exists", case_hook_formula),
    "humanizer-facts": ("linkedin-humanizer: scrubs markers, keeps figures", case_humanizer_keeps_facts),
    "humanizer-audit": ("linkedin-humanizer: audit flags known blockers", case_humanizer_audit_flags_blockers),
    "engagers-real": ("linkedin-engager-analytics: fabricates nobody", case_engagers_no_fabrication),
}


# ----------------------------------------------------------------- runner ---
def ask_claude(prompt: str, timeout: int) -> tuple[str, str]:
    """Run the agent headless via Claude Code CLI from the repo root."""
    try:
        result = subprocess.run(
            ["claude", "-p", prompt, "--output-format", "text"],
            cwd=ROOT, capture_output=True, encoding="utf-8", timeout=timeout,
        )
    except FileNotFoundError:
        return "", "the `claude` CLI is not on PATH"
    except subprocess.TimeoutExpired:
        return "", f"no answer within {timeout}s"
    if result.returncode != 0:
        err = (result.stderr or result.stdout).strip().splitlines()
        return "", (err[-1] if err else "claude CLI failed")[:90]
    return result.stdout, ""


def resolve_skill_context(prompt: str) -> str:
    """Load the referenced skill documentation to provide context for non-agentic LLM backends."""
    m = re.search(r"Use the (linkedin-[a-z-]+) skill", prompt)
    if not m:
        return ""
    skill_name = m.group(1)
    doc_path = ROOT / "skills" / skill_name / "SKILL.md"
    text = doc_path.read_text(encoding="utf-8") if doc_path.is_file() else ""
    if "hook-formulas" in text or "hook-formulas.md" in prompt or skill_name == "linkedin-hook-extractor":
        hf = ROOT / "references" / "hook-formulas.md"
        if hf.is_file():
            text += "\n\nHook Formulas:\n" + hf.read_text(encoding="utf-8")
    if skill_name == "linkedin-humanizer":
        if "audit" in prompt.lower():
            pa = ROOT / "skills" / "linkedin-humanizer" / "sub-skills" / "post-audit.md"
            if pa.is_file():
                text += "\n\nPost Audit Sub-Skill:\n" + pa.read_text(encoding="utf-8")
            ac = ROOT / "skills" / "linkedin-humanizer" / "references" / "audit-checklist.md"
            if ac.is_file():
                text += "\n\nAudit Checklist:\n" + ac.read_text(encoding="utf-8")
        else:
            sr = ROOT / "skills" / "linkedin-humanizer" / "references" / "scrub-rules.md"
            if sr.is_file():
                text += "\n\nScrub Rules:\n" + sr.read_text(encoding="utf-8")
    return text


def ask_gemini(
    prompt: str,
    timeout: int,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    max_retries: int = 4,
) -> tuple[str, str]:
    """Call Gemini generateContent API via standard library HTTP."""
    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key:
        return "", "GEMINI_API_KEY is not set in environment or .env"
    model_name = model or os.getenv("GEMINI_MODEL") or "gemini-3.7-flash"

    skill_context = resolve_skill_context(prompt)
    system_instruction = (
        "You are an agent executing skills from the linkedin-skills repository. "
        "Strictly adhere to the following skill documentation and rules:\n\n"
        f"{skill_context}"
    ) if skill_context else "You are an AI assistant helping with LinkedIn content."

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {"temperature": 0.0},
    }
    data = json.dumps(payload).encode("utf-8")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"

    last_error = ""
    for attempt in range(max_retries):
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = json.load(resp)
            candidates = body.get("candidates") or []
            if not candidates:
                return "", "Gemini returned no candidates in response"
            parts = candidates[0].get("content", {}).get("parts") or []
            text = "".join(p.get("text", "") for p in parts)
            if not text:
                return "", "Gemini candidate contained no text"
            return text, ""
        except urllib.error.HTTPError as e:
            status = e.code
            try:
                err_json = json.loads(e.read().decode("utf-8", errors="replace"))
                msg = err_json.get("error", {}).get("message") or str(e.reason)
            except Exception:
                msg = str(e.reason)
            last_error = f"Gemini API HTTP {status}: {msg[:80]}"
            if status in (429, 500, 502, 503, 504) and attempt < max_retries - 1:
                time.sleep(8.0 * (attempt + 1))
                continue
            return "", last_error
        except (TimeoutError, subprocess.TimeoutExpired) as e:
            last_error = f"no answer within {timeout}s"
            if attempt < max_retries - 1:
                time.sleep(2.0 * (attempt + 1))
                continue
            return "", last_error
        except urllib.error.URLError as e:
            last_error = f"Gemini connection error: {getattr(e, 'reason', type(e).__name__)}"
            if attempt < max_retries - 1:
                time.sleep(2.0 * (attempt + 1))
                continue
            return "", last_error
        except Exception as e:
            return "", f"Gemini request failed: {type(e).__name__}"

    return "", last_error


def ask(
    prompt: str,
    timeout: int,
    backend: str = "claude",
    model: Optional[str] = None,
) -> tuple[str, str]:
    """Dispatch to the explicitly chosen evaluation backend."""
    if backend == "claude":
        return ask_claude(prompt, timeout)
    elif backend == "gemini":
        return ask_gemini(prompt, timeout, model=model)
    return "", f"unsupported backend: {backend!r}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--case", action="append", help="run only these (repeatable)")
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--timeout", type=int, default=420)
    parser.add_argument(
        "--backend",
        choices=["claude", "gemini"],
        default="claude",
        help="Evaluation backend: 'claude' (default, uses Claude Code CLI) or 'gemini' (uses Gemini API)",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="Specific model name (e.g. gemini-2.5-flash for Gemini)",
    )
    parser.add_argument("--save", type=pathlib.Path, help="write every answer here for reading")
    args = parser.parse_args()

    if args.list:
        for key, (title, _) in CASES.items():
            print(f"  {key:22} {title}")
        return 0

    selected = args.case or list(CASES)
    unknown = [c for c in selected if c not in CASES]
    if unknown:
        print(f"no such case: {unknown}. --list to see them all")
        return 2

    print(f"{BOLD}Skill behaviour [{args.backend}]{OFF}  ({len(selected)} cases, one model call each)\n")
    transcripts, failures, skipped = {}, 0, 0
    for key in selected:
        title, build = CASES[key]
        prompt, grade = build()
        started = time.time()
        output, error = ask(prompt, args.timeout, backend=args.backend, model=args.model)
        transcripts[key] = {"prompt": prompt, "output": output, "error": error}
        if error:
            print(f"  [{YELLOW}skip{OFF}] {title:<52} {error}")
            skipped += 1
            continue
        passed, detail = grade(output)
        mark = f"{GREEN}pass{OFF}" if passed else f"{RED}FAIL{OFF}"
        failures += 0 if passed else 1
        print(f"  [{mark}] {title:<52} {detail} ({time.time() - started:.0f}s)")

    if args.save:
        args.save.write_text(json.dumps(transcripts, indent=1, ensure_ascii=False), encoding="utf-8")
        print(f"\n{GREY}answers written to {args.save}{OFF}")

    passed_count = len(selected) - failures - skipped
    if skipped == len(selected):
        summary = f"All {skipped} case(s) skipped (no model calls completed)"
    elif failures == 0 and skipped == 0:
        summary = "All cases passed"
    else:
        parts = [f"{passed_count} passed"]
        if failures:
            parts.append(f"{failures} failed")
        if skipped:
            parts.append(f"{skipped} skipped")
        summary = ", ".join(parts)
    print(f"\n{BOLD}{summary}{OFF}")
    return failures


if __name__ == "__main__":
    raise SystemExit(main())
