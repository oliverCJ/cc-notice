use std::collections::HashSet;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InternalEventDefinition {
    pub id: String,
    pub title: String,
    pub description: String,
    pub scenario: String,
    pub built_in: bool,
}

pub fn builtin_internal_event_catalog() -> Vec<InternalEventDefinition> {
    vec![
        builtin_event(
            "agent.started",
            "AI 开始工作",
            "用户提交 prompt 后，AI 开始思考和处理任务。",
            "会话启动、用户提交提示",
        ),
        builtin_event(
            "agent.working",
            "AI 工作中",
            "AI 正在处理任务的通用状态。",
            "子任务运行、提示扩展、工具完成后继续工作",
        ),
        builtin_event(
            "agent.waiting_input",
            "等待输入",
            "AI 等待用户输入或授权。",
            "权限请求或人工确认",
        ),
        builtin_event(
            "tool.executing",
            "工具执行中",
            "AI 正在调用工具（读写文件、运行命令等）。",
            "PreToolUse 事件",
        ),
        builtin_event(
            "agent.completed",
            "任务完成",
            "AI 任务正常结束。",
            "Stop 事件、会话结束",
        ),
        builtin_event(
            "agent.failed",
            "任务失败",
            "AI 任务失败或异常结束。",
            "失败事件或解析异常",
        ),
        builtin_event(
            "notification",
            "系统通知",
            "AI 工具发出的系统通知或提示。",
            "Claude Code Notification 事件",
        ),
        builtin_event(
            "context.compacting",
            "上下文压缩",
            "AI 正在压缩上下文以节省内存。",
            "PreCompact 事件",
        ),
    ]
}

pub fn internal_event_ids(events: &[InternalEventDefinition]) -> HashSet<String> {
    events.iter().map(|event| event.id.clone()).collect()
}

pub fn builtin_internal_event_ids() -> HashSet<String> {
    internal_event_ids(&builtin_internal_event_catalog())
}

pub fn is_known_internal_event(event_id: &str, valid_event_ids: &HashSet<String>) -> bool {
    valid_event_ids.contains(event_id)
}

fn builtin_event(
    id: &str,
    title: &str,
    description: &str,
    scenario: &str,
) -> InternalEventDefinition {
    InternalEventDefinition {
        id: id.to_string(),
        title: title.to_string(),
        description: description.to_string(),
        scenario: scenario.to_string(),
        built_in: true,
    }
}
