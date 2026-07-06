import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
import jwt

import deps
from auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies, get_current_user,
    get_jwt_secret, JWT_ALGORITHM,
)
from schemas.serializers import user_public

router = APIRouter(prefix="/auth")


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


@router.post("/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    if await deps.db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "name": payload.name or email.split("@")[0],
        "password_hash": hash_password(payload.password),
        "plan": "free",
        "credit_seconds_used": 0,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await deps.db.users.insert_one(doc)
    
    # Link any pending team memberships to this user
    try:
        cursor_inv = deps.db.team_members.find({"email": email})
        async for tm in cursor_inv:
            if tm.get("user_id") is None:
                await deps.db.team_members.update_one({"id": tm["id"]}, {"$set": {"user_id": user_id}})
    except Exception:
        pass
        
    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    return user_public(doc)



@router.post("/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await deps.db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return user_public(user)


@router.post("/refresh")
async def refresh_token(request: Request, response: Response):
    """Silently mint a new access token from the long-lived refresh token,
    so a session doesn't die after the 60-minute access token expires."""
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    user = await deps.db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(user["id"], user["email"])
    new_refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, new_refresh)
    return user_public(user)


@router.post("/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"success": True}


@router.get("/me")
async def me(request: Request):
    user = await get_current_user(request, deps.db)
    return user_public(user)
