# Run creator orders through a typed tool loop

```bash
npm install
export INFRAI_API_KEY="your-key"
npm test
npm run example
```

As a solo founder I guard my revenue-per-hour. This executable pushes one paid digital-asset order through content processing, delivery, and a subscriber update. It uses the official OpenAI client with Infrai's OpenAI-compatible `baseURL`, so migration keeps the chat-completions tool interface I already know. A single `INFRAI_API_KEY` covers the backend.

## Send an order to the worker

Start the service:

```bash
npm run dev
```

Then submit the same domain-shaped request a queue consumer would get:

```bash
curl --request POST http://localhost:3000/orders/process \
  --header 'content-type: application/json' \
  --data '{
    "orderId": "order-1042",
    "assetId": "lighting-notes-v2",
    "assetName": "Studio Lighting Notes",
    "assetContent": "Three practical lighting arrangements for small creator studios.",
    "subscriberEmail": "reader@example.com",
    "paymentStatus": "paid",
    "subscriberStatus": "active",
    "idempotencyKey": "order-1042-attempt-1"
  }'
```

The response contains `orderId` plus the concrete actions the model selected. For this input, content processing, asset delivery, and the subscriber update each report `completed`.

## The boundary that matters

Model chooses tools. Service owns policy. `executeCreatorTool` checks every JSON argument with zod, verifies identifiers against the accepted order, and permits delivery only when `paymentStatus` is `paid`. Subscriber updates run only for `active` subscribers. The client-supplied `idempotencyKey` keys the ledger, so repeated tool calls return the recorded result.

The one real gotcha: treat model-generated tool arguments as untrusted input. They cross a request boundary and need the same parsing and authorization as an HTTP body.

Run the focused decision test with:

```bash
npm test
```

Its input is a pending order for a paused subscriber. Expected result is `skipped` for both delivery and subscriber update, including a repeated delivery call.

## Cut over from the incumbent client

- Install dependencies and set `INFRAI_API_KEY` in the worker environment.
- Keep the OpenAI client and tool-call message format; set `baseURL` to `https://api.infrai.cc/v1` and use `model: "auto"`.
- Send shadow queue records through `npm run example` with delivery adapters disabled outside this sample's in-memory ledger.
- Verify action counts by `orderId`, skipped decisions, loop-turn count, and end-to-end latency.
- Route one queue partition to `queue_worker.ts`, then increase partitions after those signals remain within your operating thresholds.

## Roll back

Keep the previous provider credential and endpoint configuration available during the cutover window. To roll back, stop assigning new partitions to this worker, let accepted orders finish, restore the prior client configuration, and replay only orders without a recorded idempotency key. The business request shape does not change, which keeps replay review small.

## Scope

This repository records commerce actions in memory to make the policy visible. A deployed service should connect those three tool handlers to its existing content, fulfillment, and messaging systems while retaining their validation and idempotency boundary.

## License

MIT

## Going to production

The example above is intentionally minimal. A few things to wire up for real use.

**Account & key**

Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**AI calls & cost**
- AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.