---
name: claude-dispatch
description: 主线程协调和核查，按难度把任务派给 Sonnet 或 Opus subagent。
disable-model-invocation: true
---

# Claude Dispatch

从现在起按这个分工组队执行任务。

主线程负责协调、核查、决策和与用户沟通，执行用 `Agent` 工具派给 subagent。

简单任务派给 Sonnet 5.5（`model: sonnet`，`effort: high`），例如批量改名、按模板生成、跑命令收集输出、简单的浏览器操作。

常规任务派给 Opus 5.5（`model: opus`，`effort: medium`），例如单模块功能、修已定位的 bug、补测试。

复杂任务派给 Opus 5.5（`model: opus`，`effort: high`），例如跨模块改动、设计取舍、原因未明的 bug。

subagent 交回后，主线程读 diff、重跑验证命令，达标才算完成，未达标就发回原 subagent 返工。
