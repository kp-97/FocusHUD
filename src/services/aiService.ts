import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { isTauriEnvironment } from "./dbService";
import { formatDateToISO } from "../utils/formatters";
import { resolveEffectiveContextLimit } from "../features/chat/gpuContextCalculator";
import {
  AiSettingsConfig,
  DEFAULT_AI_SETTINGS,
  ChatSessionItem,
  ChatMessageItem,
  ChatMessageParam,
  StreamChunkPayload,
  ToolCallItem,
} from "../types/ai";

const AI_SETTINGS_STORAGE_KEY = "focushud_ai_settings";

export function loadAiSettings(): AiSettingsConfig {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT_AI_SETTINGS };
}

export async function fetchAiSettingsFromDb(): Promise<AiSettingsConfig> {
  if (!isTauriEnvironment()) {
    return loadAiSettings();
  }
  try {
    const dbValue = await invoke<string | null>("get_ai_config");
    if (dbValue) {
      const parsed = JSON.parse(dbValue);
      const merged = { ...DEFAULT_AI_SETTINGS, ...parsed };
      localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch {}
  return loadAiSettings();
}

export function saveAiSettings(settings: AiSettingsConfig): void {
  try {
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event("storage"));
  } catch {}

  if (isTauriEnvironment()) {
    invoke("save_ai_config", { config: JSON.stringify(settings) }).catch(() => {});
  }
}

export async function fetchChatSessions(): Promise<ChatSessionItem[]> {
  if (!isTauriEnvironment()) {
    try {
      const raw = localStorage.getItem("focushud_mock_chat_sessions");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  return invoke<ChatSessionItem[]>("get_chat_sessions");
}

export async function persistChatSession(session: ChatSessionItem): Promise<void> {
  if (!isTauriEnvironment()) {
    try {
      const sessions = await fetchChatSessions();
      const filtered = sessions.filter((s) => s.id !== session.id);
      localStorage.setItem("focushud_mock_chat_sessions", JSON.stringify([session, ...filtered]));
    } catch {}
    return;
  }
  return invoke("save_chat_session", { session });
}

export async function removeChatSession(id: string): Promise<void> {
  if (!isTauriEnvironment()) {
    try {
      const sessions = await fetchChatSessions();
      localStorage.setItem(
        "focushud_mock_chat_sessions",
        JSON.stringify(sessions.filter((s) => s.id !== id))
      );
    } catch {}
    return;
  }
  return invoke("delete_chat_session", { id });
}

export async function fetchChatMessages(sessionId: string): Promise<ChatMessageItem[]> {
  if (!isTauriEnvironment()) {
    try {
      const raw = localStorage.getItem(`focushud_mock_chat_messages_${sessionId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  const rawList = await invoke<any[]>("get_chat_messages", { sessionId });
  return rawList.map((m) => {
    const parsed = parseToolCallsMetadata(m.toolCalls);
    return {
      id: m.id,
      sessionId: m.sessionId,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      toolCalls: parsed.toolCalls,
      durationMs: parsed.durationMs,
    };
  });
}

function serializeToolCallsPayload(
  toolCalls?: ToolCallItem[],
  durationMs?: number
): string | null {
  if (!toolCalls?.length && durationMs === undefined) return null;
  return JSON.stringify({
    toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    durationMs,
  });
}

function parseToolCallsMetadata(raw?: string | null): {
  toolCalls?: ToolCallItem[];
  durationMs?: number;
} {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { toolCalls: parsed };
    }
    if (parsed && typeof parsed === "object") {
      return {
        toolCalls: Array.isArray(parsed.toolCalls) ? parsed.toolCalls : undefined,
        durationMs: typeof parsed.durationMs === "number" ? parsed.durationMs : undefined,
      };
    }
    return {};
  } catch {
    return {};
  }
}

export async function persistChatMessage(msg: ChatMessageItem): Promise<void> {
  if (!isTauriEnvironment()) {
    try {
      const list = await fetchChatMessages(msg.sessionId);
      const filtered = list.filter((m) => m.id !== msg.id);
      localStorage.setItem(
        `focushud_mock_chat_messages_${msg.sessionId}`,
        JSON.stringify([...filtered, msg])
      );
    } catch {}
    return;
  }
  return invoke("save_chat_message", {
    message: {
      id: msg.id,
      sessionId: msg.sessionId,
      role: msg.role,
      content: msg.content,
      toolCalls: serializeToolCallsPayload(msg.toolCalls, msg.durationMs),
      createdAt: msg.createdAt,
    },
  });
}

export async function replaceChatMessages(
  sessionId: string,
  messages: ChatMessageItem[]
): Promise<void> {
  if (!isTauriEnvironment()) {
    try {
      localStorage.setItem(
        `focushud_mock_chat_messages_${sessionId}`,
        JSON.stringify(messages)
      );
    } catch {}
    return;
  }
  const dbMessages = messages.map((m) => ({
    id: m.id,
    session_id: sessionId,
    role: m.role,
    content: m.content || null,
    tool_calls: serializeToolCallsPayload(m.toolCalls, m.durationMs),
    created_at: m.createdAt,
  }));
  return invoke("replace_chat_messages", {
    sessionId,
    messages: dbMessages,
  });
}

export async function executeAiToolCall(name: string, args: string): Promise<string> {
  if (!isTauriEnvironment()) {
    return JSON.stringify({ status: "success", message: `Executed ${name} in browser simulation mode` });
  }
  return invoke<string>("execute_ai_tool", { name, arguments: args });
}

export async function fetchAvailableModels(
  provider: string,
  endpoint?: string,
  apiKey?: string
): Promise<string[]> {
  if (!isTauriEnvironment()) {
    if (provider === "ollama") return ["llama3.2", "mistral", "qwen2.5"];
    if (provider === "openai") return ["gpt-4o", "gpt-4o-mini", "gemma-4-12b-qat"];
    if (provider === "anthropic") return ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"];
    return ["gemini-1.5-flash", "gemini-1.5-pro"];
  }
  return invoke<string[]>("fetch_ai_models", {
    provider,
    endpoint: endpoint || null,
    apiKey: apiKey || null,
  });
}

export async function streamChat(
  sessionId: string,
  messages: Array<ChatMessageParam>,
  settings: AiSettingsConfig,
  tools?: any[]
): Promise<void> {
  if (!isTauriEnvironment()) {
    // Browser mock simulation with character streaming
    simulateBrowserStreaming(sessionId);
    return;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const localIso = formatDateToISO(now);
  const timeContext = `Current System Date & Time: ${dateStr}, ${timeStr} (local time). Today's local date (YYYY-MM-DD): ${localIso}. When querying or scheduling for "today", use date "${localIso}".`;
  const basePrompt = settings.systemPrompt?.trim() || "You are FocusHUD Tactical AI Assistant.";
  const effectiveSystemPrompt = `${basePrompt}\n\n${timeContext}`;
  const effectiveContextSize = resolveEffectiveContextLimit(
    settings.contextSize,
    settings.model,
    settings.provider
  );

  return invoke("stream_chat_completion", {
    request: {
      sessionId,
      provider: settings.provider,
      model: settings.model,
      apiKey: settings.apiKey || null,
      endpoint: settings.endpoint || null,
      systemPrompt: effectiveSystemPrompt,
      messages,
      temperature: settings.temperature,
      tools: settings.enableTools ? tools : null,
      contextSize: effectiveContextSize,
    },
  });
}

export async function abortChatStream(sessionId: string): Promise<void> {
  if (isTauriEnvironment()) {
    return invoke("abort_chat_stream", { sessionId });
  }
}

type StreamChunkCallback = (payload: StreamChunkPayload) => void;
const chunkListeners = new Set<StreamChunkCallback>();
let tauriUnlistenPromise: Promise<UnlistenFn> | null = null;
let tauriUnlistenFn: UnlistenFn | null = null;

export async function onStreamChunk(callback: StreamChunkCallback): Promise<UnlistenFn> {
  chunkListeners.add(callback);

  if (isTauriEnvironment()) {
    if (!tauriUnlistenPromise) {
      tauriUnlistenPromise = listen<StreamChunkPayload>("ai:stream-chunk", (event) => {
        chunkListeners.forEach((cb) => {
          try {
            cb(event.payload);
          } catch {}
        });
      });
      tauriUnlistenFn = await tauriUnlistenPromise;
    }
  } else {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<StreamChunkPayload>).detail;
      callback(detail);
    };
    window.addEventListener("ai:mock-stream-chunk", handler);
    return Promise.resolve(() => {
      chunkListeners.delete(callback);
      window.removeEventListener("ai:mock-stream-chunk", handler);
    });
  }

  return () => {
    chunkListeners.delete(callback);
    if (chunkListeners.size === 0 && tauriUnlistenFn) {
      tauriUnlistenFn();
      tauriUnlistenFn = null;
      tauriUnlistenPromise = null;
    }
  };
}

function simulateBrowserStreaming(sessionId: string): void {
  const responses = [
    "Analyzing system telemetry... All core processes are operating within nominal thresholds. Memory allocation is stable and latency is minimal.",
    "Tactical action plan registered. Task breakdown complete: 1 primary goal and 3 actionable milestones.",
    "FocusHUD diagnostics show optimal Win32 desktop region clipping. Multi-dock layout synchronized.",
  ];
  const resp = responses[Math.floor(Math.random() * responses.length)];

  let index = 0;
  const timer = setInterval(() => {
    index += 3;
    const slice = resp.slice(index - 3, index);
    if (slice) {
      window.dispatchEvent(
        new CustomEvent<StreamChunkPayload>("ai:mock-stream-chunk", {
          detail: { sessionId, chunkType: "text", delta: slice },
        })
      );
    }
    if (index >= resp.length) {
      clearInterval(timer);
      window.dispatchEvent(
        new CustomEvent<StreamChunkPayload>("ai:mock-stream-chunk", {
          detail: { sessionId, chunkType: "done", delta: "" },
        })
      );
    }
  }, 30);
}
