"""Auth: PBKDF2 password hashing + HMAC-signed expiring tokens.

Stdlib only (hashlib/hmac/secrets) — no new pip dependencies, which matters on
this machine's flaky network. Token format: base64(payload).base64(signature),
payload = {"uid": ..., "exp": ...}.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time

import config

# Signing secret: from env if provided, else generated once and kept in storage
# so tokens survive server restarts.
_SECRET_FILE = config.STORAGE_DIR / ".secret_key"


def _secret() -> bytes:
    if config.SECRET_KEY:
        return config.SECRET_KEY.encode()
    if _SECRET_FILE.exists():
        return _SECRET_FILE.read_bytes()
    key = secrets.token_bytes(32)
    _SECRET_FILE.write_bytes(key)
    return key


TOKEN_TTL_SECONDS = config.TOKEN_TTL_DAYS * 24 * 3600

_PBKDF2_ITERATIONS = 200_000


# ---------- passwords ----------

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return f"pbkdf2${_PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iters, salt_hex, digest_hex = stored.split("$")
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(iters)
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, AttributeError):
        return False


# ---------- tokens ----------

def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    pad = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + pad)


def issue_token(user_id: str) -> str:
    payload = json.dumps({"uid": user_id, "exp": time.time() + TOKEN_TTL_SECONDS})
    body = _b64(payload.encode())
    sig = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verify_token(token: str) -> str | None:
    """Return the user id if the token is valid and unexpired, else None."""
    try:
        body, sig = token.split(".", 1)
        expected = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(_unb64(body))
        if payload["exp"] < time.time():
            return None
        return str(payload["uid"])
    except (ValueError, KeyError, json.JSONDecodeError):
        return None
