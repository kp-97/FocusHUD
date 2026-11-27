import { useEffect, useRef } from "react";
import type { ChatMessageItem, AiProvider } from "../../types/ai";
import { DEFAULT_AI_TOOLS } from "../../types/ai";
import { replaceChatMessages } from "../../services/aiService";
import { calculateContextBreakdown } from "./tokenCounter";
import { resolveEffectiveContextLimit } from "./gpuContextCalculator";

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

  // Atomically replace the stored messages in SQLite/localStorage so old bloated messages don't re-emerge
  await replaceChatMessages(sessionId, compacted).catch(() => {});

  return compacted;
}

export function shouldTriggerThresholdCompaction(
  messages: ChatMessageItem[],
  thresholdPct: number,
  model = "llama3.2",
  systemPrompt = "",
  contextSize?: number | "auto",
  provider: AiProvider = "ollama"
): boolean {
  if (thresholdPct <= 0 || messages.length <= 2) return false;
  const maxTokens = resolveEffectiveContextLimit(contextSize, model, provider);
  const breakdown = calculateContextBreakdown(
    messages,
    model,
    systemPrompt,
    DEFAULT_AI_TOOLS,
    maxTokens
  );
  return breakdown.pctUsed >= thresholdPct;
}

export function useAutoCompaction(
  sessionId: string | null,
  messages: ChatMessageItem[],
  isGenerating: boolean,
  thresholdPct = 70,
  onCompacted?: (compacted: ChatMessageItem[]) => void,
  model = "llama3.2",
  systemPrompt = "",
  contextSize?: number | "auto",
  provider: AiProvider = "ollama"
): void {
  const isCompactingRef = useRef(false);

  useEffect(() => {
    if (!sessionId || isGenerating || thresholdPct <= 0 || messages.length <= 2) {
      return;
    }
    if (isCompactingRef.current) return;

    const shouldCompact = shouldTriggerThresholdCompaction(
      messages,
      thresholdPct,
      model,
      systemPrompt,
      contextSize,
      provider
    );

    if (shouldCompact) {
      isCompactingRef.current = true;
      compactSession(sessionId, messages)
        .then((compacted) => {
          if (onCompacted) {
            onCompacted(compacted);
          }
        })
        .catch(() => {})
        .finally(() => {
          isCompactingRef.current = false;
        });
    }
  }, [
    sessionId,
    messages,
    isGenerating,
    thresholdPct,
    onCompacted,
    model,
    systemPrompt,
    contextSize,
    provider,
  ]);
}
