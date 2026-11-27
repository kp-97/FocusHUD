import type { ChatMessageParam, ToolCallItem } from "../../types/ai";

/**
 * Maximum recursion depth for multi-step agent tool execution loops.
 * Protects against runaway recursion or hallucinated infinite tool calls.
 */
export const MAX_AGENT_DEPTH = 5;

/**
 * Normalizes tool arguments JSON for deterministic comparison in cycle detection.
 */
export function normalizeToolArgs(args?: string): string {
  if (!args) return "{}";
  try {
    const parsed = JSON.parse(args.trim());
    return JSON.stringify(parsed, Object.keys(parsed).sort());
  } catch {
    return args.trim().toLowerCase();
  }
}

/**
 * Evaluates whether the autonomous agent loop should continue into the next step.
 * Prevents:
 * 1. Infinite recursion depth exceeding MAX_AGENT_DEPTH.
 * 2. Repetitive cycles where the model calls the exact same tool with identical arguments.
 * 3. Runaway tool calls when the model has already formulated a complete conversational reply to the user.
 */
export function shouldContinueAgentLoop(
  toolCallsOrCount: number | ToolCallItem[],
  depth: number,
  allPreviousTools: ToolCallItem[] = [],
  assistantContent = "",
  maxDepth = MAX_AGENT_DEPTH
): boolean {
  const toolCount = typeof toolCallsOrCount === "number" ? toolCallsOrCount : toolCallsOrCount.length;
  if (toolCount === 0 || depth >= maxDepth) {
    return false;
  }

  if (Array.isArray(toolCallsOrCount)) {
    const executedTools = toolCallsOrCount;

    // Cycle detection: If every tool called in this iteration has already been executed
    // with identical name and arguments in prior iterations of this turn, stop immediately.
    const isAllDuplicate = executedTools.every((tc) =>
      allPreviousTools.some(
        (prev) =>
          prev.name.toLowerCase() === tc.name.toLowerCase() &&
          normalizeToolArgs(prev.arguments) === normalizeToolArgs(tc.arguments)
      )
    );

    const hasAnyDuplicate = executedTools.some((tc) =>
      allPreviousTools.some(
        (prev) =>
          prev.name.toLowerCase() === tc.name.toLowerCase() &&
          normalizeToolArgs(prev.arguments) === normalizeToolArgs(tc.arguments)
      )
    );

    if (isAllDuplicate || (hasAnyDuplicate && assistantContent.trim().length > 40)) {
      return false;
    }

    // Conversational conclusion detection: If the assistant has already streamed substantive
    // content (e.g. explaining notes were not found and asking the user for details), stop looping.
    if (assistantContent.trim().length > 60 && executedTools.length <= 1) {
      return false;
    }
  }

  return true;
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
