import { createServer } from "node:http";
import { ZodError } from "zod";
import { orderSchema } from "./commerce_tools.js";
import { runCreatorWorkflow } from "./creator_workflow.js";

const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/orders/process") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const order = orderSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const actions = await runCreatorWorkflow(order);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ orderId: order.orderId, actions }));
  } catch (error) {
    const clientError = error instanceof ZodError || error instanceof SyntaxError;
    response.writeHead(clientError ? 400 : 502, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: clientError ? "invalid_request" : "workflow_failed" }));
  }
});

server.listen(port, () => console.log(`creator queue worker listening on http://localhost:${port}`));
