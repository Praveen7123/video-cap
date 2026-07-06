import pytest
from fastapi import HTTPException
from unittest.mock import MagicMock

import deps
from routers.projects import get_project_and_verify_access


class MockCollection:
    def __init__(self, data=None):
        self.data = data or {}

    async def find_one(self, query):
        if "id" in query and len(query) == 1:
            return self.data.get(query["id"])
        if "team_id" in query and "user_id" in query:
            for k, val in self.data.items():
                if val.get("team_id") == query["team_id"] and val.get("user_id") == query["user_id"]:
                    return val
        if "team_id" in query and "email" in query:
            for k, val in self.data.items():
                if val.get("team_id") == query["team_id"] and val.get("email") == query["email"]:
                    return val
        return None


class MockDB:
    def __init__(self, projects=None, team_members=None):
        self.projects = MockCollection(projects)
        self.team_members = MockCollection(team_members)


@pytest.mark.anyio
async def test_owner_can_access():
    projects_data = {
        "p1": {"id": "p1", "user_id": "u1", "team_id": None}
    }
    db = MockDB(projects=projects_data)
    
    # Temporarily mock deps.db
    old_db = deps.db
    deps.db = db
    try:
        user = {"id": "u1", "email": "u1@example.com"}
        proj = await get_project_and_verify_access("p1", user)
        assert proj["id"] == "p1"
    finally:
        deps.db = old_db


@pytest.mark.anyio
async def test_non_owner_access_denied_if_no_team():
    projects_data = {
        "p1": {"id": "p1", "user_id": "u1", "team_id": None}
    }
    db = MockDB(projects=projects_data)
    
    old_db = deps.db
    deps.db = db
    try:
        user = {"id": "u2", "email": "u2@example.com"}
        with pytest.raises(HTTPException) as exc_info:
            await get_project_and_verify_access("p1", user)
        assert exc_info.value.status_code == 403
    finally:
        deps.db = old_db


@pytest.mark.anyio
async def test_team_member_can_access():
    projects_data = {
        "p1": {"id": "p1", "user_id": "u1", "team_id": "t1"}
    }
    members_data = {
        "m1": {"id": "m1", "team_id": "t1", "user_id": "u2", "email": "u2@example.com"}
    }
    db = MockDB(projects=projects_data, team_members=members_data)
    
    old_db = deps.db
    deps.db = db
    try:
        user = {"id": "u2", "email": "u2@example.com"}
        proj = await get_project_and_verify_access("p1", user)
        assert proj["id"] == "p1"
    finally:
        deps.db = old_db


@pytest.mark.anyio
async def test_team_member_by_email_can_access():
    projects_data = {
        "p1": {"id": "p1", "user_id": "u1", "team_id": "t1"}
    }
    members_data = {
        # user_id is None, but email matches
        "m1": {"id": "m1", "team_id": "t1", "user_id": None, "email": "u2@example.com"}
    }
    db = MockDB(projects=projects_data, team_members=members_data)
    
    old_db = deps.db
    deps.db = db
    try:
        user = {"id": "u2", "email": "u2@example.com"}
        proj = await get_project_and_verify_access("p1", user)
        assert proj["id"] == "p1"
    finally:
        deps.db = old_db


@pytest.mark.anyio
async def test_non_team_member_denied():
    projects_data = {
        "p1": {"id": "p1", "user_id": "u1", "team_id": "t1"}
    }
    members_data = {
        "m1": {"id": "m1", "team_id": "t1", "user_id": "u3", "email": "u3@example.com"}
    }
    db = MockDB(projects=projects_data, team_members=members_data)
    
    old_db = deps.db
    deps.db = db
    try:
        user = {"id": "u2", "email": "u2@example.com"}
        with pytest.raises(HTTPException) as exc_info:
            await get_project_and_verify_access("p1", user)
        assert exc_info.value.status_code == 403
    finally:
        deps.db = old_db


@pytest.mark.anyio
async def test_not_found():
    db = MockDB(projects={})
    
    old_db = deps.db
    deps.db = db
    try:
        user = {"id": "u1", "email": "u1@example.com"}
        with pytest.raises(HTTPException) as exc_info:
            await get_project_and_verify_access("p1", user)
        assert exc_info.value.status_code == 404
    finally:
        deps.db = old_db
