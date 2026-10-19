"""Offline regression tests for evaluation cases and grader contracts.

Verifies that:
- Every eval case defined in evals/run_evals.py builds cleanly.
- Each case prompt mentions the target skill.
- Each grader function deterministically identifies valid agent outputs and
  flags failures (e.g. wrong parent comment, invented participants, AI markers,
  dropped figures, or hallucinated engager counts).

Offline: no network, no LLM calls, deterministic fixtures only.
"""
from __future__ import annotations

import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from evals.run_evals import CASES


class EvalGradersTest(unittest.TestCase):
    def test_all_cases_build_cleanly(self):
        """Every registered case must return a non-empty prompt and a callable grader."""
        self.assertGreaterEqual(len(CASES), 6)
        for key, (title, builder) in CASES.items():
            with self.subTest(case=key):
                prompt, grade = builder()
                self.assertIsInstance(prompt, str)
                self.assertTrue(prompt.strip())
                self.assertTrue(callable(grade))

    def test_reply_parent_grader(self):
        _, grade = CASES["reply-parent"][1]()

        # Passing: references top-level comment id 7321583293986988033
        good_output = "parentComment: urn:li:comment:(activity:7320867199693246465,7321583293986988033)"
        passed, msg = grade(good_output)
        self.assertTrue(passed, msg)

        # Failing: no digits in URN
        bad_urn = "parentComment: urn:li:comment:(activity:POST,COMMENT)"
        passed, msg = grade(bad_urn)
        self.assertFalse(passed)
        self.assertIn("no parentComment urn with real ids stated", msg)

        # Failing: references reply's own id 7322827359106060292 instead of top
        wrong_id = "parentComment: urn:li:comment:(activity:7320867199693246465,7322827359106060292)"
        passed, msg = grade(wrong_id)
        self.assertFalse(passed)
        self.assertIn("targets the reply's own id", msg)

    def test_reply_no_invention_grader(self):
        _, grade = CASES["reply-no-invention"][1]()

        good_output = "Thanks Jim, totally agree with your point about Copilot acting like a coworker."
        passed, msg = grade(good_output)
        self.assertTrue(passed, msg)

        # Failing: invented participant
        invented = "As Satya Nadella mentioned, this is a game changer."
        passed, msg = grade(invented)
        self.assertFalse(passed)
        self.assertIn("puts words on people not in the thread", msg)

        # Failing: external link
        stray_link = "Check our tool at https://example.com/tool for more details."
        passed, msg = grade(stray_link)
        self.assertFalse(passed)
        self.assertIn("carries an outside link nobody asked for", msg)

    def test_hook_formula_grader(self):
        _, grade = CASES["hook-formula"][1]()

        good_output = "Formula: F1 (Contrast / Flip)\nHook line: I deleted our $40k/yr analytics stack on a Tuesday."
        passed, msg = grade(good_output)
        self.assertTrue(passed, msg)

        # Failing: no formula
        no_formula = "This is a contrarian hook where I deleted our $40k/yr analytics stack."
        passed, msg = grade(no_formula)
        self.assertFalse(passed)
        self.assertIn("named no formula at all", msg)

        # Failing: non-existent formula
        unknown_formula = "Formula: F99 (Imaginary)\nHook line: I deleted our $40k/yr analytics stack."
        passed, msg = grade(unknown_formula)
        self.assertFalse(passed)
        self.assertIn("cited formulas that do not exist", msg)

        # Failing: missing hook quote
        missing_quote = "Formula: F1 (Contrast / Flip)\nGreat post about infrastructure."
        passed, msg = grade(missing_quote)
        self.assertFalse(passed)
        self.assertIn("did not quote the hook line", msg)

    def test_humanizer_keeps_facts_grader(self):
        _, grade = CASES["humanizer-facts"][1]()

        good_output = (
            "We cut deploy time from 47 minutes to 6. "
            "Support tickets fell 31% in Q3. Here is what we learned."
        )
        passed, msg = grade(good_output)
        self.assertTrue(passed, msg)

        # Failing: dropped a fact (Q3)
        dropped_fact = (
            "We cut deploy time from 47 minutes to 6. "
            "Support tickets fell 31% recently."
        )
        passed, msg = grade(dropped_fact)
        self.assertFalse(passed)
        self.assertIn("dropped the user's own figures", msg)

        # Failing: retains AI markers
        kept_markers = (
            "We leveraged a framework to cut deploy time from 47 minutes to 6, "
            "and support tickets fell 31% in Q3."
        )
        passed, msg = grade(kept_markers)
        self.assertFalse(passed)
        self.assertIn("left AI markers in place", msg)

    def test_humanizer_audit_flags_blockers_grader(self):
        _, grade = CASES["humanizer-audit"][1]()

        good_audit = (
            "Status: FAIL\n"
            "- BLOCKER: Excessive em dash usage detected.\n"
            "- BLOCKER: External link in post body."
        )
        passed, msg = grade(good_audit)
        self.assertTrue(passed, msg)

        # Failing: no FAIL
        no_fail = "Status: PASS\nAll good."
        passed, msg = grade(no_fail)
        self.assertFalse(passed)
        self.assertIn("did not produce a failing result", msg)

        # Failing: missing blocker
        no_blocker = "Status: FAIL\nWarnings found with em dash and external link."
        passed, msg = grade(no_blocker)
        self.assertFalse(passed)
        self.assertIn("did not report blockers", msg)

        # Failing: missing em dash identification
        no_em_dash = "Status: FAIL\n- BLOCKER: External link found."
        passed, msg = grade(no_em_dash)
        self.assertFalse(passed)
        self.assertIn("did not identify the em dash issue", msg)

        # Failing: missing link identification
        no_link = "Status: FAIL\n- BLOCKER: Overused em dash found."
        passed, msg = grade(no_link)
        self.assertFalse(passed)
        self.assertIn("did not identify the external-link issue", msg)

    def test_engagers_no_fabrication_grader(self):
        _, grade = CASES["engagers-real"][1]()

        good_output = (
            "Identified 3 engagers from the post:\n"
            "- Brigham Wimmer (Senior Technology Advisor)\n"
            "- Matteo DeCaire (Co-Founder)\n"
            "- Aradhya Srivastava (UX Design Student)\n"
            "Segmenting for B2B SaaS..."
        )
        passed, msg = grade(good_output)
        self.assertTrue(passed, msg)

        # Failing: dropped an engager
        dropped = (
            "Found 2 engagers:\n"
            "- Brigham Wimmer\n"
            "- Matteo DeCaire\n"
        )
        passed, msg = grade(dropped)
        self.assertFalse(passed)
        self.assertIn("silently dropped supplied engagers", msg)

        # Failing: inflated claimed roster count
        inflated = (
            "Analyzed 10 engagers from the post:\n"
            "- Brigham Wimmer\n"
            "- Matteo DeCaire\n"
            "- Aradhya Srivastava\n"
        )
        passed, msg = grade(inflated)
        self.assertFalse(passed)
        self.assertIn("claims [10] engagers, was given 3", msg)


if __name__ == "__main__":
    unittest.main()
