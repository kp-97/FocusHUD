import type { ChatMessageParam, ToolCallItem } from "../../types/ai";

/**
 * Maximum recursion depth for multi-step agent tool execution loops.
 * Protects against runaway recursion or hallucinated infinite tool calls.
 */
export const MAX_AGENT_DEPTH = 5;

/**
 * Evaluates whether the autonomous agent loop should continue into the next step.
 */
export function shouldContinueAgentLoop(
  toolCallsCount: number,
  depth: number,
  maxDepth = MAX_AGENT_DEPTH
): boolean {
  return toolCallsCount > 0 && depth < maxDepth;
}

/**
 * Constructs the updated message history for the next iteration of the ReAct agent loop.
 * Appends:
 * 1. The assistant's intermediate message with its tool_calls definition.
 * 2. Each tool's execution result formatted as a standard `role: "tool"` response.
 */
export function buildNextIterationMessages(
  baseHistory: ChatMessageParam[],
  assistantContent: string,
  executedToolCalls: ToolCallItem[]
): ChatMessageParam[] {
  const nextMessages: ChatMessageParam[] = [...baseHistory];

  const formattedToolCalls = executedToolCalls.map((tc) => ({
    id: tc.id,
    type: "function",
    function: {
      name: tc.name,
      arguments: tc.arguments,
    },
  }));

  // Append intermediate assistant message with tool calls
  nextMessages.push({
    role: "assistant",
    content: assistantContent.trim() ? assistantContent : null,
    toolCalls: formattedToolCalls,
  });

  // Append tool result messages for each executed tool
  for (const tc of executedToolCalls) {
    const content = tc.result && tc.result.trim() ? tc.result : JSON.stringify({ status: "success" });
    nextMessages.push({
      role: "tool",
      toolCallId: tc.id,
      name: tc.name,
      content,
    });
  }

  return nextMessages;
}
