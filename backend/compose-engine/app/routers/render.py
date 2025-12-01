"""Render API router."""

from fastapi import APIRouter, BackgroundTasks, HTTPException
import asyncio

from ..models.render_job import RenderRequest, RenderResponse
from ..models.responses import JobStatus
from ..services.video_renderer import VideoRenderer
from ..utils.job_queue import JobQueue, create_progress_callback
from ..dependencies import get_job_queue


router = APIRouter()


async def process_render_job(request: RenderRequest, job_queue: JobQueue):
    """Background task to process a render job."""
    try:
        # Update status to processing
        await job_queue.update_job(
            request.job_id,
            status=JobStatus.PROCESSING,
            progress=0,
            current_step="Starting render"
        )

        # Create progress callback
        async def progress_callback(job_id: str, progress: int, step: str):
            await job_queue.update_job(
                job_id,
                progress=progress,
                current_step=step
            )

        # Create renderer and process
        renderer = VideoRenderer()
        output_url = await renderer.render(request, progress_callback)

        # Update with completion
        await job_queue.update_job(
            request.job_id,
            status=JobStatus.COMPLETED,
            progress=100,
            current_step="Completed",
            output_url=output_url
        )

    except Exception as e:
        # Update with error
        await job_queue.update_job(
            request.job_id,
            status=JobStatus.FAILED,
            error=str(e)
        )


@router.post("", response_model=RenderResponse)
async def start_render(
    request: RenderRequest,
    background_tasks: BackgroundTasks
):
    """
    Start a video rendering job.
    The job runs in the background and status can be polled via /job/{job_id}/status.
    """
    job_queue = get_job_queue()

    if not job_queue:
        raise HTTPException(status_code=503, detail="Job queue not available")

    # Create job entry
    await job_queue.create_job(request.job_id, request.model_dump())

    # Add background task
    background_tasks.add_task(process_render_job, request, job_queue)

    return RenderResponse(
        status="accepted",
        job_id=request.job_id,
        message="Render job queued successfully"
    )


@router.post("/sync", response_model=dict)
async def render_sync(request: RenderRequest):
    """
    Synchronous rendering (for testing).
    Blocks until render is complete.
    """
    job_queue = get_job_queue()

    if job_queue:
        await job_queue.create_job(request.job_id, request.model_dump())

    renderer = VideoRenderer()

    async def progress_callback(job_id: str, progress: int, step: str):
        if job_queue:
            await job_queue.update_job(job_id, progress=progress, current_step=step)
        print(f"[{progress}%] {step}")

    try:
        output_url = await renderer.render(request, progress_callback)
        return {
            "status": "completed",
            "job_id": request.job_id,
            "output_url": output_url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
