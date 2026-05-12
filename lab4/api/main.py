"""HTTP API that performs the same TCP exchange as the CLI client (for React in the browser)."""

from __future__ import annotations

import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from common.tcp_client_ops import one_shot

app = FastAPI(title="Lab4 TCP bridge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class OneShotRequest(BaseModel):
    host: str = Field(default="127.0.0.1")
    port: int = Field(default=9000, ge=1, le=65535)
    path: str = Field(min_length=1)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/one-shot")
def post_one_shot(body: OneShotRequest) -> dict:
    try:
        return one_shot(body.host, body.port, body.path)
    except OSError as e:
        return {
            "drives": [],
            "response": {"type": "error", "message": str(e)},
            "error": str(e),
        }
