# Agent Skills

一组日常使用、按用途分组的 Agent Skills。它们小、可编辑、可组合，不接管完整工作流；选择需要的 skill，装进自己的 agent 即可。

作者：[Simon Wong](https://github.com/simonwong)。技能格式遵循 [Agent Skills Specification](https://agentskills.io/specification)。

## 安装（30 秒）

使用 Bun：

```shell
bunx skills add simonwong/skills
```

或使用 npm：

```shell
npx skills@latest add simonwong/skills
```

安装器会发现各分类目录下的 skills，并让你选择要安装的项目和目标 agent。分类只用于组织源码；当前 `skills` CLI 的选择列表会平铺显示所有 skill。

## 为什么有这些 Skills

### 1. 英文内容翻成中文总带着翻译腔

`rewrite-en2zh` 先理解英文原意，再脱离英文外壳用中文重新表达，保留 Markdown 格式和 AI 专有名词。

### 2. 有些 Skill 不该被 Agent 自动调用

`configure-skill-invocation` 扫描全局或当前项目的 skills，让你选择哪些改为仅显式调用，并一次性补齐 `SKILL.md` 和 Codex 的调用策略。

### 3. 主线程该指挥，不该亲自写代码

`fable-orchestrate` 让主线程只做需求澄清、方案拆解、任务分发和验收，实现类工作下发给 subagent。

## Reference

Skills 分为两种调用方式：

- **Model-invoked**：任务匹配时，agent 可以自动调用；用户也可以直接调用。
- **User-invoked**：只有用户显式输入 skill 名称时才调用，适合配置和编排动作。

### Writing

中文写作技能。

| Skill | 调用方式 | 用途 |
| --- | --- | --- |
| `rewrite-en2zh` | model-invoked | 理解英文原意后，用自然的简体中文重新表达。 |
| `write-article` | user-invoked | 围绕想法或草稿协作写文章，共同确认内容与讲述方向，成文后调用 `writing-ai-check`。 |
| `writing-ai-check` | user-invoked | 诊断 AI 味及其对阅读的影响，获准后改写，保留事实、原意和作者声音。 |

`writing-ai-check` 可独立使用。`write-article` 未安装它时仍可完成文章，并说明专项检查未执行；需要完整组合流程时同时安装两者。

`write-article` 与 `writing-ai-check` 的实现参考了：

- [stop-slop](https://github.com/hardikpandya/stop-slop)
- [human-writing](https://github.com/KKKKhazix/human-writing)
- [dbskill](https://github.com/dontbesilent2025/dbskill)
- [khazix-writer](https://github.com/KKKKhazix/khazix-skills)
- [Dan Koe 的写作方法](https://thedankoe.com/letters/the-greatest-skill-of-the-21st-century/)
- [中文文案排版指北](https://github.com/sparanoid/chinese-copywriting-guidelines/blob/master/README.zh-Hans.md)

### Engineering

工程质量技能。

| Skill | 调用方式 | 用途 |
| --- | --- | --- |
| `code-simplifier` | model-invoked | 简化最近修改的代码，提高可读性、一致性和可维护性，同时保持行为不变。 |

### Misc

通用工具。

| Skill | 调用方式 | 用途 | 调用示例 |
| --- | --- | --- | --- |
| `configure-skill-invocation` | user-invoked | 选择全局或项目 skills，将其改为仅显式调用。 | `$configure-skill-invocation global` / `$configure-skill-invocation project` |
| `fable-orchestrate` | user-invoked | 主线程只做需求澄清、方案拆解、任务分发、结果验收和难题攻关，实现类工作下发给 subagent。 | `/fable-orchestrate` / `/fable-orchestrate gpt` / `/fable-orchestrate herdr codex` |

`configure-skill-invocation` 不传 `global` 或 `project` 时，会先询问作用范围，再列出候选项供选择。`fable-orchestrate` 仅供 Claude Code 使用，不传参数时默认用 `opus`。`gpt` 和 `herdr <kind>` 均为可选执行路线：选择 `gpt` 时才需要 `codex:codex-rescue`；选择 `herdr <kind>` 时才需要 Herdr-managed session 与 `herdr` skill。

## 仓库结构

```text
skills/
├── writing/
│   ├── rewrite-en2zh/
│   ├── write-article/
│   └── writing-ai-check/
├── engineering/
│   └── code-simplifier/
└── misc/
    ├── configure-skill-invocation/
    └── fable-orchestrate/
in-progress/
└── <未完成的 skill>/
```

每个叶子目录都是一个可独立安装的 skill；分组目录本身不包含 `SKILL.md`。`in-progress/` 存放尚未完成、暂不对外提供的 skill，不在安装列表中。

## 推荐 Skills

外部值得装的 Agent Skills，与本仓库互补，按需选用。条目少时先平铺；以后多了再按用途分组。

### [mattpocock/skills](https://github.com/mattpocock/skills) — 真正的工程师技能集合

Matt Pocock 的日常工程技能：grill、TDD、code review、架构改进等。小、可组合，强调先对齐、再写代码，而不是把流程整包交给 agent。

### [show-me](https://github.com/humanlayer/skills/blob/main/plugins/show-me/skills/show-me/SKILL.md)

HumanLayer 的可视化沟通 skill。用伪代码、调用树、文件树、Mermaid、diff 和轻量 HTML 讲清当前话题，少写长文、多看结构。

### [impeccable](https://github.com/pbakaus/impeccable)

给 AI coding agent 的设计语言：一个 skill、二十多条命令，再加确定性检测规则，专门打掉 Inter / 紫蓝渐变 / 卡片套卡片那一套前端 slop。

### [Taste Skill](https://www.tasteskill.dev/)

面向 Cursor、Claude Code、Codex 等的开源前端 skill 套件。减少模板化界面，偏设计方向、审计和 anti-slop 执行。

## Find Me

- [X / Twitter](https://x.com/simonwongio)
- [GitHub](https://github.com/simonwong)

## License

MIT
