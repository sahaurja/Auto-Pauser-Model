"""FastAPI backend that fronts the pause-detection model for the Cadence
frontend. This file only adapts I/O (HTTP <-> the model's Python interface);
it never reimplements or edits model/smriti_combined_model.py.
"""

import json
import logging
import ssl
import sys
import threading
import traceback
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import date
from pathlib import Path
from typing import Literal, Optional

import certifi
from dotenv import load_dotenv

load_dotenv()  # backend/.env — separate from the model's and frontend's env files

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# model/ is a plain folder, not an installable package, and must not be
# edited — so we add it to sys.path and import find_pause_points directly
# rather than turning it into a dependency of this service.
MODEL_DIR = Path(__file__).resolve().parent.parent / "model"
sys.path.insert(0, str(MODEL_DIR))

from combined_model_final import find_pause_points  # noqa: E402


logger = logging.getLogger("cadence.backend")

# Some Python installs (notably python.org's macOS builds) ship without a
# populated system CA bundle, which makes every urllib HTTPS request fail
# SSL verification regardless of network conditions. Using certifi's bundle
# explicitly avoids depending on that system config being right.
_SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())

app = FastAPI(title="Cadence backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local dev convenience; tighten before deploying
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessRequest(BaseModel):
    youtubeUrl: str
    generateQuestions: bool = True


class ProcessResponse(BaseModel):
    jobId: str


JobStatus = Literal["processing", "done", "error"]


class Job:
    def __init__(self) -> None:
        self.status: JobStatus = "processing"
        self.error: Optional[str] = None
        self.result: Optional[dict] = None


# Simple in-memory job store. Fine for a single-process dev/demo backend;
# would need to move to a real queue/db to survive restarts or scale out.
jobs: dict[str, Job] = {}


def _fetch_video_title(video_id: str) -> str:
    """Video title via YouTube's public oEmbed endpoint (no API key
    required). Falls back to a generic title if it's unreachable, but logs
    a warning whenever that happens so a fetch failure doesn't silently
    masquerade as the real title."""
    oembed_url = "https://www.youtube.com/oembed?" + urllib.parse.urlencode(
        {"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"}
    )
    try:
        with urllib.request.urlopen(oembed_url, timeout=5, context=_SSL_CONTEXT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        title = data.get("title")
        if title:
            return title
        logger.warning(
            "oEmbed response for video %s had no title; using fallback", video_id
        )
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
        logger.warning(
            "Failed to fetch title for video %s via oEmbed (%s); using fallback",
            video_id,
            exc,
        )
    return f"Processed video ({video_id})"


def _to_frontend_shape(raw: dict, youtube_url: str) -> dict:
    """Convert find_pause_points()'s return shape into the shape the
    frontend's mock data (and thus its components) already expect."""
    pause_points = []
    for p in raw["pause_points"]:
        point = {
            "timestamp": p["time"],
            "hasQuestion": p.get("question") is not None,
        }
        q = p.get("question")
        if q is not None:
            point["question"] = {
                "prompt": q["question"],
                "choices": q["choices"],
                "correctIndex": q["correct_index"],
                "explanation": q["explanation"],
            }
        pause_points.append(point)

    pause_points.sort(key=lambda p: p["timestamp"])

    video_id = raw["video_id"]
    return {
        "videoId": video_id,
        "youtubeUrl": youtube_url,
        "title": _fetch_video_title(video_id),
        "thumbnailUrl": f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
        "processedDate": date.today().isoformat(),
        "pausePoints": pause_points,
    }


def _run_job(job_id: str, youtube_url: str, generate_questions: bool) -> None:
    job = jobs[job_id]
    try:
        # keep_video=False: find_pause_points() defaults to keeping the
        # downloaded .mp4 on disk, which would otherwise pile up in this
        # process's cwd on every job. The video is only needed transiently
        # for frame/audio analysis, so delete it once that's done.
        raw = find_pause_points(
            youtube_url, generate_questions=generate_questions, keep_video=False
        )
        job.result = _to_frontend_shape(raw, youtube_url)
        job.status = "done"
    except Exception as exc:  # noqa: BLE001 - surface any failure to the client
        traceback.print_exc()
        job.status = "error"
        job.error = str(exc)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/process", response_model=ProcessResponse)
def process(req: ProcessRequest) -> ProcessResponse:
    if not req.youtubeUrl.strip():
        raise HTTPException(status_code=400, detail="youtubeUrl is required")

    job_id = uuid.uuid4().hex
    jobs[job_id] = Job()

    thread = threading.Thread(
        target=_run_job,
        args=(job_id, req.youtubeUrl, req.generateQuestions),
        daemon=True,
    )
    thread.start()

    return ProcessResponse(jobId=job_id)


@app.get("/process/{job_id}/status")
def get_status(job_id: str) -> dict:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown jobId")
    return {"status": job.status, "error": job.error}


@app.get("/process/{job_id}/result")
def get_result(job_id: str) -> dict:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown jobId")
    if job.status != "done":
        raise HTTPException(
            status_code=409, detail=f"Job is not done yet (status={job.status})"
        )
    return job.result
