# ADR-0001：写作能力拆成 write-article 与 writing-ai-check

- 状态：已采纳
- 日期：2026-09-10

## 背景

公众号长文写作需要两件不同的事：把内容组织清楚，以及清理表达里的 AI 痕迹。早期方案把两者放进一个 skill，结果是主文件同时承载协作流程和大量特征清单，两类内容互相挤压；而清理表达这件事对任何稿件都适用，绑在写作流程里就无法单独使用。

## 决策

拆成两个 skill，调用方式见 ADR-0005。

- `write-article` 负责材料、内容、讲述与表达，覆盖从想法到成稿的协作过程。
- `writing-ai-check` 负责表达诊断与获准后的改写，输入是一篇稿件，不依赖写作过程。

调用方向单向：`write-article` 在成文后调用 `writing-ai-check`，反向不调用。调用路径写在 `write-article` 里，`writing-ai-check` 不描述配合关系。特征清单只存在于 `writing-ai-check/references/`，`write-article` 不复制一份。

`write-article` 按 skill 名调用 `/writing-ai-check`，不假定安装路径，也不读它的文件。未安装时完成文章并说明专项检查未执行。

## 影响

- `writing-ai-check` 可以单独安装使用，处理任何来源的稿件。它的输入和判断依据都只有稿件本身：核实外部事实属于 `write-article` 的素材职责，写进 `writing-ai-check` 会让它在单独使用时无从判断。
- 特征清单单一真源，修改一处即可。
- 两个 skill 各自的 description 都要维持在上下文里，这是拆分的代价。
- 用户可能只装其中一个，`write-article` 必须能在缺少 `writing-ai-check` 时正常交付。
