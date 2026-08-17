# AI 工具接入执行流程

改代码前必须确认用户已批准接入设计。设计中应包含官方来源、`source`、Hook 列表、推荐 Hook、配置写入方式、项目级配置、payload 字段、默认模板、待改文件和验证命令。

## 1. AI 工具注册表

更新：

- `app/src-tauri/src/adapters/ai_tools/<source>.rs`
- `app/src-tauri/src/adapters/ai_tools/mod.rs`
- `app/src-tauri/src/adapters/ai_tools/registry.rs`
- `app/src-tauri/src/adapters/ai_tools/definition.rs`，仅当现有能力模型无法表达新工具
- `app/src-tauri/src/adapters/ai_tools/field_aliases.rs`

要求：

- 所有工具差异必须收敛到注册表能力定义。
- 配置路径、展示名、managed handler 识别、Hook 配置格式、payload 字段别名都必须由注册表提供。
- 禁止在 `HookEventService`、`HookConfigWriterService`、`AppConfig`、页面组件或运行时服务中新增散落的工具 ID 判断。

## 2. Hook 事件目录

更新：

- `app/src-tauri/templates/hook_events.yaml`
- `app/src-tauri/src/core/hook_events.rs` 测试
- `app/src-tauri/src/core/hook_events/loader.rs` 或 schema，仅当目录结构需要扩展

要求：

- 每个新事件必须包含 `event`、`title`、`description`、`scenario`、`defaultSelected`、`mappedNoticeEvent`。
- `mappedNoticeEvent` 必须引用内置内部事件。
- 默认启用事件必须克制，只选择对用户有明确提示价值且频率可控的事件。
- 完整事件列表可以进入完整模板，但高频或调试类 Hook 不应默认启用。

## 3. Hook 配置写入和目标管理

更新：

- `app/src-tauri/src/app_services/hook_config_writer/`
- `app/src-tauri/src/app_services/hook_config_target_service.rs`
- `app/src-tauri/src/commands/hook_config.rs`
- 相关 Rust 测试

要求：

- 全局目标和项目级目标都必须被建模。
- 预览必须显示将写入、保留和移除的差异。
- 写入必须保留用户自定义 Hook 和非 Hook 配置字段。
- 还原只能移除 CC Notice 托管 handler。
- 同一 `source` 下全局目标和项目级目标必须遵守互斥启用规则。
- 项目级目标必须拦截重复 `source + projectPath`。

## 4. 前端 Hook 设置页

优先验证现有注册式链路是否自动支持新 `source`。只有现有抽象无法表达新工具差异时，才修改：

- `app/src/pages/hook-settings/HookSettingsPage.tsx`
- `app/src/pages/hook-settings/HookConfigTargetPanel.tsx`
- `app/src/pages/hook-settings/HookConfigTargetCard.tsx`
- `app/src/pages/hook-settings/HookEventSelectionPanel.tsx`
- `app/src/pages/hook-settings/useHookEventSelection.ts`
- `app/src/hooks/useHookConfigActions.ts`
- `app/src/i18n/locales/zh/messages.ts`
- `app/src/i18n/locales/en/messages.ts`

要求：

- 新工具必须在 Hook 配置页有独立 tab 或等价的 source 分组入口。
- Hook 选择、目标预览、写入和还原必须按 source 工作。
- 项目级目标管理必须可添加、去重、启用、禁用和还原。
- 页面不能按工具 ID 写死分支；展示信息应来自注册表、hook catalog 或 i18n helper。
- 不要为了“接入新工具”主动改页面编排组件；先用测试证明现有 `source` 驱动逻辑是否已覆盖。

## 5. Relay 入站和 Payload 规范化

更新：

- `app/src-tauri/src/core/hook_relay.rs`
- `app/src-tauri/src/app_services/inbound_event/normalized_fields.rs`
- `app/src-tauri/src/app_services/inbound_event/template_renderer.rs`
- `app/src-tauri/src/app_services/inbound_event_service.rs`
- Debug 或运行监控相关测试，若影响展示

要求：

- `submit_relay_event` 只接受 AI 原始 Hook 事件。
- 新工具 payload 字段必须通过字段别名规范化。
- 输出模板变量只能使用白名单变量，禁止开放任意 payload path。
- 字段别名必须语义准确；现有白名单变量无法表达的字段必须作为设计缺口处理，不能强行映射到相近但不等价的变量。
- Debug 页面应能看到新工具 `source`、`event` 和关键 payload 摘要。

## 6. AI 事件映射和可视化画布

优先验证现有 `source` 驱动 view model 和画布是否自动形成新工具节点。只有现有抽象无法表达新工具差异时，才修改：

- `app/src/pages/rules/AiEventMappingPanel.tsx`
- `app/src/pages/rules/AiMappingCreateDialog.tsx`
- `app/src/pages/rules/link-workflow/viewModel.ts`
- `app/src/pages/rules/link-workflow/LinkWorkflowCanvas.tsx`
- `app/src/pages/rules/link-workflow/ToolHookMappingInspector.tsx`
- 相关测试

要求：

- 新工具必须按 `source` 自动形成 AI 工具节点。
- AI 映射只能展示全局 Hook 设置中已启用的 Hook。
- 无启用 Hook 时，引导用户去 Hook 设置页，不能在画布中启用 Hook。
- 画布和弹窗不能写死 Codex、Claude Code 或新工具 ID。
- 不要绕过 `LinkWorkflowViewModel` 直接在画布组件拼装 Profile 或 Hook 数据。

## 7. Profile 模板和推荐 Hook

更新：

- `app/src-tauri/templates/profile_templates.yaml`
- `app/src-tauri/src/core/profile_templates/`
- `app/src/pages/settings/ProfileCreateDialog.tsx`，仅当展示逻辑需要调整
- 相关测试

要求：

- 基础模板只加入推荐 Hook 的 AI 映射。
- 完整模板可加入更多低频或诊断 Hook 映射。
- 模板不启用 Hook；Hook 启用仍由 Hook 设置页管理。
- 模板只能预设内置内部事件。

## 8. 文档同步

更新：

- `CLAUDE.md`
- `docs/<日期>-<工具名>接入进度.md`
- 若新增具体工具，还应记录官方来源、触发方式和验证结果

要求：

- 重要架构边界和新增工具差异必须同步进 `CLAUDE.md`。
- 进度文档必须记录已执行和跳过的验证。

## 9. 架构 Review Gate

完成代码变更前，必须对照 `docs/代码规范与架构约束.md` 输出 review 结果。

必须覆盖：

- 前端边界：页面入口、hooks、纯工具、子组件职责是否清晰。
- 后端分层：`core`、`commands`、`app_services`、`adapters`、`infrastructure` 是否保持职责边界。
- 门面文件：是否避免把逻辑堆回 `HookConfigWriterService`、`InboundEventService`、`AppConfig`、`HookSettingsPage.tsx`、`RulesPage.tsx` 或画布组件。
- 数据化配置：Hook 事件目录、Profile 模板和 AI 工具能力是否仍由 YAML/注册表驱动。
- 异步状态安全：Hook 目标切换、项目目标增删、预览写入和旧请求返回是否安全。
- 测试覆盖：是否覆盖核心业务逻辑、边界值和主要分支。
- 文档同步：`CLAUDE.md` 和日期进度文档是否已更新。

任一适用项为“不通过”时，不得声明接入完成。
