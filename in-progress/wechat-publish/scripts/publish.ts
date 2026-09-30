import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { loadCredentials, lockArticle, readState, saveArticleState } from "./config";
import { coverRef, readArticle, rewriteImages, scanImages, type Article, type ImageRef } from "./article";
import { lintMeta } from "./lint";
import { renderBody } from "./render";
import { Wechat, type CoverCrop, type Upload } from "./wechat";

export type PublishResult = {
  path: string;
  action: "created" | "updated";
  draftId: string;
  uploaded: number;
  coverUploaded: boolean;
  htmlLength: number;
  warnings: string[];
};

// 按十进制算，留一点余量：接口写的是 1MB 和 10MB。
const MB = 1000 * 1000;
const BODY_LIMIT = MB;
const MATERIAL_LIMIT = 10 * MB;
const MMBIZ = /^https?:\/\/mmbiz\.qpic\.cn\//i;

// 正文图片：jpg/png 走 uploadimg，gif 只能走永久素材。
type Prepared = { file: Upload; via: "uploadimg" | "material" };

// 上传封面和非 mmbiz 图片，把 mmbiz 地址写回 md，再新建或更新草稿。同一篇文章同时只能有一次发布。
export async function publish(mdPath: string): Promise<PublishResult> {
  const article = await readArticle(mdPath);
  return lockArticle(article.path, () => publishLocked(article.path));
}

async function publishLocked(path: string): Promise<PublishResult> {
  const creds = await loadCredentials();
  const api = new Wechat(creds);
  const prev = (await readState()).articles[path] ?? {};
  let article = await readArticle(path);
  if (!article.frontmatter.title) throw new Error("frontmatter 缺少 title");

  const refs = scanImages(article);
  const cover = coverRef(article);
  if (!cover) throw new Error("frontmatter 缺少 coverImage，草稿必须有封面");
  const missing = [...refs, cover].filter((r) => r.error).map((r) => r.error);
  if (missing.length) throw new Error(missing.join("\n"));

  // 1. 先把要上传的图片全部读进来、检查格式、压缩好，任何一张有问题都在上传前报错。
  const pending = new Map<string, Prepared>();
  for (const ref of refs) {
    if (ref.kind === "mmbiz" || pending.has(key(ref))) continue;
    pending.set(key(ref), await prepareBodyImage(ref));
  }
  const coverUploaded = !(cover.kind === "mmbiz" && prev.coverMediaId && prev.coverUrl === cover.src);
  const coverFile = coverUploaded ? await shrink(await load(cover), MATERIAL_LIMIT) : undefined;

  // 2. 正文图片：同一个来源只传一次。
  const uploaded = new Map<string, string>();
  for (const [k, { file, via }] of pending) {
    uploaded.set(k, via === "uploadimg" ? await api.uploadArticleImage(file) : (await api.addImageMaterial(file)).url);
  }

  // 3. 封面：地址和上次上传的一致就复用素材 ID 和裁剪。
  let coverUrl = cover.src;
  let coverMediaId = prev.coverMediaId;
  let coverCrop = prev.coverCrop;
  if (coverFile) {
    const res = await api.addImageMaterial(coverFile);
    coverUrl = res.url;
    coverMediaId = res.media_id;
    coverCrop = cropFor(coverFile);
    await saveArticleState(path, { coverUrl, coverMediaId, coverCrop });
  }

  // 4. 写回 md：重新读一次，保留上传期间对原文的改动。
  article = await writeBack(path, uploaded, coverFile ? coverUrl : undefined);
  const leftover = scanImages(article).filter((r) => r.kind !== "mmbiz");
  if (leftover.length) throw new Error(`还有图片没转成公众号地址：${leftover.map((r) => r.src).join("、")}`);

  // 5. 渲染并检查：正文里只能有 mmbiz 图片，其他地址公众号会过滤掉。
  const content = await renderBody(article.body);
  const foreign = [...content.matchAll(/<img\b[^>]*?\ssrc="([^"]*)"/g)].map((m) => m[1]).filter((src) => !MMBIZ.test(src));
  if (foreign.length) throw new Error(`正文里有图片不是公众号地址，发布后不会显示：${foreign.join("、")}`);

  const draft = {
    title: String(article.frontmatter.title),
    author: creds.author,
    digest: typeof article.frontmatter.summary === "string" ? article.frontmatter.summary : undefined,
    content,
    thumb_media_id: coverMediaId!,
    need_open_comment: creds.openComment ? (1 as const) : (0 as const),
    ...(coverCrop ? { cover_info: { crop_percent_list: coverCrop } } : {}),
  };

  // 6. 草稿还在就更新；已发表或被删掉就新建。
  let draftId = prev.draftId && (await api.draftExists(prev.draftId)) ? prev.draftId : undefined;
  const action: PublishResult["action"] = draftId ? "updated" : "created";
  if (draftId) await api.updateDraft(draftId, draft);
  else draftId = await api.addDraft(draft);
  await saveArticleState(path, { draftId });

  return {
    path,
    action,
    draftId,
    uploaded: uploaded.size,
    coverUploaded: Boolean(coverFile),
    htmlLength: content.length,
    warnings: [
      ...(creds.author ? [] : ["没有设置作者：在 ~/.config/wechat-publish/.env 里加 WECHAT_AUTHOR"]),
      ...lintMeta(article, content).map((h) => h.text),
    ],
  };
}

// 3.35:1 的封面是左右拼接的两张图（codex-wechat-cover 的默认输出）：
// 左边 2.35:1 用在消息列表，右边 1:1 用在转发卡片和次条。其他比例交给公众号默认裁剪。
function cropFor(file: Upload): CoverCrop[] | undefined {
  const size = imageSize(file.bytes);
  if (!size || Math.abs(size.width / size.height - 3.35) > 0.03) return undefined;
  const at = (n: number) => String(Math.min(1, Math.max(0, n)).toFixed(6));
  return [
    { ratio: "2.35_1", x1: "0", y1: "0", x2: at((size.height * 2.35) / size.width), y2: "1" },
    { ratio: "1_1", x1: at((size.width - size.height) / size.width), y1: "0", x2: "1", y2: "1" },
  ];
}

// 从文件头读宽高，支持 png、jpg、gif。
function imageSize(b: Uint8Array): { width: number; height: number } | undefined {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b[0] === 0x89 && b.length > 24) return { width: v.getUint32(16), height: v.getUint32(20) };
  if (b[0] === 0x47 && b.length > 10) return { width: v.getUint16(6, true), height: v.getUint16(8, true) };
  if (b[0] === 0xff) {
    for (let i = 2; i + 9 < b.length; ) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: v.getUint16(i + 5), width: v.getUint16(i + 7) };
      }
      i += 2 + v.getUint16(i + 2);
    }
  }
  return undefined;
}

function key(ref: ImageRef) {
  return ref.path ?? ref.src;
}

async function writeBack(path: string, uploaded: Map<string, string>, coverUrl?: string): Promise<Article> {
  const fresh = await readArticle(path);
  const body = rewriteImages(fresh.body, scanImages(fresh), (ref) => (ref.kind === "mmbiz" ? undefined : uploaded.get(key(ref))));
  // coverRef 已确认 coverImage 只占一行。
  const frontmatterText = coverUrl
    ? fresh.frontmatterText.replace(/^coverImage:.*$/m, `coverImage: "${coverUrl}"`)
    : fresh.frontmatterText;
  const next = frontmatterText + body;
  if (next !== fresh.source) await Bun.write(path, next);
  return readArticle(path);
}

async function prepareBodyImage(ref: ImageRef): Promise<Prepared> {
  const file = await load(ref);
  if (file.mime === "image/gif") {
    if (file.bytes.length > MATERIAL_LIMIT) throw new Error(`gif 超过 10MB，先压缩：${label(ref)}`);
    return { file, via: "material" };
  }
  // 非 macOS 没有 sips，超过 1MB 的图片改走永久素材。
  if (file.bytes.length > BODY_LIMIT && process.platform !== "darwin") return { file, via: "material" };
  return { file: await shrink(file, BODY_LIMIT), via: "uploadimg" };
}

async function load(ref: ImageRef): Promise<Upload> {
  let bytes: Uint8Array;
  if (ref.path) {
    bytes = await Bun.file(ref.path).bytes();
  } else {
    const res = await fetch(ref.src, { signal: AbortSignal.timeout(60_000) }).catch((err) => {
      throw new Error(`下载图片失败（${err instanceof Error ? err.message : err}）：${ref.src}`);
    });
    if (!res.ok) throw new Error(`下载图片失败（${res.status}）：${ref.src}`);
    bytes = new Uint8Array(await res.arrayBuffer());
  }
  let mime = sniff(bytes);
  const name = basename(ref.path ?? new URL(ref.src).pathname).replace(/\.[^.]*$/, "") || "image";
  if (mime === "image/webp") {
    bytes = await sipsConvert(bytes, ["-s", "format", "png"], "png", label(ref));
    mime = "image/png";
  }
  if (!mime) throw new Error(`不支持的图片格式，只支持 png、jpg、gif、webp：${label(ref)}`);
  return { bytes, mime, filename: `${name}.${mime.split("/")[1].replace("jpeg", "jpg")}` };
}

function label(ref: ImageRef) {
  return ref.path ?? ref.src;
}

function sniff(b: Uint8Array) {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return undefined;
}

// 超过上限的 jpg/png 用 sips 压缩：先转 jpg（带透明的 png 保持 png），还不够就逐级缩小长边，最后降低 jpg 质量。
async function shrink(file: Upload, limit: number): Promise<Upload> {
  if (file.bytes.length <= limit) return file;
  if (file.mime === "image/gif") throw new Error(`gif 超过 ${limit / MB}MB，先压缩：${file.filename}`);
  if (process.platform !== "darwin") throw new Error(`图片超过 ${limit / MB}MB，先压缩：${file.filename}`);
  const info = await sipsInfo(file.bytes);
  const png = file.mime === "image/png" && info.hasAlpha;
  const longest = Math.max(info.width, info.height);
  // 长边本来就不超过目标尺寸时不缩放（记为 0），去重后按顺序尝试。
  const steps = [[0, 82], [2400, 82], [1800, 82], [1400, 82], [1080, 82], [1080, 70], [1080, 60]]
    .filter(([, quality]) => !(png && quality < 82))
    .map(([max, quality]) => [max < longest ? max : 0, quality])
    .filter(([max, quality], i, all) => all.findIndex(([m, q]) => m === max && q === quality) === i);
  for (const [max, quality] of steps) {
    const format = png ? ["-s", "format", "png"] : ["-s", "format", "jpeg", "-s", "formatOptions", String(quality)];
    const bytes = await sipsConvert(file.bytes, max ? [...format, "-Z", String(max)] : format, png ? "png" : "jpg", file.filename);
    if (bytes.length <= limit) {
      return { bytes, mime: png ? "image/png" : "image/jpeg", filename: file.filename.replace(/\.[^.]*$/, png ? ".png" : ".jpg") };
    }
  }
  throw new Error(`图片压缩后还是超过 ${limit / MB}MB，先手动压缩：${file.filename}`);
}

async function sipsInfo(bytes: Uint8Array) {
  return withTemp(bytes, async (input) => {
    const out = sh(["sips", "-g", "pixelWidth", "-g", "pixelHeight", "-g", "hasAlpha", input], "读取图片信息失败");
    const num = (k: string) => Number(out.match(new RegExp(`${k}: (\\d+)`))?.[1] ?? 0);
    return { width: num("pixelWidth"), height: num("pixelHeight"), hasAlpha: /hasAlpha: yes/.test(out) };
  });
}

// 公众号不收 webp，也要靠它压缩大图；只在 macOS 上可用。
async function sipsConvert(bytes: Uint8Array, args: string[], ext: string, what: string) {
  if (process.platform !== "darwin") throw new Error(`公众号不支持 webp，请先转成 png 或 jpg：${what}`);
  return withTemp(bytes, async (input, dir) => {
    const output = join(dir, `out.${ext}`);
    sh(["sips", ...args, input, "--out", output], `图片转换失败：${what}`);
    return Bun.file(output).bytes();
  });
}

async function withTemp<T>(bytes: Uint8Array, use: (input: string, dir: string) => Promise<T>) {
  const dir = await mkdtemp(join(tmpdir(), "wechat-publish-"));
  try {
    const input = join(dir, "in");
    await Bun.write(input, bytes);
    return await use(input, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function sh(cmd: string[], failure: string) {
  const proc = Bun.spawnSync(cmd);
  if (proc.exitCode !== 0) throw new Error(`${failure}：${proc.stderr.toString().trim()}`);
  return proc.stdout.toString();
}
