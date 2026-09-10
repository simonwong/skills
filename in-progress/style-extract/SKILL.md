---
name: style-extract
description: 分析文章的写作风格特征，提取风格维度存入风格素材库。可融合多篇风格素材生成或更新主力风格档案（my_style.json）。当用户说"分析风格""提取写作风格""学习这个语气""分析我的文风""吸收这个风格""更新我的风格"时使用此技能。即使用户只是分享一篇文章并表达对其风格的兴趣，也应考虑使用。
license: MIT
metadata:
  author: simonwong
  version: "1.2.0"
---

# 风格提取

从文章中提取写作风格特征，建立和维护个人风格档案。

## 核心概念

风格不是抽象的"好"或"差"，而是一组可量化、可复制的具体特征。这个技能做两件事：

1. **分析入库**：把一篇文章的风格拆解为具体维度，存入风格素材库
2. **融合更新**：从风格素材库中挑选特征，合成或更新主力风格档案

主力风格档案（`my_style.json`）是创作和润色技能实际调用的配方。风格素材库是长期积累的原材料。

## 数据目录

所有风格数据存放在 `./writing-workspace/styles/`：

```
writing-workspace/styles/
├── my_style.json       # 主力风格档案（创作/润色读取的那一份）
├── index.jsonl          # 风格素材索引（JSONL 格式，每行一条 {id, source_title, author, analyzed_at}）
└── entries/            # 每篇分析过的文章一条记录
    └── sty_xxx.json
```

首次使用时自动创建目录结构。

## 模式判断

根据用户意图自动选择模式：

- 用户投喂文章说"分析风格""看看这篇文章的写法" → **模式 A：分析入库**
- 用户说"吸收进来""更新我的风格""融合这几个" → **模式 B：融合更新**
- 用户投喂自己的文章说"分析我的文风" → **模式 A**，且标记 `is_self: true`

---

## 模式 A：分析入库

### 分析维度

逐一分析以下维度，每个维度用一句话概括特征：

**语言维度：**

| 维度 | 关注点 |
|------|--------|
| vocabulary_level | 口语化 / 书面 / 混合？用词偏日常还是专业？ |
| sentence_rhythm | 短句为主还是长句？节奏是急促还是舒缓？ |
| favorite_expressions | 反复出现的口头禅、过渡语、语气词（提取 3-5 个） |
| punctuation_habits | 破折号多还是省略号多？逗号密度？ |
| person_perspective | 第一人称 / 第二人称 / 第三人称？是否切换？ |
| emotion_intensity | 冷静克制 / 中等 / 热烈煽情？态度鲜明还是温和？ |

**结构维度：**

| 维度 | 关注点 |
|------|--------|
| opening_pattern | 故事切入 / 提问切入 / 数据冲击 / 场景描写 / 直接亮观点？ |
| paragraph_rhythm | 段落长短交替规律？关键句是否独立成段？ |
| argument_logic | 归纳型（案例→观点）/ 演绎型（观点→论证）/ 并列型？ |
| transition_style | 用连接词过渡 / 口语化过渡 / 直接跳转？ |
| closing_pattern | 金句收尾 / 开放提问 / 行动号召 / 故事回环？ |
| title_pattern | 反常识 / 数字型 / 痛点型 / 悬念型 / 直给型？ |

### 提炼亮点

除了维度分析，额外提炼 2-3 个这篇文章**最值得借鉴的具体技巧**。不要泛泛而谈，要具体到"怎么做"。

好的亮点示例：
- "用连续三个反问句制造节奏感，然后用一句陈述句收住，形成'问问问→答'的冲击力"
- "每个大段落结尾都用一句独立成行的短句做总结，像钉钉子一样把观点钉住"

### 执行流程

1. 确保 `./writing-workspace/styles/` 目录存在，不存在则创建（含 `entries/` 子目录）
2. 如果 `index.jsonl` 不存在，创建空文件
3. 通读全文，理解整体风格基调
4. 逐一分析 12 个维度，每个维度一句话概括
5. 提炼 2-3 个最值得借鉴的具体技巧
6. 生成风格素材条目 JSON，ID 格式：`sty_YYYYMMDD_NNN`。**NNN 确定方式：取 `index.jsonl` 最后一行的 ID 序号，再列出 `entries/` 目录下当日已有的 `sty_YYYYMMDD_*.json` 文件，以两者中较大的序号 +1 作为起始编号。** 如果索引为空且当日无已有文件，才从 001 开始。
7. 写入 `styles/entries/{id}.json`
8. **立即更新 `styles/index.jsonl`**——在文件末尾追加一行 JSON `{id, source_title, author, analyzed_at}`。这一步不能跳过，索引是其他技能检索的入口。
9. 向用户展示分析结果（用可读的格式，不是 raw JSON）
10. 询问用户："要把其中某些特征吸收到主力风格里吗？"

### 风格素材 JSON 结构

```json
{
  "id": "sty_20260327_001",
  "source": {
    "title": "原文标题",
    "author": "作者",
    "url": "来源链接（如有）",
    "is_self": false
  },
  "language": {
    "vocabulary_level": "",
    "sentence_rhythm": "",
    "favorite_expressions": [],
    "punctuation_habits": "",
    "person_perspective": "",
    "emotion_intensity": ""
  },
  "structure": {
    "opening_pattern": "",
    "paragraph_rhythm": "",
    "argument_logic": "",
    "transition_style": "",
    "closing_pattern": "",
    "title_pattern": ""
  },
  "highlights": "2-3 个具体技巧的自然语言描述",
  "analyzed_at": "ISO 8601 时间戳"
}
```

### 注意事项

- 如果只给了一篇文章，分析完后提醒用户："一篇文章的风格分析可能不够全面，建议提供 3-5 篇同作者/同风格的文章以获得更准确的特征提取。"
- 分析时重点关注"人味"特征——那些让这篇文章读起来不像 AI 写的元素。这些特征在后续创作和润色中特别有价值。
- **写入 JSON 时必须正确转义特殊字符**：`highlights`、`overall_tone`、`anti_ai_notes`、`favorite_expressions` 等文本字段中的双引号 `"` 必须转义为 `\"`，反斜杠 `\` 转义为 `\\`，换行符转义为 `\n`。使用 Write 工具写入 JSON 时，确保字符串值中不包含未转义的双引号。

---

## 模式 B：融合/更新主力风格

### 执行流程

1. 读取当前主力风格档案 `styles/my_style.json`
   - 如果不存在，进入**初始化流程**（见下方）
2. 读取用户指定的风格素材（可以是刚分析完的，也可以是 entries/ 里已有的）
3. 逐维度对比当前主力风格 vs 新素材的特征差异
4. 对每个有差异的维度，向用户展示对比并询问：
   - "你当前的 `opening_pattern` 是'故事切入'，这篇文章用的是'数据冲击'。要替换、保留、还是两者兼收？"
5. 按用户选择更新 `my_style.json`：
   - `version` 加 1
   - `last_updated` 更新为当前时间
   - `trait_sources` 记录每个特征的来源（哪个风格素材条目）
6. 展示更新后的主力风格摘要

### 主力风格初始化

当 `my_style.json` 不存在时：

**情况 1：用户投喂了自己的文章**
- 分析完直接将结果作为主力风格的初始版本
- version 设为 1，trait_sources 全部标记为"自己的文章"

**情况 2：用户投喂了别人的文章**
- 分析完后引导用户挑选想要的特征
- 组装成第一版主力风格

### 主力风格 JSON 结构

```json
{
  "name": "我的主力风格",
  "version": 1,
  "last_updated": "ISO 8601 时间戳",
  "language": {
    "vocabulary_level": "",
    "sentence_rhythm": "",
    "favorite_expressions": [],
    "punctuation_habits": "",
    "person_perspective": "",
    "emotion_intensity": "",
    "forbidden_words": ["值得注意的是", "总而言之", "综上所述", "让我们", "在当今社会"]
  },
  "structure": {
    "opening_pattern": "",
    "paragraph_rhythm": "",
    "argument_logic": "",
    "transition_style": "",
    "closing_pattern": "",
    "title_pattern": ""
  },
  "overall_tone": "一段自然语言描述整体风格基调",
  "anti_ai_notes": "避免排比句、避免'首先其次最后'的机械结构、避免每段都差不多长...",
  "trait_sources": {
    "opening_pattern": "来自 sty_xxx",
    "sentence_rhythm": "自己的文章"
  }
}
```

`forbidden_words` 初始包含常见 AI 用语，用户可以随时补充。创作和润色技能会读取这个列表。

---

## 输出格式

分析结果用可读的中文呈现，不要直接输出 JSON。示例格式：

```
## 风格分析报告

**来源：** 《文章标题》 by 作者

### 语言特征
- **词汇风格：** 口语化为主，偶尔蹦出书面用语制造反差
- **句式节奏：** 短句密集，长句用来收尾，形成"碎碎碎——收"的节奏
- **常用表达：** "说白了""你想想看""本质上就是"
- ...

### 结构特征
- **开头方式：** 故事切入——用一个具体场景把读者拉进来
- ...

### 最值得借鉴的技巧
1. ...
2. ...

---
风格素材已保存为 sty_20260327_001
要把其中某些特征吸收到你的主力风格里吗？
```
