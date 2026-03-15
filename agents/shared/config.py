"""Shared configuration for all ASTRA agents."""
import os

COSMOS_ENDPOINT = os.getenv("COSMOS_ENDPOINT", "")
COSMOS_KEY = os.getenv("COSMOS_KEY", "")
COSMOS_DATABASE = os.getenv("COSMOS_DATABASE", "voltedge-pricing-db")

AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY", "")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "astra-gpt")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

SERVICEBUS_CONNECTION = os.getenv("SERVICEBUS_CONNECTION", "")

MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:6060/sse")

SERP_API_KEY = os.getenv("SERP_API_KEY", "")

AGENT_URLS = {
    "risk-assessment": os.getenv("RISK_AGENT_URL", "http://localhost:7071"),
    "recommendation": os.getenv("RECOMMENDATION_AGENT_URL", "http://localhost:7072"),
    "exception-triage": os.getenv("TRIAGE_AGENT_URL", "http://localhost:7073"),
    "rationale": os.getenv("RATIONALE_AGENT_URL", "http://localhost:7074"),
    "insights": os.getenv("INSIGHTS_AGENT_URL", "http://localhost:7075"),
    "notification": os.getenv("NOTIFICATION_AGENT_URL", "http://localhost:7076"),
    "competitor-puller": os.getenv("COMPETITOR_PULLER_URL", "http://localhost:7077"),
}
