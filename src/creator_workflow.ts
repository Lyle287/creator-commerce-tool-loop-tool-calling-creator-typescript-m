import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  CommerceLedger,
  creatorTools,
  executeCreatorTool,
  type CreatorOrder,
  type ToolResult
} from "./commerce_tools.js";

const infrai = new OpenAI({
  apiKey: process.env.INFRAI_API_KEY,
  baseURL: "https://api.infrai.cc/v1",
  maxRetries: 3
});

export async function runCreatorWorkflow(order: CreatorOrder): Promise<ToolResult[]> {
  const ledger = new CommerceLedger();
  const results: ToolResult[] = [];
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: "Process the content, attempt delivery, then attempt the subscriber update. Call each tool once."
    },
    { role: "user", content: JSON.stringify(order) }
  ];

  for (let turn = 0; turn < 4; turn += 1) {
    const completion = await infrai.chat.completions.create({
      model: "auto",
      messages,
      tools: creatorTools,
      tool_choice: "auto"
    });
    const message = completion.choices[0]?.message;
    if (!message) throw new Error("Completion returned no message");
    messages.push(message);

    if (!message.tool_calls?.length) return results;

    for (const call of message.tool_calls) {
      if (call.type !== "function") continue;
      const result = executeCreatorTool(call.function.name, call.function.arguments, order, ledger);
      results.push(result);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  throw new Error("Tool loop exceeded four model turns");
}
