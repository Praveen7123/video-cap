import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr

import deps
from auth import get_current_user
from schemas.serializers import team_public, team_member_public

router = APIRouter(prefix="/teams")


class TeamIn(BaseModel):
    name: str


class InviteIn(BaseModel):
    email: EmailStr


@router.post("")
async def create_team(payload: TeamIn, request: Request):
    user = await get_current_user(request, deps.db)
    team_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # 1. Insert team
    team_doc = {
        "id": team_id,
        "name": payload.name,
        "seats": 1,
        "created_at": now
    }
    await deps.db.teams.insert_one(team_doc)
    
    # 2. Add creator as first member
    member_doc = {
        "id": str(uuid.uuid4()),
        "team_id": team_id,
        "email": user["email"].lower().strip(),
        "user_id": user["id"],
        "created_at": now
    }
    await deps.db.team_members.insert_one(member_doc)
    
    # 3. Populate response
    resp = team_public(team_doc)
    resp["members"] = [team_member_public(member_doc)]
    resp["members"][0]["name"] = user.get("name") or user["email"].split("@")[0]
    return resp


@router.get("")
async def list_teams(request: Request):
    user = await get_current_user(request, deps.db)
    
    # Get all memberships for user
    email = user["email"].lower().strip()
    # Query by user_id OR email (since they might have registered later, we search both to be sure)
    memberships = []
    
    # Collect all memberships matching user_id
    cursor = deps.db.team_members.find({"user_id": user["id"]})
    async for m in cursor:
        memberships.append(m)
        
    # Also collect memberships matching email where user_id is not set
    cursor_email = deps.db.team_members.find({"email": email})
    async for m in cursor_email:
        if m["user_id"] != user["id"]:
            memberships.append(m)

    team_ids = list(set(m["team_id"] for m in memberships))
    teams_list = []
    
    for t_id in team_ids:
        t = await deps.db.teams.find_one({"id": t_id})
        if t:
            team_res = team_public(t)
            
            # Fetch all members of this team
            m_list = []
            m_cursor = deps.db.team_members.find({"team_id": t_id})
            async for member in m_cursor:
                m_pub = team_member_public(member)
                if member.get("user_id"):
                    u = await deps.db.users.find_one({"id": member["user_id"]})
                    m_pub["name"] = u.get("name") if u else member["email"].split("@")[0]
                else:
                    m_pub["name"] = "Pending"
                m_list.append(m_pub)
                
            team_res["members"] = m_list
            teams_list.append(team_res)
            
    return teams_list


@router.get("/{team_id}")
async def get_team(team_id: str, request: Request):
    user = await get_current_user(request, deps.db)
    
    # Verify current user is a member
    member = await deps.db.team_members.find_one({"team_id": team_id, "user_id": user["id"]})
    if not member:
        # Fallback to email check
        member = await deps.db.team_members.find_one({"team_id": team_id, "email": user["email"].lower().strip()})
        if not member:
            raise HTTPException(403, "Access denied")
            
    t = await deps.db.teams.find_one({"id": team_id})
    if not t:
        raise HTTPException(404, "Team not found")
        
    team_res = team_public(t)
    
    # Fetch all members
    m_list = []
    m_cursor = deps.db.team_members.find({"team_id": team_id})
    async for m in m_cursor:
        m_pub = team_member_public(m)
        if m.get("user_id"):
            u = await deps.db.users.find_one({"id": m["user_id"]})
            m_pub["name"] = u.get("name") if u else m["email"].split("@")[0]
        else:
            m_pub["name"] = "Pending"
        m_list.append(m_pub)
        
    team_res["members"] = m_list
    return team_res


@router.post("/{team_id}/invite")
async def invite_member(team_id: str, payload: InviteIn, request: Request):
    user = await get_current_user(request, deps.db)
    
    # Verify current user is a member of the team
    team_member = await deps.db.team_members.find_one({"team_id": team_id, "user_id": user["id"]})
    if not team_member:
        team_member = await deps.db.team_members.find_one({"team_id": team_id, "email": user["email"].lower().strip()})
        if not team_member:
            raise HTTPException(403, "Access denied")
            
    email_clean = payload.email.lower().strip()
    
    # Verify if already in team
    existing = await deps.db.team_members.find_one({"team_id": team_id, "email": email_clean})
    if existing:
        raise HTTPException(400, "User already in team")
        
    # Check if user is registered in other parts
    invited_user = await deps.db.users.find_one({"email": email_clean})
    invited_user_id = invited_user["id"] if invited_user else None
    
    now = datetime.now(timezone.utc).isoformat()
    new_member = {
        "id": str(uuid.uuid4()),
        "team_id": team_id,
        "email": email_clean,
        "user_id": invited_user_id,
        "created_at": now
    }
    await deps.db.team_members.insert_one(new_member)
    
    res = team_member_public(new_member)
    res["name"] = invited_user.get("name") if invited_user else "Pending"
    return res


@router.delete("/{team_id}/members/{email}")
async def remove_member(team_id: str, email: str, request: Request):
    user = await get_current_user(request, deps.db)
    
    # Verify current user is a member of the team
    team_member = await deps.db.team_members.find_one({"team_id": team_id, "user_id": user["id"]})
    if not team_member:
        team_member = await deps.db.team_members.find_one({"team_id": team_id, "email": user["email"].lower().strip()})
        if not team_member:
            raise HTTPException(403, "Access denied")
            
    email_clean = email.lower().strip()
    
    # Find the membership to delete
    to_delete = await deps.db.team_members.find_one({"team_id": team_id, "email": email_clean})
    if not to_delete:
        raise HTTPException(404, "Member not found in team")
        
    await deps.db.team_members.delete_one({"id": to_delete["id"]})
    return {"success": True}


@router.delete("/{team_id}")
async def delete_team(team_id: str, request: Request):
    user = await get_current_user(request, deps.db)
    
    # Verify current user is a member of the team
    team_member = await deps.db.team_members.find_one({"team_id": team_id, "user_id": user["id"]})
    if not team_member:
        team_member = await deps.db.team_members.find_one({"team_id": team_id, "email": user["email"].lower().strip()})
        if not team_member:
            raise HTTPException(403, "Access denied")
            
    # Delete team
    await deps.db.teams.delete_one({"id": team_id})
    
    # Delete all members
    member_ids = []
    cursor = deps.db.team_members.find({"team_id": team_id})
    async for m in cursor:
        member_ids.append(m["id"])
    for m_id in member_ids:
        await deps.db.team_members.delete_one({"id": m_id})
        
    # Nullify project team associations
    project_ids = []
    cursor_proj = deps.db.projects.find({"team_id": team_id})
    async for p in cursor_proj:
        project_ids.append(p["id"])
    for p_id in project_ids:
        await deps.db.projects.update_one({"id": p_id}, {"$set": {"team_id": None}})
        
    return {"success": True}
