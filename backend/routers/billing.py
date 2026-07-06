from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

import deps
from auth import get_current_user
from schemas.serializers import user_public
from config import PLANS

router = APIRouter()


@router.get("/plans")
async def get_plans():
    return PLANS


class UpgradeIn(BaseModel):
    plan: str


@router.post("/billing/upgrade")
async def upgrade(payload: UpgradeIn, request: Request):
    user = await get_current_user(request, deps.db)
    if payload.plan not in PLANS:
        raise HTTPException(400, "Invalid plan")
    await deps.db.users.update_one({"id": user["id"]}, {"$set": {"plan": payload.plan}})
    updated = await deps.db.users.find_one({"id": user["id"]})
    return user_public(updated)


class UpdateSeatsIn(BaseModel):
    team_id: str
    seats: int


@router.post("/billing/seats")
async def update_seats(payload: UpdateSeatsIn, request: Request):
    user = await get_current_user(request, deps.db)
    team = await deps.db.teams.find_one({"id": payload.team_id})
    if not team:
        raise HTTPException(404, "Team not found")
    member = await deps.db.team_members.find_one({"team_id": payload.team_id, "user_id": user["id"]})
    if not member:
        member = await deps.db.team_members.find_one({"team_id": payload.team_id, "email": user["email"].lower().strip()})
        if not member:
            raise HTTPException(403, "Not a member of the team")
    if payload.seats < 1:
        raise HTTPException(400, "Must have at least 1 seat")
        
    await deps.db.teams.update_one({"id": payload.team_id}, {"$set": {"seats": payload.seats}})
    
    price_per_seat = 400
    total = price_per_seat * payload.seats
    return {
        "team_id": payload.team_id,
        "seats": payload.seats,
        "price_per_seat": price_per_seat,
        "total_price": total,
        "currency": "INR",
        "mocked": True
    }

