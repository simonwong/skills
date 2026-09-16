# ADR-0005：写作技能与 code-simplifier 改为显式调用

- 状态：已采纳
- 日期：2026-09-10（更新：2026-09-16）

## 背景

这些 skill 原本是 model-invoked。它们的触发词在别的任务里也会出现，一旦自动命中，agent 会把一次顺手的编辑升级成多阶段协作流程，或者直接改写用户没打算交出去评判的文字与代码。

`rewrite-en2zh` 最初保持 model-invoked，但在日常交互中同样容易在普通翻译或解释请求中被误触发；`code-simplifier` 也是如此，容易在未明确要求时主动介入重构。

`writing-ai-check` 设为显式调用后，`write-article` 和 `write-tweet` 通过 Skill 工具或 subagent 调用不到它：user-invoked 的 skill 只响应用户在输入框里写的名字。

## 决策

`write-article`、`rewrite-en2zh` 与 `code-simplifier` 设为显式调用：`SKILL.md` 加 `disable-model-invocation: true`，`agents/openai.yaml` 加 `policy.allow_implicit_invocation: false`。

`writing-ai-check` 保持 model-invoked，`agents/openai.yaml` 为 `policy.allow_implicit_invocation: true`。误触发靠 description 收窄：只在用户或调用方明确写出 `/writing-ai-check` 时使用。

## 影响

- 写作、翻译重写与代码简化只在用户输入 skill 名时开始。
- ADR-0001 的调用方向不变。`write-article` 和 `write-tweet` 成文后按名调用 `/writing-ai-check`，靠它的 model-invoked 设置和窄 description 命中。
- 各 skill 的 description 仍需写清触发场景，供用户在 skill 列表里认出它们。
