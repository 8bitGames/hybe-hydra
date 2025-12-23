"""FastAPI application entry point for Compose Engine."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import logging
import sys

from .config import get_settings
from .utils.job_queue import JobQueue
from .dependencies import set_job_queue, init_render_semaphore

# Configure logging to output to stdout
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Set log level for our app modules
logging.getLogger('app').setLevel(logging.INFO)
logging.getLogger('app.services').setLevel(logging.INFO)
logging.getLogger('app.services.video_renderer').setLevel(logging.INFO)
logging.getLogger('app.services.audio_analyzer').setLevel(logging.INFO)

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    # Create temp directory
    os.makedirs(settings.temp_dir, exist_ok=True)

    # Initialize job queue
    job_queue = JobQueue(settings.redis_url)
    await job_queue.connect()
    set_job_queue(job_queue)

    # Initialize render semaphore for concurrent job control
    init_render_semaphore(settings.max_concurrent_jobs)
    logger.info(f"Render concurrency: max {settings.max_concurrent_jobs} parallel jobs")

    yield

    # Shutdown
    await job_queue.disconnect()


# Import routers after dependencies are set up to avoid circular imports
from .routers import render, images, audio, jobs, auto_compose, effects, ai, publishing, video_edit


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="MoviePy-based video composition engine for HYDRA",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(render.router, prefix="/render", tags=["render"])
app.include_router(images.router, prefix="/images", tags=["images"])
app.include_router(audio.router, prefix="/audio", tags=["audio"])
app.include_router(jobs.router, prefix="/job", tags=["jobs"])
app.include_router(auto_compose.router, prefix="/api/v1/compose", tags=["auto-compose"])
app.include_router(effects.router, prefix="/api/v1/effects", tags=["effects"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
app.include_router(publishing.router, prefix="/api/v1/publish", tags=["publishing"])
app.include_router(video_edit.router, prefix="/api/v1/video", tags=["video-edit"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    from .dependencies import get_job_queue
    job_queue = get_job_queue()
    return {
        "status": "healthy",
        "service": settings.app_name,
        "redis": "connected" if job_queue and job_queue.is_connected else "fallback (in-memory)"
    }
