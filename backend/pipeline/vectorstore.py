"""ChromaDB persistent vector store — local, free embeddings."""
from __future__ import annotations

import chromadb

import config

_client: chromadb.ClientAPI | None = None


def _get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=str(config.CHROMA_DIR))
    return _client


def _collection(name: str):
    # Default embedding function is the local all-MiniLM sentence-transformer:
    # no paid API, persists to disk under storage/chroma.
    return _get_client().get_or_create_collection(name=name)


def upsert(doc_id: str, chunks: list[str]) -> str:
    """Store chunks for a document under a per-document collection name."""
    col = _collection(f"doc_{doc_id}")
    ids = [f"{doc_id}-{i}" for i in range(len(chunks))]
    metadatas = [{"doc_id": doc_id, "index": i} for i in range(len(chunks))]
    col.upsert(ids=ids, documents=chunks, metadatas=metadatas)
    return f"doc_{doc_id}"


def query(doc_id: str, text: str, top_k: int | None = None) -> list[str]:
    top_k = top_k or config.TOP_K
    col = _collection(f"doc_{doc_id}")
    count = col.count()
    if count == 0:
        return []
    res = col.query(query_texts=[text], n_results=min(top_k, count))
    docs = res.get("documents") or [[]]
    return docs[0] if docs else []
