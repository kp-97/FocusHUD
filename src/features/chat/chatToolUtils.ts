import type { Dispatch, SetStateAction } from "react";
import type { ToolCallItem, ChatMessageItem } from "../../types/ai";
import { executeAiToolCall, persistChatMessage } from "../../services/aiService";
import { isTauriEnvironment } from "../../services/dbService";

/**
 * Generates user-friendly markdown text if the AI provider completed turn execution
 * with tool calls but without emitting conversational text deltas.
 */
export function formatToolFallbackResponse(toolCalls?: ToolCallItem[]): string {
  if (!toolCalls || toolCalls.length === 0) return "";
  const parts: string[] = [];

  for (const tc of toolCalls) {
    if (!tc.result) continue;
    try {
      const data = JSON.parse(tc.result);
      if (data.message) {
        parts.push(`✓ **${data.message}**`);
      } else if (data.formatted) {
        parts.push(
          `Current date & time: **${data.formatted}** (${data.timezone || "local"})`
        );
      } else if (data.events && Array.isArray(data.events)) {
        const hasEvents = data.events.length > 0;
        const hasTasks = data.tasks && Array.isArray(data.tasks) && data.tasks.length > 0;

        if (!hasEvents && !hasTasks) {
          parts.push("No scheduled events found.");
        } else {
          if (hasEvents) {
            const list = data.events
              .map(
                (e: { title: string; date: string; startTime: string; endTime: string; location?: string }) =>
                  `* **${e.title}**: ${e.date} (${e.startTime} - ${e.endTime})${e.location ? ` [${e.location}]` : ""}`
              )
              .join("\n");
            parts.push(`Scheduled events (${data.events.length}):\n${list}`);
          }
          if (hasTasks) {
            const list = data.tasks
              .map(
                (t: { title: string; status?: string; startTime?: string; endTime?: string }) =>
                  `* **${t.title}** (${t.startTime || "09:00"} - ${t.endTime || "10:00"}) [Task - ${t.status || "pending"}]`
              )
              .join("\n");
            parts.push(`Calendar tasks (${data.tasks.length}):\n${list}`);
          }
        }
      } else if (data.tasks && Array.isArray(data.tasks)) {
        if (data.tasks.length === 0) {
          parts.push("No matching tasks found.");
        } else {
          const list = data.tasks
            .map((t: { title: string; status: string }) => `* **${t.title}** [${t.status}]`)
            .join("\n");
          parts.push(`Tasks (${data.tasks.length}):\n${list}`);
        }
      } else if (data.goals && Array.isArray(data.goals)) {
        if (data.goals.length === 0) {
          parts.push("No active goals found.");
        } else {
          const list = data.goals
            .map((g: { title: string }) => `* **${g.title}**`)
            .join("\n");
          parts.push(`Goals (${data.goals.length}):\n${list}`);
        }
      }
    } catch {
      if (tc.result) parts.push(tc.result);
    }
  }

  return parts.join("\n\n");
}

export async function handleToolExecution(
  tool: { id: string; name: string; arguments: string },
  assistantId: string,
  setMessages: Dispatch<SetStateAction<ChatMessageItem[]>>,
  sessionId: string | null
): Promise<string> {
  const toolCallItem: ToolCallItem = {
    id: tool.id,
    name: tool.name,
    arguments: tool.arguments,
    status: "executing",
  };

  setMessages((prev) =>
    prev.map((msg) => {
      if (msg.id === assistantId) {
        const existing = msg.toolCalls || [];
        const isDupe = existing.some((tc: ToolCallItem) => tc.id === toolCallItem.id);
        return {
          ...msg,
          toolCalls: isDupe ? existing : [...existing, toolCallItem],
        };
      }
      return msg;
    })
  );

  try {
    const resultStr = await executeAiToolCall(tool.name, tool.arguments);
    let updatedText = "";

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === assistantId) {
          const updatedToolCalls = (msg.toolCalls || []).map((tc: ToolCallItem) =>
            tc.id === tool.id ? { ...tc, status: "success" as const, result: resultStr } : tc
          );
          const text = msg.content && msg.content.trim()
            ? msg.content
            : formatToolFallbackResponse(updatedToolCalls);
          updatedText = text;
          return { ...msg, content: text, toolCalls: updatedToolCalls };
        }
        return msg;
      })
    );

    if (sessionId && updatedText) {
      persistChatMessage({
        id: assistantId,
        sessionId,
        role: "assistant",
        content: updatedText,
        createdAt: Date.now(),
      }).catch(() => {});
    }

    if (!isTauriEnvironment() && typeof window !== "undefined") {
      const lowerName = tool.name.toLowerCase();
      const entity = lowerName.includes("calendar")
        ? "calendar_events"
        : lowerName.includes("task")
        ? "tasks"
        : lowerName.includes("goal")
        ? "goals"
        : "all";
      const action = lowerName.startsWith("delete") ? "delete" : "update";
      window.dispatchEvent(
        new CustomEvent("focushud:db-change", {
          detail: { entity, action },
        })
      );
      if (entity === "tasks") {
        window.dispatchEvent(
          new CustomEvent("focushud:db-change", {
            detail: { entity: "calendar_events", action: "update" },
          })
        );
      }
    }

    return resultStr;
  } catch (err: unknown) {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantId
          ? {
              ...msg,
              toolCalls: (msg.toolCalls || []).map((tc: ToolCallItem) =>
                tc.id === tool.id ? { ...tc, status: "error" as const } : tc
              ),
            }
          : msg
      )
    );
    return JSON.stringify({ status: "error", error: String(err) });
  }
}

export function finalizeTurnMessage(
  assistantId: string,
  rawContent: string,
  setMessages: Dispatch<SetStateAction<ChatMessageItem[]>>,
  sessionId: string | null
): void {
  setMessages((prev) =>
    prev.map((msg) => {
      if (msg.id === assistantId) {
        const text = rawContent.trim()
          ? rawContent
          : msg.content.trim()
          ? msg.content
          : formatToolFallbackResponse(msg.toolCalls);
        return { ...msg, content: text };
      }
      return msg;
    })
  );

  if (sessionId) {
    setMessages((latest) => {
      const currentMsg = latest.find((m) => m.id === assistantId);
      if (currentMsg && currentMsg.content) {
        persistChatMessage({
          id: assistantId,
          sessionId,
          role: "assistant",
          content: currentMsg.content,
          createdAt: Date.now(),
        }).catch(() => {});
      }
      return latest;
    });
  }
}
