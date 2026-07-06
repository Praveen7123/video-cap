"""ClipCut backend API tests - covers auth, plans, projects (upload+pipeline), billing."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"
TEST_VIDEO = "/tmp/test_video.mp4"

ADMIN_EMAIL = "admin@clipcut.app"
ADMIN_PASSWORD = "Admin@12345"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["email"] == ADMIN_EMAIL
    assert data["role"] == "admin"
    return s


@pytest.fixture(scope="module")
def new_user_session():
    s = requests.Session()
    email = f"test_user_{uuid.uuid4().hex[:8]}@clipcut.app"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Passw0rd!", "name": "Tester"})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["email"] == email
    assert data["plan"] == "free"
    return s, email


# --- auth ---
class TestAuth:
    def test_login_admin(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register_duplicate(self, new_user_session):
        s, email = new_user_session
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Passw0rd!"})
        assert r.status_code == 400

    def test_logout(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        r2 = s.post(f"{API}/auth/logout")
        assert r2.status_code == 200
        r3 = s.get(f"{API}/auth/me")
        assert r3.status_code == 401


# --- plans ---
class TestPlans:
    def test_get_plans(self):
        r = requests.get(f"{API}/plans")
        assert r.status_code == 200
        data = r.json()
        for k in ("free", "editor", "creator", "studio"):
            assert k in data
        assert data["free"]["qualities"] == ["1080p"]
        assert "4k" in data["creator"]["qualities"]


# --- projects ---
class TestProjects:
    def test_list_empty_or_ok(self, new_user_session):
        s, _ = new_user_session
        r = s.get(f"{API}/projects")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_upload_requires_auth(self):
        assert os.path.exists(TEST_VIDEO), "test video missing"
        with open(TEST_VIDEO, "rb") as f:
            r = requests.post(f"{API}/projects/upload", files={"file": ("t.mp4", f, "video/mp4")}, data={"name": "x"})
        assert r.status_code == 401

    def test_free_plan_rejects_4k(self, new_user_session):
        s, _ = new_user_session
        with open(TEST_VIDEO, "rb") as f:
            r = s.post(
                f"{API}/projects/upload",
                files={"file": ("t.mp4", f, "video/mp4")},
                data={"name": "TEST_reject", "quality": "4k"},
            )
        assert r.status_code == 400

    def test_full_upload_and_render_pipeline(self, admin_session):
        assert os.path.exists(TEST_VIDEO)
        with open(TEST_VIDEO, "rb") as f:
            r = admin_session.post(
                f"{API}/projects/upload",
                files={"file": ("test_video.mp4", f, "video/mp4")},
                data={
                    "name": "TEST_e2e",
                    "subtitle_style": "bold-pop",
                    "accent_color": "#E8622C",
                    "font": "DejaVu Sans",
                    "quality": "1080p",
                },
            )
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        assert r.json()["status"] == "queued"

        # poll for completion (up to 90s)
        deadline = time.time() + 90
        last_status = None
        while time.time() < deadline:
            rr = admin_session.get(f"{API}/projects/{pid}")
            assert rr.status_code == 200
            proj = rr.json()
            last_status = proj["status"]
            if last_status in ("done", "failed"):
                break
            time.sleep(2)
        assert last_status == "done", f"pipeline did not complete: last_status={last_status}"

        # download
        d = admin_session.get(f"{API}/projects/{pid}/download")
        assert d.status_code == 200
        assert d.headers.get("content-type", "").startswith("video/")
        assert len(d.content) > 1000

        # video stream
        v = admin_session.get(f"{API}/projects/{pid}/video")
        assert v.status_code == 200

        # in list
        lst = admin_session.get(f"{API}/projects").json()
        assert any(p["id"] == pid for p in lst)


# --- billing ---
class TestBilling:
    def test_upgrade_plan(self, new_user_session):
        s, _ = new_user_session
        r = s.post(f"{API}/billing/upgrade", json={"plan": "creator"})
        assert r.status_code == 200
        assert r.json()["plan"] == "creator"
        me = s.get(f"{API}/auth/me").json()
        assert me["plan"] == "creator"

    def test_upgrade_invalid(self, admin_session):
        r = admin_session.post(f"{API}/billing/upgrade", json={"plan": "diamond"})
        assert r.status_code == 400
