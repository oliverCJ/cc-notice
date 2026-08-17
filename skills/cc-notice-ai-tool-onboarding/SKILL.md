---
name: cc-notice-ai-tool-onboarding
description: 用于新增或更新 CC Notice 的 AI 工具接入，覆盖 Hook 列表、Hook 配置方式、Hook 触发方式、全局和项目级 Hook 目标、Hook 设置页工具 tab、relay 入站、AI Hook 到内部事件映射、默认 Profile 模板、推荐 Hook、payload 字段别名、模板变量、诊断和验证。不要用于只修改单个输出规则或普通 UI 文案，除非改动会影响 AI 工具接入链路。
---

# CC Notice AI 工具接入

使用本 skill 接入或更新 CC Notice 支持的 AI 工具。目标是让新工具从官方 Hook 事实到软件配置、运行时事件、映射和模板全部形成闭环，而不是只把事件名加进列表。

## 必读上下文

在收集资料或修改代码前，先读取：

- `CLAUDE.md` 中关于 AI 工具、Hook 配置、事件流转三层模型、模板变量、Hook 设置和 AI 事件映射的内容
- `app/src-tauri/templates/hook_events.yaml`
- `app/src-tauri/templates/profile_templates.yaml`
- `app/src-tauri/src/adapters/ai_tools/`
- `references/ai-tool-input-checklist.md`

若规则冲突，执行更严格的项目规则，并在接入设计中说明冲突和取舍。

## 官方资料校验

公开 AI 工具必须先查官方资料：

- Hook 或事件系统文档
- 配置文件路径和配置格式文档
- 全局配置与项目级配置规则
- Hook handler 命令格式
- Hook payload 字段说明或示例
- 事件触发条件和可复现实验步骤

不要用第三方文章替代官方 Hook 事实。官方资料缺失时，先要求用户提供可复现的配置样例、payload 样例和触发步骤。

## 工作流程

1. 读取必读上下文和输入清单。
2. 收集官方 Hook 资料、配置方式、payload 样例和触发方式。
3. 在改代码前输出接入设计，至少包含：
   - 官方来源、确认事实、冲突和缺失项
   - 工具 `source`、展示名、配置目标类型
   - Hook 事件列表、推荐 Hook、默认内部事件映射
   - 全局 Hook 配置写入方式
   - 项目级 Hook 配置写入方式
   - managed handler 识别、预览、写入和还原策略
   - relay 命令和真实触发步骤
   - payload 字段别名与模板变量映射
   - Hook 设置页 tab 和目标管理策略
   - AI 事件映射、可视化画布和默认模板策略
   - 预计修改文件
   - 测试和验证命令
4. 停止并等待用户确认，除非用户在当前对话中已明确批准这份具体设计。
5. 获批后读取 `references/onboarding-workflow.md` 和 `references/verification-checklist.md`。
6. 在正式实现前创建或更新 `docs/` 下的日期进度文档。
7. 先写或更新测试，再实现代码。
8. 验证 Hook 目录、AI 工具注册表、Hook 配置页、配置写入/还原、relay 入站、AI 事件映射、Profile 模板、模板变量、诊断和文档。
9. 对照 `docs/代码规范与架构约束.md` 执行架构 review gate，逐项给出 `通过 / 不通过 / 不适用` 和依据；存在不通过项时先修复。
10. 在进度文档中记录验证结果；无法验证的真实工具行为必须写明缺失前置条件。

## 强制规则

- 新 AI 工具必须通过 `app/src-tauri/src/adapters/ai_tools/` 注册表接入，禁止在页面、服务门面或运行时链路散落工具 ID 判断。
- Hook 事件选择必须继续以 `source -> events` 为核心结构；旧固定字段只能作为兼容层存在，新增工具禁止新增固定字段。
- Hook 配置目标必须同时考虑全局和项目级配置；如果工具不支持其中一种，必须在设计中明确说明。
- Hook 写入必须支持预览和还原；还原只能移除 CC Notice 托管 handler，必须保留用户自定义 Hook 和非 Hook 配置字段。
- 同一 `source` 下全局目标和项目级目标必须按现有互斥规则管理，不能同时启用造成重复触发。
- AI 事件映射只能消费全局 Hook 设置中已启用的 Hook 事件，禁止在 AI 映射页反向新增或启用 Hook。
- 新工具必须进入 Hook 设置页工具 tab、AI 映射工具节点、默认模板和推荐 Hook 设计；不能只加后端事件目录。
- 新工具接入应优先复用现有注册式链路；只有现有抽象不能表达新工具差异时，才允许修改页面编排组件或门面服务。
- payload 字段必须通过工具字段别名规范化到软件内置字段和模板变量，禁止 UI 或输出规则直接依赖工具私有字段路径。
- 不要把工具私有字段强行映射到语义不匹配的模板变量；如果现有白名单变量无法表达该字段，必须在接入设计中明确缺口，并提出是否扩展内置变量目录。
- Profile 模板只能预设内置内部事件，禁止预设用户自定义内部事件。
- 用户可见文案必须走 i18n。
- 完成代码变更前必须执行项目架构 review gate，尤其检查前端边界、后端分层、门面文件、数据化配置、异步状态安全、测试覆盖和文档同步。
- 重要接入变更必须同步更新 `CLAUDE.md` 和 `docs/` 下的日期进度文档。

## 参考文件

- 输入清单：`references/ai-tool-input-checklist.md`
- 执行流程：`references/onboarding-workflow.md`
- 验收清单：`references/verification-checklist.md`
