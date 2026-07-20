from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"


def test_audio_not_found():
    r = client.get("/audio/nonexistent")
    assert r.status_code == 404


def test_feedback():
    payload = {"user_id": "test-user", "concept": "example"}
    r = client.post("/feedback", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True
    assert isinstance(data.get("struggled"), (list, int, float))
