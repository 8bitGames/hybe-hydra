"""FastAPI dependencies for Compose Engine."""

from .utils.job_queue import JobQueue

# Global job queue instance - set by main.py lifespan
_job_queue: JobQueue = None


def set_job_queue(queue: JobQueue):
    """Set the global job queue instance (called during app startup)."""
    global _job_queue
    _job_queue = queue


def get_job_queue() -> JobQueue:
    """Get the global job queue instance."""
    return _job_queue
