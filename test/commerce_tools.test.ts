import assert from "node:assert/strict";
import test from "node:test";
import { CommerceLedger, executeCreatorTool, orderSchema } from "../src/commerce_tools.js";

test("delivery and subscriber decisions follow commerce state", () => {
  const order = orderSchema.parse({
    orderId: "order-7",
    assetId: "asset-9",
    assetName: "Editing Checklist",
    assetContent: "A concise editing checklist.",
    subscriberEmail: "paused@example.com",
    paymentStatus: "pending",
    subscriberStatus: "paused",
    idempotencyKey: "order-7-run-1"
  });
  const ledger = new CommerceLedger();

  const delivery = executeCreatorTool(
    "deliver_asset",
    JSON.stringify({ orderId: order.orderId, assetId: order.assetId }),
    order,
    ledger
  );
  const update = executeCreatorTool(
    "update_subscriber",
    JSON.stringify({ email: order.subscriberEmail, assetName: order.assetName }),
    order,
    ledger
  );

  assert.equal(delivery.status, "skipped");
  assert.equal(update.status, "skipped");
  assert.deepEqual(
    executeCreatorTool("deliver_asset", JSON.stringify({ orderId: order.orderId, assetId: order.assetId }), order, ledger),
    delivery
  );
});
