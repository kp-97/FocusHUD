use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Goal {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_goal_status")]
    pub status: String,
    pub target_date: Option<String>,
    #[serde(default)]
    pub sort_order: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

fn default_goal_status() -> String {
    "active".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub parent_id: Option<String>,
    pub goal_id: Option<String>,
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_task_status")]
    pub status: String,
    #[serde(default = "default_task_priority")]
    pub priority: i32,
    pub due_date: Option<String>,
    pub estimated_minutes: Option<i32>,
    #[serde(default)]
    pub sort_order: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

fn default_task_status() -> String {
    "todo".to_string()
}

fn default_task_priority() -> i32 {
    3
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ActionPlan {
    pub id: String,
    pub parent_id: Option<String>,
    pub goal_id: Option<String>,
    pub task_id: Option<String>,
    pub title: String,
    #[serde(default)]
    pub content: String,
    #[serde(default = "default_plan_status")]
    pub status: String,
    #[serde(default)]
    pub sort_order: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

fn default_plan_status() -> String {
    "draft".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub parent_id: Option<String>,
    pub goal_id: Option<String>,
    pub task_id: Option<String>,
    pub action_plan_id: Option<String>,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub is_pinned: bool,
    #[serde(default)]
    pub sort_order: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

/// DTO for cross-dock real-time cache event broadcast
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DbChangePayload {
    pub entity: String, // "goals", "tasks", "action_plans", "notes"
    pub action: String, // "create", "update", "delete", "migrate"
    pub id: Option<String>,
}

/// DTOs for importing legacy v0.1.x localStorage data
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyGoalNode {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub completed: bool,
    pub completed_at: Option<String>,
    pub parent_id: Option<String>,
    pub children: Option<Vec<LegacyGoalNode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyTaskItem {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub completed: bool,
    pub completed_at: Option<String>,
    pub goal_id: Option<String>,
    pub parent_id: Option<String>,
    pub status: Option<String>,
    pub subtasks: Option<Vec<LegacyTaskItem>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyActionPlanNode {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub completed: bool,
    pub completed_at: Option<String>,
    pub parent_id: Option<String>,
    pub children: Option<Vec<LegacyActionPlanNode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyStorageData {
    pub goals: Option<Vec<LegacyGoalNode>>,
    pub tasks: Option<Vec<LegacyTaskItem>>,
    pub action_plans: Option<Vec<LegacyActionPlanNode>>,
}
