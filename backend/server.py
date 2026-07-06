from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import uuid
import logging

from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
import os

import deps
from routers import auth, account, billing, projects, teams

app = FastAPI(title="ClipCut API")
api = APIRouter(prefix="/api")


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
log = logging.getLogger("clipcut")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Any exception a route didn't catch itself lands here instead of
    FastAPI's raw default. Same {"detail": ...} shape as HTTPException, so
    the frontend never has to special-case "did this fail on purpose or
    crash" — plus a request id so a user-reported error can be matched to
    the exact backend log line that caused it."""
    request_id = uuid.uuid4().hex[:8]
    log.exception(f"[{request_id}] Unhandled error on {request.method} {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong. Please try again.", "request_id": request_id},
    )


@app.get("/health")
async def health():
    """For uptime monitors / the hosting platform's own health checks — not a
    keep-alive endpoint to defeat a free-tier sleep timer. Confirms the app is
    actually serving requests and the DB is reachable, not just that the
    process is running."""
    try:
        await deps.db.users.find_one({})
        db_ok = True
    except Exception:
        db_ok = False
    return JSONResponse(
        status_code=200 if db_ok else 503,
        content={"status": "ok" if db_ok else "degraded", "db": db_ok},
    )


api.include_router(auth.router)
api.include_router(account.router)
api.include_router(billing.router)
api.include_router(projects.router)
api.include_router(teams.router)
app.include_router(api)


app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await deps.init_db()


@app.on_event("shutdown")
async def shutdown():
    deps.close_db()
