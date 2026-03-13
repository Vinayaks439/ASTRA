#!/usr/bin/env python3
"""Local runner — starts the MCP Cosmos server + all 6 ASTRA agents.

Usage:
    cd ASTRA/agents
    python run_local.py          # starts MCP server + all agents
    python run_local.py risk     # starts MCP server + risk-assessment agent only
"""
from __future__ import annotations

import multiprocessing
import os
import sys
import time
import logging

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)-24s] %(levelname)-5s %(message)s",
    datefmt="%H:%M:%S",
)

MCP_PORT = int(os.getenv("MCP_SERVER_PORT", "6060"))

AGENTS = {
    "risk": {
        "name": "risk-assessment",
        "port": 7071,
        "module": "risk_assessment.agent",
        "factory": "create_server",
    },
    "recommendation": {
        "name": "recommendation",
        "port": 7072,
        "module": "recommendation.agent",
        "factory": "create_server",
    },
    "triage": {
        "name": "exception-triage",
        "port": 7073,
        "module": "exception_triage.agent",
        "factory": "create_server",
    },
    "rationale": {
        "name": "rationale",
        "port": 7074,
        "module": "rationale.agent",
        "factory": "create_server",
    },
    "insights": {
        "name": "insights",
        "port": 7075,
        "module": "insights.agent",
        "factory": "create_server",
    },
    "notification": {
        "name": "notification",
        "port": 7076,
        "module": "notification.agent",
        "factory": "create_server",
    },
}


def run_mcp_server():
    """Start the MCP Cosmos DB tool server."""
    from shared.mcp.server import run_server
    run_server()


def run_agent(key: str, cfg: dict):
    """Import the agent module and start uvicorn."""
    import importlib
    import uvicorn

    mod = importlib.import_module(cfg["module"])
    server = getattr(mod, cfg["factory"])()

    print(f"  ▶ {cfg['name']:24s}  http://localhost:{cfg['port']}/a2a")
    uvicorn.run(
        server.app,
        host="0.0.0.0",
        port=cfg["port"],
        log_level="warning",
    )


def main():
    wanted = set(sys.argv[1:]) if len(sys.argv) > 1 else set(AGENTS.keys())
    selected = {k: v for k, v in AGENTS.items() if k in wanted}

    if not selected:
        print(f"Unknown agent(s): {sys.argv[1:]}. Choose from: {list(AGENTS.keys())}")
        sys.exit(1)

    print("╔═══════════════════════════════════════════════════════════╗")
    print("║  ASTRA Agent Runner — Local Development                  ║")
    print("╚═══════════════════════════════════════════════════════════╝")
    print()

    cosmos = os.getenv("COSMOS_ENDPOINT", "")
    if not cosmos:
        print("  ⚠  COSMOS_ENDPOINT not set — agents won't connect to DB")
    else:
        print(f"  ✓  Cosmos DB: {cosmos[:40]}...")

    openai_ep = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    if openai_ep:
        print(f"  ✓  Azure OpenAI: {openai_ep[:40]}...")
    else:
        print("  ℹ  No Azure OpenAI — agents will use template fallbacks")

    print()

    # Start MCP Cosmos DB tool server first
    print(f"  ▶ {'mcp-cosmos-server':24s}  http://localhost:{MCP_PORT}/sse")
    mcp_proc = multiprocessing.Process(target=run_mcp_server, daemon=True)
    mcp_proc.start()
    time.sleep(2)

    # Start agent processes
    print(f"\n  Starting {len(selected)} agent(s):")

    procs = [mcp_proc]
    for key, cfg in selected.items():
        p = multiprocessing.Process(target=run_agent, args=(key, cfg), daemon=True)
        p.start()
        procs.append(p)

    try:
        for p in procs:
            p.join()
    except KeyboardInterrupt:
        print("\n  Shutting down MCP server + agents...")
        for p in procs:
            p.terminate()


if __name__ == "__main__":
    main()
