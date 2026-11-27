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
  autoCompactMinutes?: number;
  autoCompactThresholdPct?: number;
  contextSize?: number | "auto";
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
  autoCompactMinutes: 0,
  autoCompactThresholdPct: 70,
  contextSize: "auto",
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
  durationMs?: number;
  step?: number;
}

export interface ChatMessageItem {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCallItem[];
  createdAt: number;
  durationMs?: number;
}

export interface ChatMessageParam {
  role: string;
  content?: string | null;
  toolCalls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  toolCallId?: string;
  name?: string;
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
    name: "get_current_time",
    description: "Retrieve the current local date, time, day of the week, and timezone",
    parameters: {
      type: "object",
      properties: {},
    },
  },
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
    name: "update_task",
    description: "Update an existing task's status, priority, due date, or title in FocusHUD",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the task to update" },
        title: { type: "string", description: "Updated title of the task" },
        status: { type: "string", description: "Status: 'todo', 'in_progress', or 'done'" },
        priority: { type: "integer", description: "Priority: 1-4" },
        dueDate: { type: "string", description: "Due date in YYYY-MM-DD format" },
        description: { type: "string", description: "Updated details" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_task",
    description: "Delete a task by ID in FocusHUD",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the task to delete" },
      },
      required: ["id"],
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
    name: "update_goal",
    description: "Update an existing strategic goal status, title, description, or target date in FocusHUD",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the goal to update" },
        title: { type: "string", description: "Updated goal title" },
        description: { type: "string", description: "Updated details" },
        status: { type: "string", description: "Status: 'active', 'completed', or 'archived'" },
        targetDate: { type: "string", description: "Target date in YYYY-MM-DD format" },
        progress: { type: "integer", description: "Progress percentage (0-100)" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_goal",
    description: "Delete a strategic goal by ID in FocusHUD",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the goal to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "control_pomodoro",
    description: "Control the FocusHUD Pomodoro focus timer (start, pause, reset, skip, or stop)",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Action to perform: 'start', 'pause', 'reset', 'skip', or 'stop'",
          enum: ["start", "pause", "reset", "skip", "stop"],
        },
        mode: {
          type: "string",
          description: "Optional mode: 'focus', 'short_break', or 'long_break'",
          enum: ["focus", "short_break", "long_break"],
        },
        durationMinutes: {
          type: "integer",
          description: "Optional custom duration in minutes",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "search_notes",
    description: "Search existing markdown notes in FocusHUD by title or content keywords",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword query to search in note titles and contents" },
        limit: { type: "integer", description: "Max number of notes to return (default: 10)" },
      },
    },
  },
  {
    name: "read_note",
    description: "Read the full markdown content and metadata of a note in FocusHUD by ID or title",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Unique ID of the note" },
        title: { type: "string", description: "Exact or case-insensitive title of the note" },
      },
    },
  },
  {
    name: "create_note",
    description: "Create a new markdown note document in FocusHUD on disk and in database",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the note document" },
        content: { type: "string", description: "Markdown body content of the note" },
        folder: { type: "string", description: "Optional subfolder relative path" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_note",
    description: "Update or append markdown content to an existing note document in FocusHUD",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Unique ID of the note to update" },
        title: { type: "string", description: "Updated note title" },
        content: { type: "string", description: "New content or content to append" },
        append: { type: "boolean", description: "If true, appends content; if false, overwrites (default: false)" },
      },
      required: ["id"],
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
  {
    name: "get_calendar_events",
    description: "Retrieve scheduled calendar events with optional date range or keyword filtering",
    parameters: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Filter events on or after YYYY-MM-DD" },
        endDate: { type: "string", description: "Filter events on or before YYYY-MM-DD" },
        query: { type: "string", description: "Optional keyword search in event title or description" },
        includeTasks: { type: "boolean", description: "Whether to include tasks appearing on the calendar (default: true)" },
        limit: { type: "integer", description: "Max events to return (default: 30)" },
      },
    },
  },
  {
    name: "create_calendar_event",
    description: "Create and schedule a new calendar event in FocusHUD",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Event title" },
        date: { type: "string", description: "Event date in YYYY-MM-DD format" },
        startTime: { type: "string", description: "Start time in HH:mm 24-hour format (e.g. '14:30')" },
        endTime: { type: "string", description: "End time in HH:mm 24-hour format (e.g. '15:30')" },
        description: { type: "string", description: "Optional event details or notes" },
        location: { type: "string", description: "Optional event location or meeting link" },
        isAllDay: { type: "boolean", description: "Whether the event lasts all day (default: false)" },
        recurrence: { type: "string", description: "Recurrence rule: 'none', 'daily', 'weekly', 'monthly', 'annually' (default: 'none')" },
        color: { type: "string", description: "Hex color code for event (default: '#00e5ff')" },
      },
      required: ["title", "date", "startTime", "endTime"],
    },
  },
  {
    name: "update_calendar_event",
    description: "Update an existing scheduled calendar event in FocusHUD",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the event to update" },
        title: { type: "string", description: "Updated event title" },
        date: { type: "string", description: "Updated date in YYYY-MM-DD format" },
        startTime: { type: "string", description: "Updated start time in HH:mm format" },
        endTime: { type: "string", description: "Updated end time in HH:mm format" },
        description: { type: "string", description: "Updated description" },
        location: { type: "string", description: "Updated location" },
        isAllDay: { type: "boolean", description: "Whether event is all-day" },
        recurrence: { type: "string", description: "Updated recurrence rule" },
        color: { type: "string", description: "Updated hex color code" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_calendar_event",
    description: "Delete a scheduled calendar event by ID",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the event to delete" },
      },
      required: ["id"],
    },
  },
];
