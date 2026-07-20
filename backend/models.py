"""Pydantic request/response schemas."""
from pydantic import BaseModel


class DialogueLine(BaseModel):
    speaker: str  # "HOST_A" | "HOST_B"
    text: str


class GenerateResponse(BaseModel):
    id: str
    audio_url: str | None
    audio_available: bool
    transcript: list[DialogueLine]
    topic: str
    source: str  # which engine produced the script: claude | groq | stub
    note: str | None = None  # e.g. why audio is unavailable


class FeedbackRequest(BaseModel):
    user_id: str = "demo"
    concept: str


class HealthResponse(BaseModel):
    status: str
    ffmpeg: bool
    anthropic: bool
    groq: bool
