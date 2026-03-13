#!/bin/sh
set -e

MODULE="${AGENT_MODULE:-risk_assessment.agent}"
PORT="${AGENT_PORT:-7071}"

exec python -c "
import importlib, uvicorn
mod = importlib.import_module('${MODULE}')
server = mod.create_server()
uvicorn.run(server.app, host='0.0.0.0', port=${PORT})
"
