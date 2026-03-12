"""A2A JSON-RPC server base for ASTRA agents."""
from __future__ import annotations

import json
import logging
import uuid
from typing import Any, Callable, Awaitable

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .models import (
    AgentCard,
    Artifact,
    JSONRPCRequest,
    JSONRPCResponse,
    Message,
    Part,
    Task,
    TaskSendParams,
    TaskState,
    TaskStatus,
)

logger = logging.getLogger(__name__)


TaskHandler = Callable[[str, Message], Awaitable[Task]]


class A2AServer:
    """FastAPI-based A2A JSON-RPC server."""

    def __init__(self, agent_card: AgentCard, handler: TaskHandler):
        self.card = agent_card
        self.handler = handler
        self.tasks: dict[str, Task] = {}
        self.app = FastAPI(title=agent_card.name)
        self._register_routes()

    def _register_routes(self):
        @self.app.get("/.well-known/agent.json")
        async def get_agent_card():
            return self.card.model_dump(by_alias=True)

        @self.app.post("/a2a")
        async def handle_a2a(request: Request):
            body = await request.json()
            try:
                rpc = JSONRPCRequest(**body)
            except Exception as e:
                return JSONResponse(
                    {"jsonrpc": "2.0", "id": body.get("id"), "error": {"code": -32600, "message": str(e)}},
                    status_code=400,
                )

            if rpc.method == "tasks/send":
                return await self._handle_send(rpc)
            elif rpc.method == "tasks/get":
                return await self._handle_get(rpc)
            elif rpc.method == "tasks/cancel":
                return await self._handle_cancel(rpc)
            else:
                return JSONResponse(
                    {"jsonrpc": "2.0", "id": rpc.id, "error": {"code": -32601, "message": f"Unknown method: {rpc.method}"}},
                    status_code=400,
                )

        @self.app.get("/health")
        async def health():
            return {"status": "ok", "agent": self.card.name}

    async def _handle_send(self, rpc: JSONRPCRequest) -> JSONResponse:
        params = rpc.params
        if isinstance(params, dict):
            params = TaskSendParams(**params)

        task_id = params.id or str(uuid.uuid4())

        try:
            result = await self.handler(task_id, params.message)
            self.tasks[task_id] = result
        except Exception as e:
            logger.exception("Task %s failed", task_id)
            result = Task(
                id=task_id,
                status=TaskStatus(state=TaskState.FAILED, message=str(e)),
            )
            self.tasks[task_id] = result

        resp = JSONRPCResponse(id=rpc.id, result=result)
        return JSONResponse(resp.model_dump(by_alias=True, exclude_none=True))

    async def _handle_get(self, rpc: JSONRPCRequest) -> JSONResponse:
        params = rpc.params if isinstance(rpc.params, dict) else {}
        task_id = params.get("id", "")
        task = self.tasks.get(task_id)
        if not task:
            return JSONResponse(
                {"jsonrpc": "2.0", "id": rpc.id, "error": {"code": -32602, "message": f"Task {task_id} not found"}},
                status_code=404,
            )
        resp = JSONRPCResponse(id=rpc.id, result=task)
        return JSONResponse(resp.model_dump(by_alias=True, exclude_none=True))

    async def _handle_cancel(self, rpc: JSONRPCRequest) -> JSONResponse:
        params = rpc.params if isinstance(rpc.params, dict) else {}
        task_id = params.get("id", "")
        task = self.tasks.get(task_id)
        if task:
            task.status = TaskStatus(state=TaskState.CANCELED)
        resp = JSONRPCResponse(
            id=rpc.id,
            result=Task(id=task_id, status=TaskStatus(state=TaskState.CANCELED)),
        )
        return JSONResponse(resp.model_dump(by_alias=True, exclude_none=True))


def make_completed_task(task_id: str, artifact_name: str, data: Any) -> Task:
    """Helper to create a completed task with a single data artifact."""
    return Task(
        id=task_id,
        status=TaskStatus(state=TaskState.COMPLETED),
        artifacts=[
            Artifact(
                name=artifact_name,
                parts=[Part(type="data", data=data)],
            )
        ],
    )
