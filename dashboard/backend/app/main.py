"""FastAPI Application entrypoint for LinkedIn Skills Operations Dashboard."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import CORS_ORIGINS
from .database import init_db, recover_stale_tasks
from .routes import approvals, assets, evaluations, executions, skills, system, tasks
from .worker import get_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema migrations
    init_db()
    # Recover any orphaned tasks from previous abnormal shutdown
    recovered = recover_stale_tasks()
    if recovered:
        print(f"[Dashboard DB] Recovered {recovered} stale task(s) on startup.")

    # Start background task worker loop
    worker = get_worker()
    worker_task = asyncio.create_task(worker.start())
    print("[Dashboard Worker] Background execution worker initialized.")

    yield

    # Gracefully stop worker and running subprocesses
    worker.stop()
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
    print("[Dashboard Worker] Background execution worker shut down.")


app = FastAPI(
    title="LinkedIn Skills Operations Dashboard API",
    description="Control center, execution engine, and monitoring dashboard for the linkedin-skills toolkit.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration restricted to local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(system.router, prefix="/api")
app.include_router(skills.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(executions.router, prefix="/api")
app.include_router(approvals.router, prefix="/api")
app.include_router(evaluations.router, prefix="/api")
app.include_router(assets.router, prefix="/api")


@app.get("/")
def root():
    return {
        "service": "LinkedIn Skills Operations Dashboard API",
        "version": "1.0.0",
        "status": "operational",
        "docs_url": "/docs",
    }
