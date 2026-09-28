# code-simplifier 的设计决定

## 显式调用

`SKILL.md` 设 `disable-model-invocation: true`，`agents/openai.yaml` 设 `policy.allow_implicit_invocation: false`，只在用户输入 skill 名时开始。

理由：它的触发场景（简化、整理代码）在普通编码任务里经常出现，自动命中时会在用户没要求的情况下主动重构代码。
