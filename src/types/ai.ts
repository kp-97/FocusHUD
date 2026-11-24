export type AiProvider = "openai" | "anthropic" | "gemini" | "ollama";

export interface AiSettingsConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
  endpoint: string;
  systemPrompt: string;
  temperature: number;
  enableTools: boolean;
  enableContext: boolean;
}

export const DEFAULT_AI_SETTINGS: AiSettingsConfig = {
  provider: "ollama",
  model: "llama3.2",
  apiKey: "",
  endpoint: "http://localhost:11434/api/chat",
  systemPrompt:
    "You are FocusHUD Tactical Intelligence, an advanced desktop cybernetic companion. Be concise, actionable, and tactical in your responses. When the user asks about their tasks, goals, focus timer, or system hardware, use the provided tools to query or update their workspace.",
  temperature: 0.7,
  enableTools: true,
  enableContext: true,
};

export const PROVIDER_DEFAULT_MODELS: Record<AiProvider, { defaultModel: string; endpoint?: string }> = {
  openai: {
    defaultModel: "gpt-4o-mini",
    endpoint: "https://api.openai.com/v1/chat/completions",
  },
  anthropic: {
    defaultModel: "claude-3-5-sonnet-20241022",
    endpoint: "https://api.anthropic.com/v1/messages",
  },
  gemini: {
    defaultModel: "gemini-1.5-flash",
  },
  ollama: {
    defaultModel: "llama3.2",
    endpoint: "http://localhost:11434/api/chat",
  },
};

export interface ChatSessionItem {
  id: string;
  title: string;
  provider: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface ToolCallItem {
  id: string;
  name: string;
  arguments: string;
  result?: string;
  status?: "pending" | "executing" | "success" | "error";
}

export interface ChatMessageItem {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCallItem[];
  createdAt: number;
}

export interface StreamChunkPayload {
  sessionId: string;
  chunkType: "text" | "tool_call" | "done" | "error";
  delta: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
}

export const DEFAULT_AI_TOOLS = [
  {
    name: "get_workspace_summary",
    description: "Retrieve a summary of the current FocusHUD workspace including task counts, active goals, and scheduled events",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_tasks",
    description: "Retrieve tasks from FocusHUD with optional filters for status or priority",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by status: 'todo', 'in_progress', 'done', 'pending', or 'all' (default: 'pending')",
          enum: ["all", "pending", "todo", "in_progress", "done"],
        },
        priority: {
          type: "integer",
          description: "Optional priority filter: 1 (Urgent), 2 (High), 3 (Medium), 4 (Low)",
        },
        limit: {
          type: "integer",
          description: "Max number of tasks to return (default: 20)",
        },
      },
    },
  },
  {
    name: "get_goals",
    description: "Retrieve high-level strategic goals from FocusHUD",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by status: 'active', 'completed', or 'all' (default: 'active')",
          enum: ["all", "active", "completed"],
        },
      },
    },
  },
  {
    name: "get_pomodoro_status",
    description: "Retrieve the current status of the FocusHUD Pomodoro focus timer",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_task",
    description: "Create a new actionable task in FocusHUD",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the task" },
        description: { type: "string", description: "Optional notes or details" },
        priority: { type: "integer", description: "1 (Urgent), 2 (High), 3 (Medium), 4 (Low)" },
        dueDate: { type: "string", description: "Due date in YYYY-MM-DD format" },
      },
      required: ["title"],
    },
  },
  {
    name: "create_goal",
    description: "Create a new high-level strategic goal in FocusHUD",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the goal" },
        description: { type: "string", description: "Details of the goal" },
        targetDate: { type: "string", description: "Target completion date in YYYY-MM-DD format" },
      },
      required: ["title"],
    },
  },
  {
    name: "get_system_diagnostics",
    description: "Retrieve real-time FocusHUD CPU, memory, uptime, and display telemetry",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];
