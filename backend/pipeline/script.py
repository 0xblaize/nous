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
5. Keep sentences short and write the way people actually talk: contractions (it's, that's, you're), varied sentence length, natural rhythm. Do not spell out filler words like "Umm" or "Uh" as their own token, and do not end lines with a trailing comma just to force a pause, a text-to-speech engine reads those literally and it sounds stiff. Let normal punctuation (periods, question marks) carry the pacing instead.
6. Vary how each line opens, avoid starting every HOST_B line the same way (not every line needs "Right," or "Exactly,").

OUTPUT SCHEMA:
You must output ONLY a raw JSON array. Do not wrap it in code blocks. Do not add introductory text.

[
  { "speaker": "HOST_A", "text": "Welcome back. Today we're breaking down..." },
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
        {"speaker": "HOST_A", "text": f"Welcome back to Nous. Today we're breaking down {topic}."},
        {"speaker": "HOST_B", "text": f"Before we start, yesterday you mentioned {confusion} was a bit fuzzy for me."},
        {"speaker": "HOST_A", "text": "Let's clear that up first. Think of it as a single thread running through everything."},
        {"speaker": "HOST_B", "text": "Wait, a thread? What do you mean by that exactly?"},
        {"speaker": "HOST_A", "text": "Good question. It's something you can pull to unravel the whole idea. One concept leads straight into the next."},
        {"speaker": "HOST_B", "text": "Oh, so it's like following a trail of clues, one at a time."},
        {"speaker": "HOST_A", "text": "That's the perfect way to picture it. Keep that in mind as we go deeper."},
        {"speaker": "HOST_B", "text": "Got it, I'm ready. Walk me through the first part."},
        {"speaker": "HOST_A", "text": "Here it is. This is the demo voice for Nous, running with no keys yet. Add your keys to hear the real lesson."},
        {"speaker": "HOST_B", "text": "Thanks for listening. We'll see you in the next episode."},
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
