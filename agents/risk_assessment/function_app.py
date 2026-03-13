"""Azure Function entry point for Risk Assessment Agent."""
import json
import logging

import azure.functions as func

from .agent import create_server, handle_task
from shared.a2a.models import Message, Part

app = func.FunctionApp()


@app.function_name("risk_assessment_a2a")
@app.route(route="a2a", methods=["POST"])
async def a2a_handler(req: func.HttpRequest) -> func.HttpResponse:
    """Handle A2A JSON-RPC requests."""
    server = create_server()
    from starlette.testclient import TestClient
    # Delegate to FastAPI A2A server
    body = req.get_json()
    # Direct invocation path for Azure Functions
    from shared.a2a.models import JSONRPCRequest, TaskSendParams
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


@app.function_name("risk_assessment_trigger")
@app.service_bus_queue_trigger(
    arg_name="msg",
    queue_name="risk.assess",
    connection="SERVICEBUS_CONNECTION",
)
async def servicebus_handler(msg: func.ServiceBusMessage):
    """Handle Service Bus trigger for batch risk assessment."""
    body = json.loads(msg.get_body().decode("utf-8"))
    sku_ids = body.get("sku_ids", [])

    message = Message(role="user", parts=[Part(type="data", data={"sku_ids": sku_ids})])
    await handle_task(f"sb-{msg.message_id}", message)
    logging.info("Risk assessment completed for %d SKUs via Service Bus", len(sku_ids))
