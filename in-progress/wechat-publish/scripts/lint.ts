import MarkdownIt, { type Token } from "markdown-it";
import { blankComments, type Article } from "./article";

// 预览页的写法提示：只提醒，不改渲染结果，由作者决定要不要换写法。line 为 0 表示针对全文。
export type Hint = { line: number; text: string };

const md = new MarkdownIt({ html: true, linkify: true });

const DROPPED_TAG = /<(video|audio|iframe|embed|object|script)\b/i;
const DIAGRAM = /^(mermaid|plantuml|flowchart|sequence)$/i;
const CJK_PUNCT = /[，。、；：！？）」』】]/;
const MP_LINK = /^https?:\/\/mp\.weixin\.qq\.com\//;

// Typora 的默认文件名、纯数字、带扩展名的文件名、泛称，作图注都没有意义。
const MEANINGLESS_ALT = /^(image-\d{6,}.*|\d+|.+\.(png|jpe?g|gif|webp|svg)|image|img|图片|截图|screenshot)$/i;

// 标题上限 64 字（实测，接口文档写的 32 字不准）。摘要 120 字、正文少于 2 万字符且小于 1MB 来自接口文档。
// 带内联样式的 HTML 超过 2 万字符的文章也发出去过，所以 2 万按去掉标签后的字数算。
const TITLE_LIMIT = 64;
const DIGEST_LIMIT = 120;
const TEXT_LIMIT = 20_000;
const HTML_BYTES_LIMIT = 1024 * 1024;

// body 是去掉 frontmatter 的正文，firstLine 是正文第一行在 md 文件里的行号。
export function lintBody(body: string, title: string, firstLine: number): Hint[] {
  const hints: Hint[] = [];
  const tokens = md.parse(blankComments(body), {});
  const at = (t: Token) => firstLine + (t.map?.[0] ?? 0);
  const plain = (children: Token[] | null) =>
    (children ?? [])
      .filter((c) => c.type === "text" || c.type === "code_inline")
      .map((c) => c.content)
      .join("")
      .trim();

  tokens.forEach((t, i) => {
    if (t.type === "heading_open") {
      const inline = tokens[i + 1];
      if (t.tag === "h1" && title && plain(inline.children) === title.trim()) {
        hints.push({ line: at(t), text: "一级标题和文章标题相同，发布后标题会在正文里再出现一次" });
      }
      if (inline.children?.some((c) => c.type === "link_open" && /^https?:/.test(href(c)) && !MP_LINK.test(href(c)))) {
        hints.push({ line: at(t), text: "标题里有外链，标题后会带上 [n] 编号" });
      }
    }
    if (t.type === "blockquote_open" && tokens[i + 2]?.type === "inline" && /^\[![^\]]+\]/.test(tokens[i + 2].content)) {
      hints.push({ line: at(t), text: "Obsidian 的 callout 会显示成普通引用，开头的 [!…] 会原样出现" });
    }
    if ((t.type === "html_block" || t.type === "html_inline") && DROPPED_TAG.test(t.content)) {
      hints.push({ line: at(t), text: `公众号会删掉 <${t.content.match(DROPPED_TAG)![1].toLowerCase()}>，这部分内容不会显示` });
    }
    if (t.type === "fence" && DIAGRAM.test(t.info.trim())) {
      hints.push({ line: at(t), text: `${t.info.trim()} 图会按代码显示，建议换成图片` });
    }
    if (t.type !== "inline") return;
    if (/\[\^[^\]\s]+\]/.test(t.content)) {
      hints.push({ line: at(t), text: "脚注 [^…] 不支持，脚注内容不会显示，可以改成括号说明" });
    }
    if (/==[^=\s][^=\n]*==/.test(t.content)) {
      hints.push({ line: at(t), text: "==高亮== 不支持，会原样显示等号" });
    }
    (t.children ?? []).forEach((c, j, children) => {
      if (c.type === "html_inline" && DROPPED_TAG.test(c.content)) {
        hints.push({ line: at(t), text: `公众号会删掉 <${c.content.match(DROPPED_TAG)![1].toLowerCase()}>，这部分内容不会显示` });
      }
      if (c.type === "image" && MEANINGLESS_ALT.test(c.content.trim())) {
        hints.push({ line: at(t), text: `图注会显示成「${c.content.trim()}」，可以改成一句说明或留空` });
      }
      if (c.type !== "link_open") return;
      if (c.markup === "linkify" || c.markup === "autolink") {
        const url = safeDecode(href(c));
        if (CJK_PUNCT.test(url)) hints.push({ line: at(t), text: `网址里混进了中文标点：${url}` });
      } else if (!/^https?:/i.test(href(c)) && !children[j + 1]?.content.startsWith("^")) {
        // [^1] 会被当成链接，上面的脚注提示已经覆盖。
        hints.push({ line: at(t), text: `链接 ${safeDecode(href(c))} 不是网址，发布后只显示文字` });
      }
    });
  });
  return hints.sort((a, b) => a.line - b.line);
}

// frontmatter 和正文长度的提示；html 是渲染后的正文，没有时不检查长度。
export function lintMeta(article: Pick<Article, "frontmatter" | "frontmatterText">, html?: string): Hint[] {
  const hints: Hint[] = [];
  const lineOf = (key: string) => {
    const i = article.frontmatterText.split("\n").findIndex((l) => l.startsWith(`${key}:`));
    return i < 0 ? 1 : i + 1;
  };
  const { title, summary, coverImage } = article.frontmatter;
  if (!title) hints.push({ line: 1, text: "缺少 title，不能发布" });
  else if ([...String(title)].length > TITLE_LIMIT) {
    hints.push({ line: lineOf("title"), text: `标题 ${[...String(title)].length} 字，上限是 ${TITLE_LIMIT} 字，发布时会报 45003` });
  }
  if (typeof summary === "string" && [...summary].length > DIGEST_LIMIT) {
    hints.push({ line: lineOf("summary"), text: `摘要 ${[...summary].length} 字，接口文档写的上限是 ${DIGEST_LIMIT} 字，发布时可能报 45004` });
  }
  if (coverImage === undefined || coverImage === null || coverImage === "") hints.push({ line: 1, text: "缺少 coverImage，不能发布" });
  const text = html?.replace(/<[^>]*>/g, "").replace(/\s/g, "") ?? "";
  if (text.length > TEXT_LIMIT) {
    hints.push({ line: 0, text: `正文 ${text.length} 字，接口文档写的上限是 ${TEXT_LIMIT} 字符，发布时可能报 45002` });
  }
  if (html && Buffer.byteLength(html) > HTML_BYTES_LIMIT) {
    hints.push({ line: 0, text: `正文 HTML 超过 1MB，发布时可能报 45002` });
  }
  return hints;
}

function href(t: Token) {
  return String(t.attrGet("href") ?? "");
}

function safeDecode(s: string) {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
}
