---
title: '四个 Claude 同屏给我打工：Agent Team 上手指南'
summary: 'Claude Code Agent Team 让你同时跑多个 Claude 实例组队干活。本文覆盖开启配置、tmux 分屏、Sub Agent 对比，以及我自己踩出来的几条实践经验。'
date: '2026-05-07'
tags: ['Claude Code', 'Agent Team', 'AI 编程']
coverImage: 'https://file.simonwong.cn/blog/2605/bvzimeueo4chay59h9wfxu.png'
---

![Opus 4.7 和 4.6 在不同 effort 档位下的编码表现](https://mmbiz.qpic.cn/mmbiz_png/awH6d1xs9XPicAQNYrfoWtSZnlU0BBjKjGeCgvX9ibZsqLhUcvhhmYH2Miae0SUJqItRhMq7ALHhwcPPUSCGtsYcTnJtnzia7kqyJXAfqMHicSSY/0?wx_fmt=png&from=appmsg)

> 四个 Claude 同屏并行打工，是什么体验？

Agent Team 这个功能我之前就听说过，但一直没动手，因为 Pro 套餐的用量根本撑不住。最近换了 Max 之后终于有机会试了。

之前看到过几个让我印象很深的案例：Anthropic 自己用 16 个 agent 跑了两周，写出了一个能编译 Linux 内核的 [Rust C 编译器](https://www.anthropic.com/engineering/building-c-compiler)；还有个人开发者用 4 个角色的 Agent Team 花 4 周把一个 3 万行的 Go 项目移植成了 Rust。

还不了解 Sub Agent？可以先看这篇：[Claude Code 的 Sub Agent 实战](https://mp.weixin.qq.com/s/oX3ADDWuKVct0-kAPUnXmw)。

## Agent Team 是什么

**Agent Team 让你同时跑多个 Claude Code 实例，组成一个团队一起干活**。

你启动的第一个会话是队长（Team Lead），负责分任务、汇总结果。队长可以派出队友（Teammates），每个队友是独立的 Claude Code 实例，有自己的上下文窗口，互相之间可以直接发消息。

下面这张图能看得比较清楚：

![WorkBuddy 的新建任务界面](https://mmbiz.qpic.cn/sz_mmbiz_png/awH6d1xs9XNq7yQb9mr3wljouUuT1EtacJNKibNrQ9d8MqZYH72UnXuLhibicDP2W224uP1Bp3kW0jX5qwDfvS1JsRQBSgKJctZgsTXQHhicyno/0?wx_fmt=png&from=appmsg)

跟 Sub Agent 的区别：

| 对比项 | Sub Agent | Agent Team |
| --- | --- | --- |
| 生命周期 | 干完活就散 | 长期在线 |
| 队友通信 | 只能交回主会话 | 可以直接互发消息 |
| 上下文 | 独立 | 独立 |
| 适合场景 | 一次性的调研、检索 | 需要来回协作的复杂任务 |

## 怎么开启

### 第一步：打开实验开关

在 `~/.claude/settings.json` 里加上环境变量：

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

保存，重启 Claude Code。想用分屏模式的话，先装好 tmux：

```bash
brew install tmux
tmux new -s team
claude --teammate-mode tmux
```

*PS：不装 tmux 也能用，只是看不到分屏。*

### 第二步：用一段 prompt 调起团队

直接用自然语言描述任务就行，Claude 会自己决定派几个队友、分别什么角色：

> 帮我组建一个 Agent Team 审查 PR #142，派出三个审查员：一个专注安全风险、一个专注性能影响、一个专注测试覆盖率。各自审完后汇总发现。

![](https://mmbiz.qpic.cn/mmbiz_jpg/awH6d1xs9XNcjO9fBmGDy3V14d5n977eE8dyg60BqNknibvwYpphaOlCgMG1ibKTmO1a2QzrHkrBS8veqBlHgHMeGbwkHLsAwQ5kLaTsZ4Ob0/0?wx_fmt=jpeg)

## 我的几条实践经验

1. **先让队长出计划，再派队友**：计划确认后再开工，返工少很多。
2. **每个队友只管一块文件**：两个队友改同一个文件，大概率互相覆盖。
3. **控制人数**：
   - 调研类任务 3 个队友够用
   - 编码类任务不超过 4 个
   - 人多了 token 消耗会翻倍，协调成本也上来了

#### 什么时候不该用

改一两个文件的小需求，直接单个会话更快。Agent Team 的收益来自并行，任务拆不开就没有收益。

---

总的来说，Agent Team 更像一个真的团队：分工、沟通、汇总，都得有人管。~~无脑开四个窗口~~ 只会烧钱。

## 参考

- [Building a C compiler with a team of parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler)
- [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams)
- 原文来源：[30 Tips for Claude Code Agent Teams](https://getpushtoprod.substack.com/p/30-tips-for-claude-code-agent-teams)
