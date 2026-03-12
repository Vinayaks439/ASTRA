"""Azure Function entry point for Exception Triage Agent."""
import json

import azure.functions as func

from .agent import handle_task
from shared.a2a.models import JSONRPCRequest, TaskSendParams

app = func.FunctionApp()


@app.function_name("exception_triage_a2a")
@app.route(route="a2a", methods=["POST"])
async def a2a_handler(req: func.HttpRequest) -> func.HttpResponse:
    body = req.get_json()
    rpc = JSONRPCRequest(**body)

    if rpc.method == "tasks/send":
        params = rpc.params
        if isinstance(params, dict):
            params = TaskSendParams(**params)
        result = await handle_task(params.id, params.message)
        return func.HttpResponse(
            json.dumps({"jsonrpc": "2.0", "id": rpc.id, "result": result.model_dump(by_alias=True, exclude_none=True)}),
            mimetype="application/json",
        )

    return func.HttpResponse(json.dumps({"error": "unsupported method"}), status_code=400)
