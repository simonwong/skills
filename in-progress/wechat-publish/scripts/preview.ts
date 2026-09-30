import { existsSync, watch } from "node:fs";
import { load } from "cheerio";
import { basename, dirname, join } from "node:path";
import { coverRef, readArticle, rewriteImages, scanImages, type ImageRef } from "./article";
import { publish } from "./publish";
import { lintBody, lintMeta } from "./lint";
import { highlightMarkdown, renderBody, THEME_PATH } from "./render";

const PAGE = join(import.meta.dir, "preview.html");
// 微信读者端暗黑模式用的转换算法，预览暗色时在 iframe 里运行。
const DARKMODE = join(import.meta.dir, "node_modules", "mp-darkmode", "dist", "darkmode.min.js");

// readonly：预览样例时不允许发布。
// 端口上已经是同一篇文章的预览时直接复用（reused 为 true）；端口被别的程序占用时换一个空闲端口。
export async function startPreview(mdPath: string, port: number, { readonly = false } = {}) {
  const article = await readArticle(mdPath);
  const existing = await findPreview(port, article.path);
  if (existing) return { url: existing, port, reused: true };
  const allowed = new Set<string>();
  const clients = new Set<ReadableStreamDefaultController>();

  // 本地图片走 /file 由本服务读取；外链和 mmbiz 原样显示（页面带 no-referrer）。
  const previewSrc = (ref: ImageRef) => {
    if (!ref.path) return ref.kind === "local" ? "" : ref.src;
    allowed.add(ref.path);
    return `/file?p=${encodeURIComponent(ref.path)}`;
  };

  async function doc() {
    if (!existsSync(article.path)) throw new Error(`找不到 ${article.path}：文件可能被改名或移动了，用新路径重新运行 preview`);
    const a = await readArticle(article.path);
    const refs = scanImages(a);
    const cover = coverRef(a);
    const count = (kind: string) => refs.filter((r) => r.kind === kind && !r.error).length;
    const html = await renderBody(rewriteImages(a.body, refs, previewSrc));
    const firstLine = a.frontmatterText.split("\n").length;
    return {
      path: a.path,
      name: basename(a.path),
      markdown: highlightMarkdown(a.source),
      title: String(a.frontmatter.title ?? ""),
      summary: String(a.frontmatter.summary ?? ""),
      readonly,
      cover: cover && !cover.error ? previewSrc(cover) : "",
      images: { local: count("local"), remote: count("remote"), mmbiz: count("mmbiz") },
      errors: [...refs, ...(cover ? [cover] : [])].flatMap((r) => (r.error ? [r.error] : [])),
      html,
      textLength: load(html).text().replace(/\s/g, "").length,
      hints: [...lintMeta(a, html), ...lintBody(a.body, String(a.frontmatter.title ?? ""), firstLine)],
    };
  }

  // md 或样式保存后通知页面重新取内容；预览页本身改了就整页重载。监听目录而不是文件，编辑器原子写入替换文件时也能收到。
  const timers = new Map<string, Timer>();
  const notify = (message: string) => {
    clearTimeout(timers.get(message));
    timers.set(message, setTimeout(() => {
      for (const c of clients) c.enqueue(`data: ${message}\n\n`);
    }, 120));
  };
  // 文件名按 NFC 比较：macOS 上事件里的文件名可能是 NFD。
  for (const [file, message] of [[article.path, "change"], [THEME_PATH, "change"], [PAGE, "reload"]]) {
    const target = basename(file).normalize("NFC");
    watch(dirname(file), (_, name) => name?.normalize("NFC") === target && notify(message));
  }
  // 每次启动换一个 id：页面重连后发现 id 变了，说明服务重启过（可能换了新代码），整页重载。
  const boot = crypto.randomUUID();

  const serve = (port: number) => Bun.serve({
    hostname: "127.0.0.1",
    port,
    idleTimeout: 0,
    async fetch(req, server) {
      const url = new URL(req.url);
      // 只接受本机页面的请求：Host 防 DNS rebinding，发布再校验 Origin，别的网站不能借浏览器触发发布。
      const self = [`127.0.0.1:${server.port}`, `localhost:${server.port}`];
      if (!self.includes(req.headers.get("host") ?? "")) return new Response("forbidden", { status: 403 });
      if (url.pathname === "/") return new Response(Bun.file(PAGE));
      if (url.pathname === "/darkmode.js") return new Response(Bun.file(DARKMODE));
      if (url.pathname === "/api/doc") return json(doc);
      if (url.pathname === "/api/publish" && req.method === "POST" && !readonly) {
        const origin = req.headers.get("origin") ?? "";
        if (!self.some((h) => origin === `http://${h}`)) return new Response("forbidden", { status: 403 });
        return json(() => publish(article.path));
      }
      if (url.pathname === "/file") {
        const p = url.searchParams.get("p") ?? "";
        return allowed.has(p) ? new Response(Bun.file(p)) : new Response("not found", { status: 404 });
      }
      if (url.pathname === "/events") {
        let self: ReadableStreamDefaultController;
        let ping: Timer;
        return new Response(
          new ReadableStream({
            start(c) {
              self = c;
              clients.add(c);
              c.enqueue(`event: boot\ndata: ${boot}\n\n`);
              ping = setInterval(() => c.enqueue(": ping\n\n"), 20_000);
            },
            cancel() {
              clients.delete(self);
              clearInterval(ping);
            },
          }),
          { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } },
        );
      }
      return new Response("not found", { status: 404 });
    },
  });
  let server: ReturnType<typeof serve>;
  try {
    server = serve(port);
  } catch {
    server = serve(0);
  }
  return { url: server.url, port: server.port, reused: false };
}

// 看端口上是不是已经在预览同一篇文章。
async function findPreview(port: number, path: string) {
  const url = new URL(`http://127.0.0.1:${port}/`);
  try {
    const res = await fetch(new URL("/api/doc", url), { signal: AbortSignal.timeout(1000) });
    const d = (await res.json()) as { path?: string };
    return d.path === path ? url : undefined;
  } catch {
    return undefined;
  }
}

async function json(run: () => Promise<unknown>) {
  try {
    return Response.json(await run());
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
