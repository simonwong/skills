import { dirname, isAbsolute, join, resolve, basename } from "node:path";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import MarkdownIt from "markdown-it";

export type Frontmatter = {
  title?: string;
  summary?: string;
  coverImage?: string;
  [key: string]: unknown;
};

export type Article = {
  path: string;
  source: string;
  frontmatterText: string;
  frontmatter: Frontmatter;
  body: string;
};

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

// path 取磁盘上的真实路径：大小写不同的写法都算同一篇，草稿记录不会分叉。
export async function readArticle(path: string): Promise<Article> {
  const abs = realpathSync.native(resolve(path));
  const source = await Bun.file(abs).text();
  const m = source.match(FRONTMATTER);
  const frontmatterText = m ? m[0] : "";
  const frontmatter = (m ? Bun.YAML.parse(m[1]) : {}) as Frontmatter;
  return { path: abs, source, frontmatterText, frontmatter: frontmatter ?? {}, body: source.slice(frontmatterText.length) };
}

// 图片分三类：mmbiz 已在公众号图床，remote 是其他外链，local 是本地文件（含 Obsidian 的 ![[x.png]]）。
export type ImageKind = "mmbiz" | "remote" | "local";
export type ImageRef = {
  raw: string;
  index: number;
  form: "wikilink" | "markdown" | "reference" | "html";
  alt: string;
  src: string;
  kind: ImageKind;
  path?: string;
  error?: string;
};

// 依次是：![[x.png|说明]]、![alt](src "title")、![alt][ref]、<img src="…">。
const IMAGE =
  /!\[\[([^\]\n]+)\]\]|!\[([^\]\n]*)\]\(\s*(?:<([^>\n]+)>|([^)\s]+))(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?\s*\)|!\[([^\]\n]*)\]\[[^\]\n]*\]|<img\b[^>]*>/gi;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

const parser = new MarkdownIt({ html: true });

const blank = (s: string) => s.replace(/[^\n]/g, " ");

// 代码块和行内代码换成等长空白。等长替换保证下标和原文一致，找到的位置可以直接用来改原文。
function maskCode(body: string) {
  const lineStart = [0];
  for (let i = 0; i < body.length; i++) if (body[i] === "\n") lineStart.push(i + 1);
  let out = body;
  for (const t of parser.parse(body, {})) {
    if ((t.type === "fence" || t.type === "code_block") && t.map) {
      const [from, to] = [lineStart[t.map[0]], lineStart[t.map[1]] ?? body.length];
      out = out.slice(0, from) + blank(out.slice(from, to)) + out.slice(to);
    }
  }
  return out.replace(/(?<!`)(`+)(?!`)(?:[^\n]|\n(?![ \t]*\n))*?[^`]\1(?!`)/g, blank);
}

// 再去掉 HTML 注释和 Obsidian 的 %%批注%%，只在剩下的正文里找图片。
function maskNonContent(body: string) {
  return maskCode(body).replace(/<!--[\s\S]*?-->|%%[\s\S]*?%%/g, blank);
}

// %%批注%% 只在 Obsidian 编辑器里可见，渲染前删掉；代码和 HTML 注释里的 %% 不动。
export function stripComments(body: string) {
  const masked = maskCode(body).replace(/<!--[\s\S]*?-->/g, blank);
  let out = "";
  let last = 0;
  for (const m of masked.matchAll(/%%[\s\S]*?%%/g)) {
    out += body.slice(last, m.index);
    last = m.index! + m[0].length;
  }
  return out + body.slice(last);
}

// 把 HTML 注释和 %%批注%% 换成空白、保留换行，写法提示不看注释里的内容，行号也不变。
export function blankComments(body: string) {
  const masked = maskCode(body);
  let out = body;
  for (const m of masked.matchAll(/<!--[\s\S]*?-->|%%[\s\S]*?%%/g)) {
    out = out.slice(0, m.index) + blank(m[0]) + out.slice(m.index! + m[0].length);
  }
  return out;
}

export function classify(src: string): ImageKind {
  if (/^https?:\/\/mmbiz\.qpic\.cn\//i.test(src)) return "mmbiz";
  if (/^https?:\/\//i.test(src)) return "remote";
  return "local";
}

export function scanImages(article: Article): ImageRef[] {
  const refs: ImageRef[] = [];
  for (const m of maskNonContent(article.body).matchAll(IMAGE)) {
    const at = { raw: m[0], index: m.index! };
    if (m[1] !== undefined) {
      const [target, label = ""] = m[1].split("|");
      const alt = /^\d+(x\d+)?$/.test(label.trim()) ? "" : label.trim();
      refs.push(withPath({ ...at, form: "wikilink", alt, src: target.trim(), kind: "local" }, article.path, true));
    } else if (m[2] !== undefined) {
      const src = (m[3] ?? m[4]).trim();
      const ref: ImageRef = { ...at, form: "markdown", alt: m[2], src, kind: classify(src) };
      refs.push(ref.kind === "local" ? withPath(ref, article.path, false) : ref);
    } else if (m[5] !== undefined) {
      refs.push({ ...at, form: "reference", alt: m[5], src: m[0], kind: "local", error: `引用式图片不会上传：${m[0]}，改成 ![说明](地址) 写法` });
    } else {
      const src = m[0].match(/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find((v) => v !== undefined) ?? "";
      const kind = classify(src);
      refs.push({ ...at, form: "html", alt: "", src, kind, ...(kind === "mmbiz" ? {} : { error: `<img> 标签里的图片不会上传：${src || m[0]}，改成 ![说明](地址) 写法` }) });
    }
  }
  return refs;
}

// 封面可以是 URL、相对路径或 "[[x.png]]"，写成一行。
export function coverRef(article: Article): ImageRef | undefined {
  const value = article.frontmatter.coverImage;
  if (value === undefined || value === null || value === "") return undefined;
  const line = article.frontmatterText.match(/^coverImage:(.*)$/m)?.[1].trim() ?? "";
  if (typeof value !== "string" || !line || /^[|>]/.test(line)) {
    const error = `coverImage 要写成一行字符串，比如 coverImage: "[[cover.png]]"（[[ ]] 外面要加引号）`;
    return { raw: String(value), index: -1, form: "markdown", alt: "", src: "", kind: "local", error };
  }
  const wiki = value.trim().match(/^!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/);
  const src = wiki ? wiki[1].trim() : value.trim();
  const ref: ImageRef = { raw: value, index: -1, form: wiki ? "wikilink" : "markdown", alt: "", src, kind: wiki ? "local" : classify(src) };
  return ref.kind === "local" ? withPath(ref, article.path, Boolean(wiki)) : ref;
}

function withPath(ref: ImageRef, mdPath: string, wikilink: boolean): ImageRef {
  const src = safeDecode(ref.src);
  if (!IMAGE_EXT.test(src)) return { ...ref, kind: "local", error: `只能插入 png、jpg、gif、webp 图片：${ref.raw}` };
  const path = wikilink ? resolveWikilink(src, mdPath) : resolveRelative(src, mdPath);
  return path ? { ...ref, kind: "local", path } : { ...ref, kind: "local", error: `找不到本地图片：${src}` };
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function resolveRelative(src: string, mdPath: string) {
  const path = isAbsolute(src) ? src : join(dirname(mdPath), src);
  return existsSync(path) ? path : undefined;
}

// 按 Obsidian 的规则找附件：vault 附件目录、md 所在目录、vault 内相对路径，最后全库按文件名搜。
function resolveWikilink(name: string, mdPath: string) {
  const vault = findVault(mdPath);
  const candidates = [join(dirname(mdPath), name)];
  if (vault) {
    const folder = vault.attachmentFolder;
    if (folder) {
      candidates.unshift(folder.startsWith("./") ? join(dirname(mdPath), folder, name) : join(vault.root, folder, name));
    }
    candidates.push(join(vault.root, name));
  }
  const hit = candidates.find((p) => existsSync(p));
  if (hit || !vault) return hit;
  return vault.findByName(basename(name));
}

type Vault = { root: string; attachmentFolder?: string; findByName: (name: string) => string | undefined };
const vaults = new Map<string, Vault | null>();

function findVault(mdPath: string): Vault | undefined {
  let dir = dirname(mdPath);
  while (true) {
    if (vaults.has(dir)) return vaults.get(dir) ?? undefined;
    if (existsSync(join(dir, ".obsidian"))) {
      const vault = openVault(dir);
      vaults.set(dir, vault);
      return vault;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function openVault(root: string): Vault {
  let attachmentFolder: string | undefined;
  try {
    const app = JSON.parse(readFileSync(join(root, ".obsidian", "app.json"), "utf8"));
    attachmentFolder = app.attachmentFolderPath && app.attachmentFolderPath !== "/" ? app.attachmentFolderPath : undefined;
  } catch {}
  let index: Map<string, string> | undefined;
  return {
    root,
    attachmentFolder,
    findByName(name) {
      if (!index) {
        index = new Map();
        for (const rel of new Bun.Glob("**/*").scanSync({ cwd: root, onlyFiles: true })) {
          if (rel.startsWith(".obsidian/") || rel.startsWith(".trash/")) continue;
          const key = basename(rel);
          if (!index.has(key)) index.set(key, join(root, rel));
        }
      }
      return index.get(name);
    },
  };
}

// 把每个图片引用改写成标准 Markdown 图片；mapSrc 返回 undefined 时保留原文。
// ![[x.png|300]] 会变成 ![](地址)，尺寸不保留。引用式图片和 <img> 不改写。
export function rewriteImages(body: string, refs: ImageRef[], mapSrc: (ref: ImageRef) => string | undefined) {
  let out = body;
  for (const ref of [...refs].sort((a, b) => b.index - a.index)) {
    if (ref.form === "reference" || ref.form === "html") continue;
    const src = mapSrc(ref);
    if (src === undefined) continue;
    const alt = ref.alt.replace(/[[\]]/g, "");
    out = out.slice(0, ref.index) + `![${alt}](${src})` + out.slice(ref.index + ref.raw.length);
  }
  return out;
}
