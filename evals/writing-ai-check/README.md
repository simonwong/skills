# writing-ai-check 用例

`evals.json` 的格式与 skill-creator 的 `evals/evals.json` 相同：每条有 `prompt`、`expected_output`、`files` 和可核对的 `expectations`。

## 覆盖

- 23 条的命中：每组一个混合用例，另有长稿逐段覆盖、同一条多次出现、命名仪式、翻案密度、同一让步句式反复、两端具体的对仗短句，以及取自真实稿件的正文冒号、类别词、逗号碎片、强调引号、翻译腔和整节排除已排除的用法。
- 不算 AI 味与保留边界：已经清楚的文字、作者声音、具体两端的对比、引语、真实连接词、更新说明、作者自评、单次命名、口播稿段段收束、学术文本回应反驳、定义列表的冒号、字面值的引号。
- 信息守恒：确定程度、因果、完成状态、条件、数量边界、归因、时效和作者自标的猜测。
- 交付方式：默认定稿、只看不改、待定、没有命中时只写一句、文件模式、多轮检查、被其他 skill 调用（用例以 write-article、write-tweet 作调用方）、稿件里的指令。

## 运行

1. 把 `files/` 复制到临时目录，文件类用例在副本上跑。
2. 每条用例开一个新会话或子代理，加载改动后的 `SKILL.md`，只给 `prompt`，不给 `expected_output` 和 `expectations`。
3. 保存每条输出，逐条核对 `expectations`。第 26 条再运行：

   ```bash
   python3 evals/writing-ai-check/check_structure.py evals/writing-ai-check/files/structure.md /path/to/edited-copy.md
   ```

改了条目、流程或交付格式，先跑一遍这些用例。单次运行不代表稳定通过率，真实稿件仍要另测。
