# ── base: shared deps ────────────────────────────────────────────────────────
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements-container.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY shared/ shared/

# ── risk-assessment ───────────────────────────────────────────────────────────
FROM base AS risk-assessment
COPY --from=base /app /app
COPY risk_assessment/ risk_assessment/
ENV AGENT_MODULE=risk_assessment.agent \
    AGENT_PORT=7071
EXPOSE 7071
ENTRYPOINT ["/entrypoint.sh"]

# ── recommendation ────────────────────────────────────────────────────────────
FROM base AS recommendation
COPY --from=base /app /app
COPY recommendation/ recommendation/
ENV AGENT_MODULE=recommendation.agent \
    AGENT_PORT=7072
EXPOSE 7072
ENTRYPOINT ["/entrypoint.sh"]

# ── exception-triage ──────────────────────────────────────────────────────────
FROM base AS exception-triage
COPY --from=base /app /app
COPY exception_triage/ exception_triage/
ENV AGENT_MODULE=exception_triage.agent \
    AGENT_PORT=7073
EXPOSE 7073
ENTRYPOINT ["/entrypoint.sh"]

# ── rationale ─────────────────────────────────────────────────────────────────
FROM base AS rationale
COPY --from=base /app /app
COPY rationale/ rationale/
ENV AGENT_MODULE=rationale.agent \
    AGENT_PORT=7074
EXPOSE 7074
ENTRYPOINT ["/entrypoint.sh"]

# ── insights ──────────────────────────────────────────────────────────────────
FROM base AS insights
COPY --from=base /app /app
COPY insights/ insights/
ENV AGENT_MODULE=insights.agent \
    AGENT_PORT=7075
EXPOSE 7075
ENTRYPOINT ["/entrypoint.sh"]

# ── notification ──────────────────────────────────────────────────────────────
FROM base AS notification
COPY --from=base /app /app
COPY notification/ notification/
ENV AGENT_MODULE=notification.agent \
    AGENT_PORT=7076
EXPOSE 7076
ENTRYPOINT ["/entrypoint.sh"]

# ── competitor-puller ─────────────────────────────────────────────────────────
FROM base AS competitor-puller
COPY --from=base /app /app
COPY competitor_puller/ competitor_puller/
ENV AGENT_MODULE=competitor_puller.agent \
    AGENT_PORT=7077
EXPOSE 7077
ENTRYPOINT ["/entrypoint.sh"]

# ── mcp-server ────────────────────────────────────────────────────────────────
FROM base AS mcp-server
COPY --from=base /app /app
ENV MCP_SERVER_PORT=6060
EXPOSE 6060
CMD ["python", "-m", "shared.mcp.server"]
