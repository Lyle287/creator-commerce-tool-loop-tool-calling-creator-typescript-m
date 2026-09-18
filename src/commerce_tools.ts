import { z } from "zod";

export const orderSchema = z.object({
  orderId: z.string().min(1),
  assetId: z.string().min(1),
  assetName: z.string().min(1),
  assetContent: z.string().min(1),
  subscriberEmail: z.string().email(),
  paymentStatus: z.enum(["paid", "pending", "refunded"]),
  subscriberStatus: z.enum(["active", "paused", "unsubscribed"]),
  idempotencyKey: z.string().min(8)
});

export type CreatorOrder = z.infer<typeof orderSchema>;

const processContentArgs = z.object({ assetId: z.string(), content: z.string() });
const deliverAssetArgs = z.object({ orderId: z.string(), assetId: z.string() });
const updateSubscriberArgs = z.object({ email: z.string().email(), assetName: z.string() });

export type ToolResult = {
  tool: string;
  status: "completed" | "skipped";
  detail: string;
};

export class CommerceLedger {
  private readonly results = new Map<string, ToolResult>();

  once(key: string, run: () => ToolResult): ToolResult {
    const prior = this.results.get(key);
    if (prior) return prior;
    const result = run();
    this.results.set(key, result);
    return result;
  }
}

export const creatorTools = [
  {
    type: "function" as const,
    function: {
      name: "process_content",
      description: "Prepare purchased creator content for delivery.",
      parameters: {
        type: "object",
        properties: { assetId: { type: "string" }, content: { type: "string" } },
        required: ["assetId", "content"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "deliver_asset",
      description: "Record delivery of a paid digital asset.",
      parameters: {
        type: "object",
        properties: { orderId: { type: "string" }, assetId: { type: "string" } },
        required: ["orderId", "assetId"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "update_subscriber",
      description: "Record an update for an active subscriber.",
      parameters: {
        type: "object",
        properties: { email: { type: "string" }, assetName: { type: "string" } },
        required: ["email", "assetName"],
        additionalProperties: false
      }
    }
  }
];

export function executeCreatorTool(
  name: string,
  rawArguments: string,
  order: CreatorOrder,
  ledger: CommerceLedger
): ToolResult {
  const parsed: unknown = JSON.parse(rawArguments);

  if (name === "process_content") {
    const args = processContentArgs.parse(parsed);
    if (args.assetId !== order.assetId) throw new Error("Asset does not belong to this order");
    return ledger.once(`${order.idempotencyKey}:process`, () => ({
      tool: name,
      status: "completed",
      detail: args.content.trim().replace(/\s+/g, " ").slice(0, 120)
    }));
  }

  if (name === "deliver_asset") {
    const args = deliverAssetArgs.parse(parsed);
    if (args.orderId !== order.orderId || args.assetId !== order.assetId) {
      throw new Error("Delivery identifiers do not match the request");
    }
    return ledger.once(`${order.idempotencyKey}:deliver`, () => order.paymentStatus === "paid"
      ? { tool: name, status: "completed", detail: `delivered ${args.assetId} for ${args.orderId}` }
      : { tool: name, status: "skipped", detail: `order ${args.orderId} is not paid` });
  }

  if (name === "update_subscriber") {
    const args = updateSubscriberArgs.parse(parsed);
    if (args.email !== order.subscriberEmail || args.assetName !== order.assetName) {
      throw new Error("Subscriber update does not match the request");
    }
    return ledger.once(`${order.idempotencyKey}:subscriber`, () => order.subscriberStatus === "active"
      ? { tool: name, status: "completed", detail: `updated ${args.email} about ${args.assetName}` }
      : { tool: name, status: "skipped", detail: `subscriber ${args.email} is not active` });
  }

  throw new Error(`Unknown tool: ${name}`);
}
