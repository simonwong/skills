import MarkdownIt, { type Token } from "markdown-it";
import cjkFriendly from "markdown-it-cjk-friendly";
// @ts-expect-error 包里没有类型声明
import cjkBreaks from "markdown-it-cjk-breaks";
import hljs from "highlight.js";
import juice from "juice";
import { load } from "cheerio";
import postcss from "postcss";
import customProperties from "postcss-custom-properties";
import reduceCalc from "postcss-calc";
import { join } from "node:path";
import { stripComments } from "./article";

export const THEME_PATH = join(import.meta.dir, "..", "assets", "theme.css");

type Footnote = { title: string; href: string };

// 与 Obsidian 的 strictLineBreaks 一致：单个换行不换行。
// cjk-friendly：「**“引号”**文字」这类中文标点贴着 ** 的写法也能加粗，和 Obsidian 一致。
// cjk-breaks：中文之间的单个换行直接去掉，否则浏览器会显示成一个空格。
const md = new MarkdownIt({ html: true, linkify: true, breaks: false, typographer: false }).use(cjkFriendly).use(cjkBreaks);

md.options.highlight = (code, lang) => {
  const html =
    lang && hljs.getLanguage(lang)
      ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
      : md.utils.escapeHtml(code);
  return `<pre class="code"><code class="hljs">${keepWhitespace(html.replace(/\n$/, ""))}</code></pre>`;
};

// 公众号编辑器会吞掉代码里的换行和连续空格，改成 <br> 和 &nbsp;，只动标签外的文本。
function keepWhitespace(html: string) {
  return html
    .split(/(<[^>]+>)/)
    .map((part) => (part.startsWith("<") ? part : part.replace(/\t/g, "  ").replace(/ /g, "&nbsp;").replace(/\n/g, "<br>")))
    .join("");
}

// 和 doocs/md 一致：公众号正文里只有 mp.weixin.qq.com 的链接能点；其余外链编号后收进文末「引用链接」。
// doocs 只按网址去重，同一网址配不同文字时会共用编号、文末只剩第一次的文字；这里按「标题 + 网址」去重，每个编号都能在文末找到自己的文字。
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const href = String(token.attrGet("href") ?? "");
  if (/^https?:\/\/mp\.weixin\.qq\.com\//.test(href)) return self.renderToken(tokens, idx, options);
  const close = tokens.findIndex((t, i) => i > idx && t.type === "link_close");
  // #锚点、./a.md 这类站内链接在公众号里没有意义，只留文字。
  if (!/^https?:\/\//i.test(href)) {
    tokens[close].meta = { bare: true };
    return "";
  }
  const text = tokens
    .slice(idx + 1, close)
    .map((t) => t.content)
    .join("");
  const plain = text === href || token.markup === "linkify" || token.markup === "autolink";
  const title = String(token.attrGet("title") || text);
  tokens[close].meta = { footnote: plain ? 0 : pushFootnote(env as { footnotes?: Footnote[] }, title, href) };
  return `<span class="link">`;
};

md.renderer.rules.link_close = (tokens, idx, options, _env, self) => {
  const meta = tokens[idx].meta as { footnote?: number; bare?: boolean } | null;
  if (!meta) return self.renderToken(tokens, idx, options);
  if (meta.bare) return "";
  return meta.footnote ? `</span><sup class="footnote-ref">[${meta.footnote}]</sup>` : "</span>";
};

function pushFootnote(env: { footnotes?: Footnote[] }, title: string, href: string) {
  env.footnotes ??= [];
  const found = env.footnotes.findIndex((f) => f.title === title && f.href === href);
  if (found >= 0) return found + 1;
  env.footnotes.push({ title, href });
  return env.footnotes.length;
}

// 列表符号和 doocs/md 一样写成文字：公众号不认 ::marker 样式，原生符号的颜色和大小都改不了。
// 列表项的文字都包在 <p> 里，符号放进第一个 <p>：li 里直接跟着的文字会被公众号 PC 端包进块级 <section>，
// 符号和文字、加粗和后面的文字就会分成两行。紧凑列表的段落默认不输出 <p>，这里改成输出。
md.core.ruler.after("block", "list_paragraphs", (state) => {
  for (const t of state.tokens) {
    if ((t.type === "paragraph_open" || t.type === "paragraph_close") && t.hidden) t.hidden = false;
  }
});

md.renderer.rules.list_item_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx];
  const ordered = token.markup === "." || token.markup === ")";
  const marker = ordered ? `<span class="number">${token.info}.</span>` : `<span class="bullet">•</span>`;
  const next = tokens[idx + 1];
  if (next?.type === "paragraph_open" && !next.hidden) {
    next.meta = { marker };
    return self.renderToken(tokens, idx, options);
  }
  return self.renderToken(tokens, idx, options) + marker;
};

md.renderer.rules.paragraph_open = (tokens, idx, options, _env, self) =>
  self.renderToken(tokens, idx, options) + ((tokens[idx].meta as { marker?: string } | null)?.marker ?? "");

// 段落里独占一行的图片拆成单独一段，后面才能转成带图注的 figure。
// 写法如「说明文字⏎![图](url)」，Markdown 会把两行并成一段。
md.core.ruler.after("inline", "split_images", (state) => {
  const out: Token[] = [];
  for (let i = 0; i < state.tokens.length; i++) {
    const [open, inline, close] = state.tokens.slice(i, i + 3);
    const lines = inline?.type === "inline" && open.type === "paragraph_open" ? splitLines(inline.children ?? []) : [];
    if (lines.length < 2 || !lines.some(isImageLine)) {
      out.push(state.tokens[i]);
      continue;
    }
    const groups: Token[][] = [];
    let text: Token[] = [];
    for (const line of lines) {
      if (isImageLine(line)) {
        if (text.length) groups.push(text);
        groups.push(line);
        text = [];
      } else {
        const soft = new state.Token("softbreak", "br", 0);
        text = text.length ? [...text, soft, ...line] : line;
      }
    }
    if (text.length) groups.push(text);
    for (const children of groups) {
      const p = Object.assign(new state.Token("paragraph_open", "p", 1), { map: open.map, block: true, hidden: false });
      const body = Object.assign(new state.Token("inline", "", 0), { map: inline.map, children, content: "" });
      const end = Object.assign(new state.Token("paragraph_close", "p", -1), { block: true, hidden: p.hidden });
      out.push(p, body, end);
    }
    i += 2;
  }
  state.tokens = out;
});

function splitLines(children: Token[]) {
  const lines: Token[][] = [[]];
  for (const t of children) {
    if (t.type === "softbreak") lines.push([]);
    else lines[lines.length - 1].push(t);
  }
  return lines;
}

function isImageLine(line: Token[]) {
  const rest = line.filter((t) => !(t.type === "text" && !t.content.trim()));
  return rest.length === 1 && rest[0].type === "image";
}

md.renderer.rules.table_open = () => `<section class="table-wrap"><table>`;
md.renderer.rules.table_close = () => `</table></section>`;

// 独占一段的图片改成 figure，alt 作为图注。
function figures(html: string) {
  return html.replace(/<p>\s*(<img [^>]*>)\s*<\/p>/g, (_, img: string) => {
    const alt = img.match(/alt="([^"]*)"/)?.[1] ?? "";
    return `<figure>${img}${alt ? `<figcaption>${alt}</figcaption>` : ""}</figure>`;
  });
}

function footnotes(list: Footnote[] = []) {
  if (!list.length) return "";
  const items = list
    .map(
      (f, i) =>
        `<p class="footnote-item"><span class="footnote-num">[${i + 1}]</span> ${md.utils.escapeHtml(f.title)}：<em>${md.utils.escapeHtml(f.href)}</em></p>`,
    )
    .join("");
  return `<section class="footnotes"><p class="footnotes-title">引用链接</p>${items}</section>`;
}

// 主题里的 var() 和 calc() 在内联前算成定值：公众号不认 CSS 变量。变量只从 :root 读取，:root 规则本身不进正文。
async function loadTheme(path: string) {
  const css = await Bun.file(path).text();
  const resolved = await postcss([customProperties({ preserve: false })]).process(css, { from: path });
  const dropRoot: postcss.Plugin = {
    postcssPlugin: "drop-root",
    Once(root) {
      root.walkRules(":root", (rule) => {
        rule.remove();
      });
    },
  };
  return (await postcss([dropRoot, reduceCalc({ unwrapSingleValue: true })]).process(resolved.css, { from: path })).css;
}

// body 是去掉 frontmatter 的正文，图片已改写成标准 Markdown 语法。输出可直接作为草稿正文的内联样式 HTML。
// %%批注%% 和 HTML 注释都不进正文。
export async function renderBody(body: string, theme = THEME_PATH) {
  const env: { footnotes?: Footnote[] } = {};
  const html = md.render(stripComments(body), env).replace(/<!--[\s\S]*?-->/g, "");
  const inner = figures(html) + footnotes(env.footnotes);
  const css = await loadTheme(theme);
  const inlined = juice.inlineContent(`<section class="wx">${inner}</section>`, css, {
    inlinePseudoElements: false,
    preserveImportant: false,
    applyWidthAttributes: false,
    applyHeightAttributes: false,
    applyAttributesTableElements: false,
  });
  return forWechat(inlined);
}

// 公众号兼容：嵌套列表挪到所属 li 之后，否则会渲染错乱；class 和 id 会被公众号删掉，提前去掉。
function forWechat(html: string) {
  const $ = load(html, null, false);
  $("li").each((_, li) => {
    const nested = $(li).children("ul, ol");
    if (nested.length) $(li).after(nested);
  });
  $("[class], [id]").removeAttr("class").removeAttr("id");
  return $.html().replace(/>\s*\n\s*</g, "><").replace(/\s*\n\s*<\//g, "</");
}

// 左栏原文的 Markdown 语法高亮。
// frontmatter 按 YAML 高亮：整段交给 markdown 语法时，结尾的 --- 会把上一行当成 setext 标题。
export function highlightMarkdown(source: string) {
  const fm = source.match(/^---\r?\n[\s\S]*?\r?\n---[^\S\r\n]*(?:\r?\n|$)/)?.[0] ?? "";
  const yaml = fm ? hljs.highlight(fm, { language: "yaml" }).value : "";
  return yaml + hljs.highlight(source.slice(fm.length), { language: "markdown" }).value;
}
