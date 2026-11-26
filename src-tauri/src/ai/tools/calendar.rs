use super::ID_COUNTER;
use crate::db::models::CalendarEvent;
use crate::db::queries::common::current_timestamp_ms;
use crate::db::queries::{
    delete_calendar_event as db_delete_calendar_event, get_all_calendar_events, get_all_tasks,
    upsert_calendar_event,
};
use chrono::{Datelike, NaiveDate, Weekday};
use rusqlite::Connection;
use serde_json::json;
use std::sync::atomic::Ordering;

pub fn is_event_occurring_on_date(
    event_date_str: &str,
    target_date_str: &str,
    recurrence: Option<&str>,
) -> bool {
    let rec = recurrence.unwrap_or("none");
    if rec == "none" || rec.is_empty() {
        return event_date_str == target_date_str;
    }

    if target_date_str < event_date_str {
        return false;
    }

    let Ok(event_date) = NaiveDate::parse_from_str(event_date_str, "%Y-%m-%d") else {
        return event_date_str == target_date_str;
    };
    let Ok(target_date) = NaiveDate::parse_from_str(target_date_str, "%Y-%m-%d") else {
        return false;
    };

    match rec {
        "daily" => true,
        "weekday" => {
            let wd = target_date.weekday();
            wd != Weekday::Sat && wd != Weekday::Sun
        }
        "weekly" => target_date.weekday() == event_date.weekday(),
        "annually" => {
            target_date.month() == event_date.month() && target_date.day() == event_date.day()
        }
        "monthly_last" => {
            if target_date.weekday() != event_date.weekday() {
                return false;
            }
            target_date
                .succ_opt()
                .and_then(|d| d.checked_add_days(chrono::Days::new(6)))
                .map(|next_week| next_week.month() != target_date.month())
                .unwrap_or(false)
        }
        _ if rec.starts_with("custom:") => {
            let json_str = &rec[7..];
            let Ok(config) = serde_json::from_str::<serde_json::Value>(json_str) else {
                return false;
            };

            if config["endType"].as_str() == Some("on") {
                if let Some(end_date) = config["endDate"].as_str() {
                    if target_date_str > end_date {
                        return false;
                    }
                }
            }

            let unit = config["unit"].as_str().unwrap_or("week");
            let interval = config["interval"].as_i64().unwrap_or(1).max(1);
            let diff_days = (target_date - event_date).num_days();

            match unit {
                "day" => {
                    if diff_days % interval != 0 {
                        return false;
                    }
                    if config["endType"].as_str() == Some("after") {
                        if let Some(occurrences) = config["occurrences"].as_i64() {
                            let occ = diff_days / interval + 1;
                            if occ > occurrences {
                                return false;
                            }
                        }
                    }
                    true
                }
                "week" => {
                    let target_day_idx = target_date.weekday().num_days_from_monday() as i64;
                    let matches_day = config["daysOfWeek"]
                        .as_array()
                        .map(|arr| arr.iter().any(|d| d.as_i64() == Some(target_day_idx)))
                        .unwrap_or_else(|| target_date.weekday() == event_date.weekday());

                    if !matches_day {
                        return false;
                    }

                    let diff_weeks = diff_days / 7;
                    diff_weeks % interval == 0
                }
                _ => false,
            }
        }
        _ => event_date_str == target_date_str,
    }
}

fn is_event_occurring_in_range(
    event: &CalendarEvent,
    start_filter: Option<&str>,
    end_filter: Option<&str>,
) -> (bool, Option<String>) {
    let rec = event.recurrence.as_deref().unwrap_or("none");
    if rec == "none" || rec.is_empty() {
        let matches_start = match start_filter {
            Some(s) => event.date.as_str() >= s,
            None => true,
        };
        let matches_end = match end_filter {
            Some(end) => event.date.as_str() <= end,
            None => true,
        };
        return (matches_start && matches_end, Some(event.date.clone()));
    }

    let start_date = start_filter.and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    let end_date = end_filter.and_then(|e| NaiveDate::parse_from_str(e, "%Y-%m-%d").ok());

    match (start_date, end_date) {
        (Some(start), Some(end)) => {
            if end < start {
                return (false, None);
            }
            let days_count = (end - start).num_days().min(60);
            for i in 0..=days_count {
                if let Some(target_d) = start.checked_add_signed(chrono::Duration::days(i)) {
                    let target_str = target_d.format("%Y-%m-%d").to_string();
                    if is_event_occurring_on_date(
                        &event.date,
                        &target_str,
                        event.recurrence.as_deref(),
                    ) {
                        return (true, Some(target_str));
                    }
                }
            }
            (false, None)
        }
        (Some(start), None) => {
            for i in 0..=30 {
                if let Some(target_d) = start.checked_add_signed(chrono::Duration::days(i)) {
                    let target_str = target_d.format("%Y-%m-%d").to_string();
                    if is_event_occurring_on_date(
                        &event.date,
                        &target_str,
                        event.recurrence.as_deref(),
                    ) {
                        return (true, Some(target_str));
                    }
                }
            }
            (false, None)
        }
        (None, Some(end)) => {
            let target_str = end.format("%Y-%m-%d").to_string();
            if is_event_occurring_on_date(&event.date, &target_str, event.recurrence.as_deref()) {
                return (true, Some(target_str));
            }
            (false, None)
        }
        (None, None) => (true, Some(event.date.clone())),
    }
}

pub fn get_calendar_events(conn: &Connection, args: &serde_json::Value) -> Result<String, String> {
    let events = get_all_calendar_events(conn)
        .map_err(|e| format!("Failed to read calendar events: {e}"))?;
    let start_filter = args["startDate"].as_str();
    let end_filter = args["endDate"].as_str();
    let query_filter = args["query"].as_str().map(|q| q.to_lowercase());
    let limit = args["limit"].as_u64().unwrap_or(30) as usize;
    let include_tasks = args["includeTasks"].as_bool().unwrap_or(true);

    let mut filtered: Vec<serde_json::Value> = Vec::new();
    for e in events {
        let (occurs, matched_date) = is_event_occurring_in_range(&e, start_filter, end_filter);
        if !occurs {
            continue;
        }

        let matches_query = match &query_filter {
            Some(q) => {
                e.title.to_lowercase().contains(q) || e.description.to_lowercase().contains(q)
            }
            None => true,
        };
        if !matches_query {
            continue;
        }

        let display_date = matched_date.unwrap_or_else(|| e.date.clone());
        filtered.push(json!({
            "id": e.id,
            "title": e.title,
            "description": e.description,
            "location": e.location,
            "date": display_date,
            "originalDate": e.date,
            "startTime": e.start_time,
            "endTime": e.end_time,
            "isAllDay": e.is_all_day,
            "recurrence": e.recurrence.unwrap_or_else(|| "none".to_string()),
            "color": e.color,
        }));

        if filtered.len() >= limit {
            break;
        }
    }

    let mut calendar_tasks: Vec<serde_json::Value> = Vec::new();
    if include_tasks {
        let today_str = chrono::Local::now().format("%Y-%m-%d").to_string();
        if let Ok(tasks) = get_all_tasks(conn) {
            for t in tasks {
                let task_date = t.due_date.as_deref().unwrap_or(&today_str);
                let matches_start = match start_filter {
                    Some(s) => task_date >= s,
                    None => true,
                };
                let matches_end = match end_filter {
                    Some(end) => task_date <= end,
                    None => true,
                };
                let matches_query = match &query_filter {
                    Some(q) => {
                        t.title.to_lowercase().contains(q)
                            || t.description.to_lowercase().contains(q)
                    }
                    None => true,
                };
                if matches_start && matches_end && matches_query {
                    calendar_tasks.push(json!({
                        "id": t.id,
                        "title": t.title,
                        "date": task_date,
                        "startTime": "09:00",
                        "endTime": "10:00",
                        "status": t.status,
                        "isTask": true
                    }));
                }
            }
        }
    }

    let total_count = filtered.len() + calendar_tasks.len();
    Ok(json!({
        "count": total_count,
        "events": filtered,
        "tasks": calendar_tasks,
    })
    .to_string())
}

pub fn create_calendar_event(
    conn: &Connection,
    args: &serde_json::Value,
) -> Result<String, String> {
    let title = args["title"]
        .as_str()
        .ok_or("Missing required field 'title'")?
        .to_string();
    let date = args["date"]
        .as_str()
        .ok_or("Missing required field 'date'")?
        .to_string();
    let start_time = args["startTime"]
        .as_str()
        .ok_or("Missing required field 'startTime'")?
        .to_string();
    let end_time = args["endTime"]
        .as_str()
        .ok_or("Missing required field 'endTime'")?
        .to_string();

    let description = args["description"].as_str().unwrap_or_default().to_string();
    let location = args["location"].as_str().unwrap_or_default().to_string();
    let is_all_day = args["isAllDay"].as_bool().unwrap_or(false);
    let recurrence = args["recurrence"].as_str().unwrap_or("none").to_string();
    let color = args["color"].as_str().unwrap_or("#00e5ff").to_string();

    let now = current_timestamp_ms();
    let c = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    let id = format!("evt_{now}_{c}");

    let event = CalendarEvent {
        id: id.clone(),
        title: title.clone(),
        description,
        location,
        date: date.clone(),
        start_time: start_time.clone(),
        end_time,
        is_all_day,
        recurrence: Some(recurrence),
        color,
        created_at: now,
        updated_at: now,
    };

    upsert_calendar_event(conn, &event)
        .map_err(|e| format!("Failed to create calendar event: {e}"))?;

    Ok(json!({
        "status": "success",
        "message": format!("Event '{title}' scheduled for {date} at {start_time}"),
        "eventId": id
    })
    .to_string())
}

pub fn update_calendar_event(
    conn: &Connection,
    args: &serde_json::Value,
) -> Result<String, String> {
    let id = args["id"].as_str().ok_or("Missing required field 'id'")?;

    let events = get_all_calendar_events(conn)
        .map_err(|e| format!("Failed to read calendar events: {e}"))?;
    let mut event = events
        .into_iter()
        .find(|e| e.id == id)
        .ok_or_else(|| format!("Calendar event '{id}' not found"))?;

    if let Some(t) = args["title"].as_str() {
        event.title = t.to_string();
    }
    if let Some(d) = args["date"].as_str() {
        event.date = d.to_string();
    }
    if let Some(st) = args["startTime"].as_str() {
        event.start_time = st.to_string();
    }
    if let Some(et) = args["endTime"].as_str() {
        event.end_time = et.to_string();
    }
    if let Some(desc) = args["description"].as_str() {
        event.description = desc.to_string();
    }
    if let Some(loc) = args["location"].as_str() {
        event.location = loc.to_string();
    }
    if let Some(all_day) = args["isAllDay"].as_bool() {
        event.is_all_day = all_day;
    }
    if let Some(rec) = args["recurrence"].as_str() {
        event.recurrence = Some(rec.to_string());
    }
    if let Some(c) = args["color"].as_str() {
        event.color = c.to_string();
    }
    event.updated_at = current_timestamp_ms();

    upsert_calendar_event(conn, &event)
        .map_err(|e| format!("Failed to update calendar event: {e}"))?;

    Ok(json!({
        "status": "success",
        "message": format!("Calendar event '{id}' updated successfully"),
        "eventId": id
    })
    .to_string())
}

pub fn delete_calendar_event(
    conn: &Connection,
    args: &serde_json::Value,
) -> Result<String, String> {
    let id = args["id"].as_str().ok_or("Missing required field 'id'")?;

    if id.starts_with("task_") {
        crate::db::queries::delete_task(conn, id)
            .map_err(|e| format!("Failed to delete calendar task: {e}"))?;
        return Ok(json!({
            "status": "success",
            "message": format!("Calendar task '{id}' deleted successfully"),
            "eventId": id
        })
        .to_string());
    }

    db_delete_calendar_event(conn, id)
        .map_err(|e| format!("Failed to delete calendar event: {e}"))?;

    Ok(json!({
        "status": "success",
        "message": format!("Calendar event '{id}' deleted successfully"),
        "eventId": id
    })
    .to_string())
}
