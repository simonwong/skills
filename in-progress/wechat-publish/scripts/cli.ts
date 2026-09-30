import { parseArgs } from "node:util";
import { loadCredentials } from "./config";
import { startPreview } from "./preview";
import { publish } from "./publish";
import { Wechat } from "./wechat";
import { join } from "node:path";

const SAMPLE = join(import.meta.dir, "..", "assets", "sample.md");

const USAGE = `用法：
  bun cli.ts preview [文章.md] [--port 4321] [--no-open]   本地预览，页面上可一键发布；不带文章时打开样例，用来调样式
  bun cli.ts publish <文章.md>                              上传图片、写回地址、新建或更新草稿
  bun cli.ts check                                          检查凭证、IP 白名单、素材和草稿接口权限`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { port: { type: "string", default: "4321" }, "no-open": { type: "boolean", default: false } },
});
const [command, file] = positionals;

try {
  if (command === "preview") {
    const port = Number(values.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`端口不对：${values.port}\n\n${USAGE}`);
    const server = await startPreview(file ?? SAMPLE, port, { readonly: !file });
    if (server.reused) console.log(`这篇文章已经在预览，沿用原来的服务`);
    else if (server.port !== port) console.log(`端口 ${port} 被占用，改用 ${server.port}`);
    console.log(`预览地址：${server.url}`);
    if (!values["no-open"]) openBrowser(server.url.href);
    if (server.reused) process.exit(0);
  } else if (command === "publish" && file) {
    console.log(JSON.stringify(await publish(file), null, 2));
  } else if (command === "check") {
    const creds = await loadCredentials();
    const api = new Wechat(creds);
    const drafts = await api.draftCount();
    const images = await api.materialCount();
    console.log(`凭证、白名单、素材和草稿接口都可用：草稿箱 ${drafts} 篇，图片素材 ${images} 张`);
    console.log(`作者：${creds.author ?? "未设置（WECHAT_AUTHOR）"}；留言：${creds.openComment ? "开启" : "关闭"}`);
  } else {
    console.log(USAGE);
    process.exit(command ? 1 : 0);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

// 打不开浏览器不影响预览，地址已经打印出来了。
function openBrowser(url: string) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  try {
    Bun.spawn([cmd, url], { stdout: "ignore", stderr: "ignore" });
  } catch {
    console.log(`没能自动打开浏览器，手动打开上面的地址`);
  }
}
