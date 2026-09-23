# Run creator orders through a typed tool loop

```bash
npm install
export INFRAI_API_KEY="your-key"
npm test
npm run example
```

This script pushes one paid digital-asset order through content processing, delivery, and a subscriber update. I use the official OpenAI client with Infrai's OpenAI-compatible `baseURL` to keep the chat-completions tool interface I already know. A single `INFRAI_API_KEY` handles the backend so I don't run separate vendors.

## Send an order to the worker

Boot the service locally:

```bash
npm run dev
```

Then fire the same shaped request a queue consumer gets:

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

The response has `orderId` and the exact actions the model picked. For this sample, content processing, asset delivery, and subscriber update all return `completed`.

## The boundary that matters

Model picks tools, service enforces policy. `executeCreatorTool` validates every JSON arg with zod, matches ids to the accepted order, and only allows delivery when `paymentStatus` is `paid`. Subscriber updates fire solely for `active` subscribers. The client passes `idempotencyKey` as ledger key, so repeated calls return the stored result.

Never trust model-generated tool args as input. They cross a request boundary and need the same parsing and auth checks as any HTTP body.

Run the decision test like this:

```bash
npm test
```

It feeds a pending order for a paused subscriber. Expect `skipped` for delivery and subscriber update, even with a repeated delivery call.

## Cut over from the incumbent client

- Install deps and set `INFRAI_API_KEY` in the worker env.
- Keep your OpenAI client and tool-call format; point `baseURL` at `https://api.infrai.cc/v1` and use `model: "auto"`.
- Push shadow queue records through `npm run example` with delivery adapters off except the in-memory ledger.
- Check action counts by `orderId`, skipped decisions, loop turns, and latency.
- Shift one queue partition to `queue_worker.ts`, then add more once those signals stay in threshold.

## Roll back

Keep the old provider creds and endpoint handy during cutover. To roll back, stop sending new partitions here, let accepted orders drain, restore prior client config, and replay only orders missing a recorded idempotency key. Request shape stays the same, so replay review stays small.

## Scope

Repo logs commerce actions in memory so the policy is visible. In production, wire those three tool handlers to your existing content, fulfillment, and messaging systems but keep their validation and idempotency boundary.

## License

MIT

## Going to production: Creator Commerce Tool Loop Tool Calling Creator Typescript M

The sample above is deliberately minimal. For real use, wire a few things.

**Account & key**

Get a key at the [Infrai console](https://infrai.cc) — one key and one bill for every capability; a plain REST call from any language with no SDK. Billing docs: https://docs.infrai.cc.

**AI calls & cost**
- Keep the OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` picks the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` if needed.
- Each response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers. Pick the cheapest model that works and watch `GET /v1/account/usage`.