"""Script generation: RAG context -> strict JSON two-host dialogue.

Order of attempts: Claude (primary) -> Groq Llama-3 (fallback) -> local stub.
The stub lets the whole pipeline + UI run with zero API keys.
"""
from __future__ import annotations

import json
import re

import config
from pipeline.retrieve import RetrievedContext

SYSTEM_PROMPT = """You are the scriptwriter for "Nous," a 10-minute micro-learning podcast.
Your task is to convert academic text into a fast-paced, conversational dialogue between two hosts.

HOST_A: The Expert. Direct, clear, and leads the explanation.
HOST_B: The Learner. Asks questions, summarizes concepts into simple analogies.

RULES FOR WRITING:
1. NO Markdown, NO asterisks, NO parentheses in the text. The TTS engine will read them out loud and ruin the audio.
2. Write numbers as words (e.g., write "five hundred" not "500").
3. Address the previous user confusion in the first four lines of dialogue.
4. HOST_B must interrupt HOST_A at least once to clarify a complex point.
5. Keep sentences short. Long sentences cause TTS engines to sound robotic.
6. Phonetic Fillers. To make the hosts sound human, deliberately spell out conversational fillers. Use words like "Umm," "Right," "Exactly," and "Wait." End trailing thoughts with commas, not periods, to force the TTS engine to pause naturally.

OUTPUT SCHEMA:
You must output ONLY a raw JSON array. Do not wrap it in code blocks. Do not add introductory text.

[
  { "speaker": "HOST_A", "text": "Welcome back. Today we are breaking down..." },
  { "speaker": "HOST_B", "text": "Before we start, yesterday you mentioned..." }
]"""


def _user_prompt(ctx: RetrievedContext) -> str:
    return (
        f"- Target Topic: {ctx.topic}\n"
        f"- Source Material: {ctx.joined_chunks}\n"
        f"- Previous User Confusion: {ctx.joined_confusion}\n\n"
        "Write the full episode now as a raw JSON array."
    )


# --- JSON extraction / validation ---------------------------------------
def _parse_script(raw: str) -> list[dict]:
    raw = raw.strip()
    # Strip accidental code fences.
    raw = re.sub(r"^```(?:json)?", "", raw).strip()
    raw = re.sub(r"```$", "", raw).strip()
    # Grab the outermost array if the model added stray text.
    start, end = raw.find("["), raw.rfind("]")
    if start != -1 and end != -1:
        raw = raw[start : end + 1]
    data = json.loads(raw)
    if not isinstance(data, list):
        raise ValueError("Script is not a JSON array")
    cleaned = []
    for line in data:
        speaker = str(line.get("speaker", "")).upper().strip()
        text = str(line.get("text", "")).strip()
        if speaker not in ("HOST_A", "HOST_B") or not text:
            continue
        cleaned.append({"speaker": speaker, "text": text})
    if not cleaned:
        raise ValueError("No valid dialogue lines")
    return cleaned


# --- Engines -------------------------------------------------------------
def _try_claude(ctx: RetrievedContext) -> list[dict]:
    from anthropic import Anthropic

    client = Anthropic(api_key=config.ANTHROPIC_API_KEY)
    for model in (config.CLAUDE_MODEL, config.CLAUDE_FALLBACK_MODEL):
        try:
            msg = client.messages.create(
                model=model,
                max_tokens=4000,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": _user_prompt(ctx)}],
            )
            text = "".join(
                block.text for block in msg.content if getattr(block, "type", "") == "text"
            )
            return _parse_script(text)
        except Exception:
            continue
    raise RuntimeError("Claude generation failed")


def _try_groq(ctx: RetrievedContext) -> list[dict]:
    from groq import Groq

    client = Groq(api_key=config.GROQ_API_KEY)
    resp = client.chat.completions.create(
        model=config.GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _user_prompt(ctx)},
        ],
        temperature=0.7,
        max_tokens=4000,
    )
    return _parse_script(resp.choices[0].message.content or "")


def _stub(ctx: RetrievedContext) -> list[dict]:
    """Deterministic canned script so the pipeline/UI work without API keys."""
    confusion = ctx.prior_confusion[0] if ctx.prior_confusion else "the last idea we covered"
    topic = ctx.topic or "today's material"
    return [
        {"speaker": "HOST_A", "text": f"Welcome back to Nous. Today we are breaking down {topic},"},
        {"speaker": "HOST_B", "text": f"Right, and before we start, yesterday you mentioned {confusion} was fuzzy for me,"},
        {"speaker": "HOST_A", "text": "Exactly, so let us clear that up first. Think of it as a single thread running through everything,"},
        {"speaker": "HOST_B", "text": "Wait, umm, a thread how,"},
        {"speaker": "HOST_A", "text": "Good interruption. A thread you can pull to unravel the whole idea. One concept leads to the next,"},
        {"speaker": "HOST_B", "text": "Oh, so it is like following a trail of breadcrumbs, one crumb at a time,"},
        {"speaker": "HOST_A", "text": "That is the perfect analogy. Keep that picture in your head as we go deeper,"},
        {"speaker": "HOST_B", "text": "Got it. Umm, okay, I am ready. Walk me through the first crumb,"},
        {"speaker": "HOST_A", "text": "Here it is. This is the demonstration voice for Nous, running with no keys yet. Add your keys to hear the real lesson,"},
        {"speaker": "HOST_B", "text": "Exactly. Thanks everyone, we will see you in the next episode,"},
    ]


def generate(ctx: RetrievedContext) -> tuple[list[dict], str]:
    """Return (dialogue, source_engine)."""
    if config.HAS_ANTHROPIC:
        try:
            return _try_claude(ctx), "claude"
        except Exception:
            pass
    if config.HAS_GROQ:
        try:
            return _try_groq(ctx), "groq"
        except Exception:
            pass
    return _stub(ctx), "stub"
