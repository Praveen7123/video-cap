"""Unit tests for the plan/quality gating single source of truth."""
import pytest
from fastapi import HTTPException

from services.plan_service import get_plan, check_quality_allowed, check_translation_allowed


class TestGetPlan:
    def test_known_plan_returns_its_config(self):
        plan = get_plan({"plan": "creator"})
        assert plan["qualities"] == ["1080p", "4k"]

    def test_missing_plan_field_defaults_to_free(self):
        plan = get_plan({})
        assert plan == get_plan({"plan": "free"})

    def test_unknown_plan_value_falls_back_to_free(self):
        plan = get_plan({"plan": "nonexistent"})
        assert plan == get_plan({"plan": "free"})


class TestCheckQualityAllowed:
    def test_allowed_quality_does_not_raise(self):
        check_quality_allowed({"plan": "free"}, "1080p")  # should not raise

    def test_disallowed_quality_raises_400(self):
        with pytest.raises(HTTPException) as exc_info:
            check_quality_allowed({"plan": "free"}, "4k")
        assert exc_info.value.status_code == 400

    def test_studio_plan_allows_alpha(self):
        check_quality_allowed({"plan": "studio"}, "alpha")  # should not raise

    def test_error_message_names_the_plan(self):
        with pytest.raises(HTTPException) as exc_info:
            check_quality_allowed({"plan": "editor"}, "4k")
        assert "editor" in exc_info.value.detail


class TestCheckTranslationAllowed:
    def test_free_plan_has_no_translation_budget(self):
        with pytest.raises(HTTPException) as exc_info:
            check_translation_allowed({"plan": "free"}, 60)
        assert exc_info.value.status_code == 400

    def test_creator_plan_allows_translation_within_budget(self):
        check_translation_allowed({"plan": "creator", "translation_seconds_used": 0}, 120)  # should not raise

    def test_exceeding_remaining_budget_raises(self):
        # creator plan = 120 minutes = 7200s; already used 7150s, requesting 60s more
        with pytest.raises(HTTPException) as exc_info:
            check_translation_allowed({"plan": "creator", "translation_seconds_used": 7150}, 60)
        assert exc_info.value.status_code == 400

    def test_missing_usage_field_defaults_to_zero_used(self):
        check_translation_allowed({"plan": "studio"}, 300)  # should not raise
