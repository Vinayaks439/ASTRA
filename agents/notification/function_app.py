"""Azure Function entry point for Notification Agent."""
import json

import azure.functions as func

from .agent import handle_task
from shared.a2a.models import JSONRPCRequest, TaskSendParams

app = func.FunctionApp()


@app.function_name("notification_a2a")
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


@app.function_name("notification_servicebus")
@app.service_bus_queue_trigger(
    arg_name="msg",
    queue_name="notify",
    connection="SERVICEBUS_CONNECTION",
)
async def servicebus_handler(msg: func.ServiceBusMessage):
    """Handle Service Bus trigger for async notifications."""
    import logging
    from shared.a2a.models import Message, Part

    body = json.loads(msg.get_body().decode("utf-8"))
    message = Message(role="system", parts=[Part(type="data", data=body)])
    await handle_task(f"sb-{msg.message_id}", message)
    logging.info("Notification sent via Service Bus trigger")
