"""Unit tests for the storage-quota pure helpers."""
from services.storage_service import get_plan_storage_bytes, _object_size


class TestGetPlanStorageBytes:
    def test_free_plan_is_5gb(self):
        assert get_plan_storage_bytes({"plan": "free"}) == 5 * 1024 ** 3

    def test_studio_plan_is_150gb(self):
        assert get_plan_storage_bytes({"plan": "studio"}) == 150 * 1024 ** 3

    def test_missing_plan_defaults_to_free(self):
        assert get_plan_storage_bytes({}) == get_plan_storage_bytes({"plan": "free"})

    def test_unknown_plan_falls_back_to_free(self):
        assert get_plan_storage_bytes({"plan": "nonexistent"}) == get_plan_storage_bytes({"plan": "free"})


class TestObjectSize:
    def test_reads_size_from_metadata(self):
        assert _object_size({"metadata": {"size": 12345}}) == 12345

    def test_missing_metadata_is_zero(self):
        assert _object_size({}) == 0

    def test_missing_size_key_is_zero(self):
        assert _object_size({"metadata": {}}) == 0
