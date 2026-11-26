import { useEffect, useRef } from "react";
import type { ChatMessageItem } from "../../types/ai";
import { persistChatMessage } from "../../services/aiService";

export function generateCompactSummary(messages: ChatMessageItem[]): string {
  const userPrompts: string[] = [];
  const toolsUsed = new Set<string>();
  const recentOutputs: string[] = [];

  for (const m of messages) {
    if (m.role === "user" && m.content) {
      userPrompts.push(m.content.trim());
    } else if (m.role === "assistant") {
      if (m.toolCalls && m.toolCalls.length > 0) {
        m.toolCalls.forEach((tc) => toolsUsed.add(tc.name));
      }
      if (m.content && m.content.length > 0) {
        recentOutputs.push(m.content.slice(0, 150));
      }
    }
  }

  const promptSummary = userPrompts.length > 0
    ? userPrompts.slice(-3).map((p) => `- "${p.length > 80 ? p.slice(0, 77) + "..." : p}"`).join("\n")
    : "- General workflow queries";

  const toolsSummary = toolsUsed.size > 0
    ? Array.from(toolsUsed).map((t) => `\`${t}\``).join(", ")
    : "None";

  const lastOutcome = recentOutputs.length > 0
    ? recentOutputs[recentOutputs.length - 1].trim().replace(/\n/g, " ")
    : "State synchronized.";

  return `### 🗜️ Context Compaction Checkpoint
*Previous turns (${messages.length} messages) compacted to preserve context tokens:*
**Key User Queries:**
${promptSummary}

**Tools Leveraged:** ${toolsSummary}
**Latest Milestone:** ${lastOutcome.slice(0, 200)}`;
}

export async function compactSession(
  sessionId: string,
  messages: ChatMessageItem[]
): Promise<ChatMessageItem[]> {
  if (messages.length <= 2) return messages;

  const summary = generateCompactSummary(messages);

  const checkpointMsg: ChatMessageItem = {
    id: `compact_${Date.now()}`,
    sessionId,
    role: "assistant",
    content: summary,
    createdAt: Date.now(),
  };

  await persistChatMessage(checkpointMsg).catch(() => {});

  // Keep checkpoint + latest user turn if applicable
  const latestUser = [...messages].reverse().find((m) => m.role === "user");
  const latestAssistant = messages[messages.length - 1]?.role === "assistant"
    ? messages[messages.length - 1]
    : undefined;

  const compacted: ChatMessageItem[] = [checkpointMsg];
  if (latestUser && latestUser.id !== messages[0]?.id) {
    compacted.push(latestUser);
  }
  if (latestAssistant && latestAssistant.id !== checkpointMsg.id && latestAssistant !== latestUser) {
    compacted.push(latestAssistant);
  }

  return compacted;
}

export function useAutoCompaction(
  sessionId: string | null,
  messages: ChatMessageItem[],
  isGenerating: boolean,
  autoCompactMinutes = 1,
  onCompacted?: (compacted: ChatMessageItem[]) => void
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!sessionId || isGenerating || autoCompactMinutes <= 0 || messages.length <= 3) {
      return;
    }

    const ms = autoCompactMinutes * 60 * 1000;
    timerRef.current = setTimeout(async () => {
      try {
        const compacted = await compactSession(sessionId, messages);
        if (onCompacted) {
          onCompacted(compacted);
        }
      } catch {}
    }, ms);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [sessionId, messages, isGenerating, autoCompactMinutes, onCompacted]);
}
