"""A2A protocol data models (Google A2A spec)."""
from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class TaskState(str, Enum):
    SUBMITTED = "submitted"
    WORKING = "working"
    INPUT_REQUIRED = "input-required"
    COMPLETED = "completed"
    CANCELED = "canceled"
    FAILED = "failed"


class Part(BaseModel):
    type: str = "text"
    text: str | None = None
    data: Any | None = None
    mime_type: str | None = Field(None, alias="mimeType")


class Message(BaseModel):
    role: str
    parts: list[Part]


class TaskStatus(BaseModel):
    state: TaskState
    message: str | None = None


class Artifact(BaseModel):
    name: str
    parts: list[Part]


class Task(BaseModel):
    id: str
    status: TaskStatus
    artifacts: list[Artifact] | None = None
    history: list[Message] | None = None


class TaskSendParams(BaseModel):
    id: str
    message: Message


class JSONRPCRequest(BaseModel):
    jsonrpc: str = "2.0"
    method: str
    id: str | int
    params: dict | TaskSendParams | None = None


class JSONRPCResponse(BaseModel):
    jsonrpc: str = "2.0"
    id: str | int
    result: Task | None = None
    error: dict | None = None


class Skill(BaseModel):
    id: str
    name: str
    description: str
    input_modes: list[str] = Field(default_factory=lambda: ["application/json"], alias="inputModes")
    output_modes: list[str] = Field(default_factory=lambda: ["application/json"], alias="outputModes")


class Capabilities(BaseModel):
    streaming: bool = False
    push_notifications: bool = Field(False, alias="pushNotifications")


class Authentication(BaseModel):
    schemes: list[str] = ["bearer"]
    credentials: str = "azure-entra-token"


class AgentCard(BaseModel):
    name: str
    description: str
    url: str
    version: str = "1.0.0"
    capabilities: Capabilities = Capabilities()
    skills: list[Skill] = []
    authentication: Authentication = Authentication()
