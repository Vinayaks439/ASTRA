"""A2A task client for inter-agent communication."""
from __future__ import annotations

import json
import uuid
from typing import Any

import httpx

from .models import AgentCard, JSONRPCResponse, Message, Part, Task


class A2ATaskClient:
    """Sends A2A tasks to peer agents."""

    def __init__(self, timeout: float = 30.0):
        self._client = httpx.AsyncClient(timeout=timeout)
        self._cards: dict[str, AgentCard] = {}

    async def discover(self, base_url: str) -> AgentCard:
        """Fetch an agent's card from /.well-known/agent.json."""
        resp = await self._client.get(f"{base_url}/.well-known/agent.json")
        resp.raise_for_status()
        card = AgentCard(**resp.json())
        self._cards[card.name] = card
        return card

    async def send_task(
        self,
        agent_url: str,
        task_id: str | None = None,
        data: Any = None,
        text: str | None = None,
    ) -> Task:
        """Send a task to an agent and return the result."""
        tid = task_id or str(uuid.uuid4())

        parts = []
        if data is not None:
            parts.append({"type": "data", "data": data})
        if text:
            parts.append({"type": "text", "text": text})

        payload = {
            "jsonrpc": "2.0",
            "method": "tasks/send",
            "id": tid,
            "params": {
                "id": tid,
                "message": {
                    "role": "user",
                    "parts": parts,
                },
            },
        }

        resp = await self._client.post(f"{agent_url}/a2a", json=payload)
        resp.raise_for_status()

        rpc_resp = JSONRPCResponse(**resp.json())
        if rpc_resp.error:
            raise RuntimeError(f"A2A error: {rpc_resp.error}")

        return rpc_resp.result

    async def close(self):
        await self._client.aclose()
