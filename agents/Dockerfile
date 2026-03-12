FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements-container.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ARG AGENT_PORT=7071
ENV AGENT_PORT=${AGENT_PORT}

ARG AGENT_MODULE=risk_assessment.agent
ENV AGENT_MODULE=${AGENT_MODULE}

EXPOSE ${AGENT_PORT}

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
