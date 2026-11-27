use crate::ai::models::ToolDefinition;
use serde_json::json;

pub fn get_default_tools() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "get_current_time".to_string(),
            description: "Retrieves the current local date, time, day of the week, and timezone".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {}
            }),
        },
        ToolDefinition {
            name: "get_workspace_summary".to_string(),
            description: "Retrieves a summary of the current FocusHUD workspace including task counts, active goals, and scheduled events".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {}
            }),
        },
        ToolDefinition {
            name: "get_tasks".to_string(),
            description: "Retrieves tasks from FocusHUD with optional filters for status or priority".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "Filter by status: 'todo', 'in_progress', 'done', 'pending', or 'all' (default: 'pending')",
                        "enum": ["all", "pending", "todo", "in_progress", "done"]
                    },
                    "priority": {
                        "type": "integer",
                        "description": "Optional priority filter: 1 (Urgent), 2 (High), 3 (Medium), 4 (Low)"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max number of tasks to return (default: 20)"
                    }
                }
            }),
        },
        ToolDefinition {
            name: "get_goals".to_string(),
            description: "Retrieves high-level strategic goals from FocusHUD".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "Filter by status: 'active', 'completed', or 'all' (default: 'active')",
                        "enum": ["all", "active", "completed"]
                    }
                }
            }),
        },
        ToolDefinition {
            name: "get_pomodoro_status".to_string(),
            description: "Retrieves the current status of the FocusHUD Pomodoro focus timer".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {}
            }),
        },
        ToolDefinition {
            name: "create_task".to_string(),
            description: "Creates a new task in FocusHUD".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "Title of the task" },
                    "description": { "type": "string", "description": "Optional details about the task" },
                    "priority": { "type": "integer", "description": "Priority: 1 (Urgent), 2 (High), 3 (Medium), 4 (Low)" },
                    "dueDate": { "type": "string", "description": "Due date in YYYY-MM-DD format" }
                },
                "required": ["title"]
            }),
        },
        ToolDefinition {
            name: "update_task".to_string(),
            description: "Updates an existing task's status, priority, due date, or title".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "ID of the task to update" },
                    "title": { "type": "string", "description": "Updated title of the task" },
                    "status": { "type": "string", "description": "Status: 'todo', 'in_progress', or 'done'" },
                    "priority": { "type": "integer", "description": "Priority: 1-4" },
                    "dueDate": { "type": "string", "description": "Due date in YYYY-MM-DD format" },
                    "description": { "type": "string", "description": "Updated details" }
                },
                "required": ["id"]
            }),
        },
        ToolDefinition {
            name: "delete_task".to_string(),
            description: "Deletes a task by ID".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "ID of the task to delete" }
                },
                "required": ["id"]
            }),
        },
        ToolDefinition {
            name: "create_goal".to_string(),
            description: "Creates a top-level or strategic goal in FocusHUD".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "Title of the goal" },
                    "description": { "type": "string", "description": "Optional details about the goal" },
                    "targetDate": { "type": "string", "description": "Target completion date in YYYY-MM-DD format" }
                },
                "required": ["title"]
            }),
        },
        ToolDefinition {
            name: "update_goal".to_string(),
            description: "Updates an existing strategic goal status, title, description, or target date in FocusHUD".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "ID of the goal to update" },
                    "title": { "type": "string", "description": "Updated goal title" },
                    "description": { "type": "string", "description": "Updated details" },
                    "status": { "type": "string", "description": "Status: 'active', 'completed', or 'archived'" },
                    "targetDate": { "type": "string", "description": "Target date in YYYY-MM-DD format" },
                    "progress": { "type": "integer", "description": "Progress percentage (0-100)" }
                },
                "required": ["id"]
            }),
        },
        ToolDefinition {
            name: "delete_goal".to_string(),
            description: "Deletes a strategic goal by ID in FocusHUD".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "ID of the goal to delete" }
                },
                "required": ["id"]
            }),
        },
        ToolDefinition {
            name: "control_pomodoro".to_string(),
            description: "Controls the FocusHUD Pomodoro focus timer (start, pause, reset, skip, or stop)".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "action": { "type": "string", "description": "Action: 'start', 'pause', 'reset', 'skip', or 'stop'" },
                    "mode": { "type": "string", "description": "Optional mode: 'focus', 'short_break', or 'long_break'" },
                    "durationMinutes": { "type": "integer", "description": "Optional custom duration in minutes" }
                },
                "required": ["action"]
            }),
        },
        ToolDefinition {
            name: "search_notes".to_string(),
            description: "Searches existing markdown notes in FocusHUD by title or content keywords".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Keyword query to search in note titles and contents" },
                    "limit": { "type": "integer", "description": "Max number of notes to return (default: 10)" }
                }
            }),
        },
        ToolDefinition {
            name: "read_note".to_string(),
            description: "Reads the full content and metadata of a note in FocusHUD by ID or title".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "Unique ID of the note" },
                    "title": { "type": "string", "description": "Exact or case-insensitive title of the note" }
                }
            }),
        },
        ToolDefinition {
            name: "create_note".to_string(),
            description: "Creates a new markdown note document in FocusHUD on disk and in database".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "Title of the note document" },
                    "content": { "type": "string", "description": "Markdown body content of the note" },
                    "folder": { "type": "string", "description": "Optional subfolder relative path" }
                },
                "required": ["title"]
            }),
        },
        ToolDefinition {
            name: "update_note".to_string(),
            description: "Updates or appends content to an existing markdown note document in FocusHUD".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "Unique ID of the note to update" },
                    "title": { "type": "string", "description": "Updated note title" },
                    "content": { "type": "string", "description": "New content or content to append" },
                    "append": { "type": "boolean", "description": "If true, appends content to note; if false, overwrites (default: false)" }
                },
                "required": ["id"]
            }),
        },
        ToolDefinition {
            name: "get_system_diagnostics".to_string(),
            description: "Retrieves real-time system performance telemetry (CPU, RAM, GPU utilization and temperature)".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {}
            }),
        },
        ToolDefinition {
            name: "get_calendar_events".to_string(),
            description: "Retrieves scheduled calendar events with optional date range or keyword filtering".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "startDate": { "type": "string", "description": "Filter events on or after YYYY-MM-DD" },
                    "endDate": { "type": "string", "description": "Filter events on or before YYYY-MM-DD" },
                    "query": { "type": "string", "description": "Optional keyword search in event title or description" },
                    "includeTasks": { "type": "boolean", "description": "Whether to include tasks appearing on the calendar (default: true)" },
                    "limit": { "type": "integer", "description": "Max events to return (default: 30)" }
                }
            }),
        },
        ToolDefinition {
            name: "create_calendar_event".to_string(),
            description: "Creates and schedules a new calendar event in FocusHUD".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "Event title" },
                    "date": { "type": "string", "description": "Event date in YYYY-MM-DD format" },
                    "startTime": { "type": "string", "description": "Start time in HH:mm 24-hour format (e.g. '14:30')" },
                    "endTime": { "type": "string", "description": "End time in HH:mm 24-hour format (e.g. '15:30')" },
                    "description": { "type": "string", "description": "Optional event details or notes" },
                    "location": { "type": "string", "description": "Optional event location or meeting link" },
                    "isAllDay": { "type": "boolean", "description": "Whether the event lasts all day (default: false)" },
                    "recurrence": { "type": "string", "description": "Recurrence rule: 'none', 'daily', 'weekly', 'monthly', 'annually' (default: 'none')" },
                    "color": { "type": "string", "description": "Hex color code for event (default: '#00e5ff')" }
                },
                "required": ["title", "date", "startTime", "endTime"]
            }),
        },
        ToolDefinition {
            name: "update_calendar_event".to_string(),
            description: "Updates an existing scheduled calendar event in FocusHUD".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "ID of the event to update" },
                    "title": { "type": "string", "description": "Updated event title" },
                    "date": { "type": "string", "description": "Updated date in YYYY-MM-DD format" },
                    "startTime": { "type": "string", "description": "Updated start time in HH:mm format" },
                    "endTime": { "type": "string", "description": "Updated end time in HH:mm format" },
                    "description": { "type": "string", "description": "Updated description" },
                    "location": { "type": "string", "description": "Updated location" },
                    "isAllDay": { "type": "boolean", "description": "Whether event is all-day" },
                    "recurrence": { "type": "string", "description": "Updated recurrence rule" },
                    "color": { "type": "string", "description": "Updated hex color code" }
                },
                "required": ["id"]
            }),
        },
        ToolDefinition {
            name: "delete_calendar_event".to_string(),
            description: "Deletes a scheduled calendar event by ID".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "ID of the event to delete" }
                },
                "required": ["id"]
            }),
        },
    ]
}
