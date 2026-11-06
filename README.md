<div align="center">

# simonwong/skills

**一组日常使用、按用途分组的 Agent Skills**

小、可编辑、可组合，不接管完整工作流。选择需要的 skill，装进自己的 agent 即可。

[![Spec](https://img.shields.io/badge/Agent_Skills-Specification-6E56CF?style=flat-square)](https://agentskills.io/specification)
[![License](https://img.shields.io/badge/License-MIT-3FB950?style=flat-square)](#license)
[![Author](https://img.shields.io/badge/Author-Simon_Wong-1F6FEB?style=flat-square)](https://github.com/simonwong)

</div>

## 安装

<table>
<tr><td>

**Bun**

```shell
bunx skills add simonwong/skills
```

</td><td>

**npm**

```shell
npx skills@latest add simonwong/skills
```

</td></tr>
</table>

安装器会发现各分类目录下的 skills，并让你选择要安装的项目和目标 agent。分类只用于组织源码；当前 `skills` CLI 的选择列表会平铺显示所有 skill。

## 为什么有这些 Skills

<details open>
<summary><b>有些 Skill 不该被 Agent 自动调用</b></summary>

<br>

`configure-skill-invocation` 扫描全局或当前项目的 skills，让你选择哪些改为仅显式调用，并一次性补齐 `SKILL.md` 和 Codex 的调用策略。

</details>

<details open>
<summary><b>主线程该指挥，不该亲自写代码</b></summary>

<br>

`fable-orchestrate` 让主线程只做需求澄清、方案拆解、任务分发和验收，实现类工作下发给 subagent。

</details>

<details open>
<summary><b>所有任务都用同一个模型，贵且慢</b></summary>

<br>

`claude-dispatch` 让主线程负责协调和核查，按难度分派：简单任务和简单的浏览器操作交给 Sonnet 5.5 high，常规任务交给 Opus 5.5 medium，复杂任务交给 Opus 5.5 high。

</details>

## Reference

Skills 分为两种调用方式：

| 调用方式 | 说明 |
| --- | --- |
| 🤖 **Model-invoked** | 任务匹配时，agent 可以自动调用；用户也可以直接调用。 |
| 👤 **User-invoked** | 只有用户显式输入 skill 名称时才调用，适合配置和编排动作。 |

### Engineering

| Skill | 调用方式 | 用途 |
| --- | :---: | --- |
| `code-simplifier` | 👤 | 简化最近修改的代码，提高可读性、一致性和可维护性，同时保持行为不变。 |
| `ship-pr` | 👤 | 把当前改动按意图分批提交，再走开 PR、合并、删分支的完整流程。 |

`ship-pr` 先判断哪些改动属于本次 PR，无关的脏文件保持不提交；已在功能分支且无未提交改动时，直接从开 PR 开始。合并被 CI、review 或冲突挡住时会停下并报告，不强推。

### Misc

| Skill | 调用方式 | 用途 | 调用示例 |
| --- | :---: | --- | --- |
| `claude-dispatch` | 👤 | 主线程协调和核查，按难度把任务派给 Sonnet 5.5 high、Opus 5.5 medium 或 Opus 5.5 high 的 subagent。 | `/claude-dispatch` |
| `configure-skill-invocation` | 👤 | 选择全局或项目 skills，将其改为仅显式调用。 | `$configure-skill-invocation global`<br>`$configure-skill-invocation project` |
| `fable-orchestrate` | 👤 | 主线程只做需求澄清、方案拆解、任务分发、结果验收和难题攻关，实现类工作下发给 subagent。 | `/fable-orchestrate`<br>`/fable-orchestrate gpt`<br>`/fable-orchestrate herdr codex` |

`configure-skill-invocation` 不传 `global` 或 `project` 时，会先询问作用范围，再列出候选项供选择。`claude-dispatch` 与 `fable-orchestrate` 仅供 Claude Code 使用。`fable-orchestrate` 不传参数时默认用 `opus`。`gpt` 和 `herdr <kind>` 均为可选执行路线：选择 `gpt` 时才需要 `codex:codex-rescue`；选择 `herdr <kind>` 时才需要 Herdr-managed session 与 `herdr` skill。

## 仓库结构

```text
skills/
├── engineering/
│   ├── code-simplifier/
│   └── ship-pr/
└── misc/
    ├── claude-dispatch/
    ├── configure-skill-invocation/
    └── fable-orchestrate/
```

每个叶子目录都是一个可独立安装的 skill；分组目录本身不包含 `SKILL.md`。

## 推荐 Skills

外部值得装的 Agent Skills，与本仓库互补，按需选用。

### Engineers

#### [mattpocock/skills](https://github.com/mattpocock/skills) — 真正的工程师技能集合

Matt Pocock 的日常工程技能：grill、TDD、code review、架构改进等。小、可组合，强调先对齐、再写代码，而不是把流程整包交给 agent。

#### [show-me](https://github.com/humanlayer/skills/blob/main/plugins/show-me/skills/show-me/SKILL.md)

HumanLayer 的可视化沟通 skill。用伪代码、调用树、文件树、Mermaid、diff 和轻量 HTML 讲清当前话题，少写长文、多看结构。

#### [pstack](https://github.com/cursor/plugins/tree/main/pstack)

Cursor 工程师、React Compiler 核心成员 poteto 的 Cursor 插件。入口 `/poteto-mode` 按任务匹配 bug 修复、性能、重构、PR 看护等 23 个 playbook，再按需调用 `/how`、`/why`、`/interrogate`、`/tdd` 等 skill 和 23 条工程原则。目标是少写代码、先复现再修、用真实运行结果验证，并按模型长处分配多模型协作。

#### [emilkowalski/skills](https://github.com/emilkowalski/skills)

Emil Kowalski（Sonner 作者，曾在 Vercel、Linear）的 UI 工程 skills，以动画为主：选对缓动曲线、时长和属性，审查和改进现有动画，找值得加动效的位置；另有移动端原生手感、UI 库选型、多版本原型切换、Swift 等。解决 agent 在动效和界面细节上缺乏品味的问题。

### Designers

#### [impeccable](https://github.com/pbakaus/impeccable)

给 AI coding agent 的设计语言：一个 skill、二十多条命令，再加确定性检测规则，专门打掉 Inter / 紫蓝渐变 / 卡片套卡片那一套前端 slop。

#### [Taste Skill](https://www.tasteskill.dev/)

面向 Cursor、Claude Code、Codex 等的开源前端 skill 套件。减少模板化界面，偏设计方向、审计和 anti-slop 执行。

## 写作 Skills

写作和公众号相关的 `rewrite-en2zh`、`write-article`、`write-tweet`、`writing-ai-check`、`codex-wechat-cover` 已迁移到 [simonwong/writing-skills](https://github.com/simonwong/writing-skills)。

## Find Me

- [X / Twitter](https://x.com/simonwongio)
- [GitHub](https://github.com/simonwong)

## License

MIT
