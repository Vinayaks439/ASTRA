"""Azure Function entry point for AI Insights Agent."""
import json
import logging

import azure.functions as func

from .agent import handle_task
from shared.a2a.models import JSONRPCRequest, Message, Part, TaskSendParams

app = func.FunctionApp()


@app.function_name("insights_a2a")
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


@app.function_name("insights_timer")
@app.timer_trigger(schedule="0 */5 * * * *", arg_name="timer")
async def timer_handler(timer: func.TimerRequest):
    """Scheduled refresh every 5 minutes."""
    message = Message(role="system", parts=[Part(type="text", text="scheduled refresh")])
    await handle_task("timer-insights", message)
    logging.info("Scheduled insights refresh completed")
