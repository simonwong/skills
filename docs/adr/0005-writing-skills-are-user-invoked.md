# ADR-0005：write-article 与 writing-ai-check 改为显式调用

- 状态：已采纳
- 日期：2026-09-10

## 背景

两个 skill 原本是 model-invoked。它们的触发词（“写篇文章”“改这篇草稿”“读着太像 AI”）在别的任务里也会出现，一旦自动命中，agent 会把一次顺手的编辑升级成多阶段协作流程，或者直接改写用户没打算交出去评判的文字。

## 决策

两个 skill 都设为显式调用：`SKILL.md` 加 `disable-model-invocation: true`，`agents/openai.yaml` 加 `policy.allow_implicit_invocation: false`。

`rewrite-en2zh` 保持 model-invoked：它的动作范围固定在一次翻译重写，误触发的代价只是多一次可丢弃的输出。

## 影响

- 写作与 AI 味检查只在用户输入 skill 名时开始。
- ADR-0001 的调用方向不变。`write-article` 成文后按名调用 `/writing-ai-check`，属于显式调用，不受这条限制影响。
- 两个 skill 的 description 仍需写清触发场景，供用户在 skill 列表里认出它们。
