import { orderSchema } from "./commerce_tools.js";
import { runCreatorWorkflow } from "./creator_workflow.js";

const order = orderSchema.parse({
  orderId: "order-1042",
  assetId: "lighting-notes-v2",
  assetName: "Studio Lighting Notes",
  assetContent: "Three practical lighting arrangements for small creator studios.",
  subscriberEmail: "reader@example.com",
  paymentStatus: "paid",
  subscriberStatus: "active",
  idempotencyKey: "order-1042-attempt-1"
});

console.log(JSON.stringify(await runCreatorWorkflow(order), null, 2));
