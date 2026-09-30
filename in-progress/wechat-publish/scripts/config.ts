import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, open, readFile, rename, stat, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { CoverCrop } from "./wechat";

export const HOME = process.env.WECHAT_PUBLISH_HOME ?? join(homedir(), ".config", "wechat-publish");
const ENV_FILE = join(HOME, ".env");
const STATE_FILE = join(HOME, "state.json");

export type Credentials = { appId: string; appSecret: string; author?: string; openComment: boolean };

// 环境变量优先，缺的字段再从 ~/.config/wechat-publish/.env 补。
export async function loadCredentials(): Promise<Credentials> {
  const file = await readEnvFile();
  const pick = (key: string) => process.env[key] || file[key] || undefined;
  const appId = pick("WECHAT_APP_ID");
  const appSecret = pick("WECHAT_APP_SECRET");
  if (!appId || !appSecret) {
    throw new Error(`缺少 WECHAT_APP_ID 或 WECHAT_APP_SECRET：设为环境变量，或写进 ${ENV_FILE}`);
  }
  // 账号没有留言权限时，设 WECHAT_OPEN_COMMENT=0，否则建草稿会报 88000。
  return { appId, appSecret, author: pick("WECHAT_AUTHOR"), openComment: pick("WECHAT_OPEN_COMMENT") !== "0" };
}

async function readEnvFile(): Promise<Record<string, string>> {
  const file = Bun.file(ENV_FILE);
  if (!(await file.exists())) return {};
  const out: Record<string, string> = {};
  for (const line of (await file.text()).split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

// 按 md 绝对路径记录草稿和封面素材，用来判断是否同一篇、封面是否要重传。
export type ArticleState = {
  draftId?: string;
  coverUrl?: string;
  coverMediaId?: string;
  coverCrop?: CoverCrop[];
  updatedAt?: string;
};
type State = { articles: Record<string, ArticleState> };

export async function readState(): Promise<State> {
  const file = Bun.file(STATE_FILE);
  if (!(await file.exists())) return { articles: {} };
  try {
    const state = (await file.json()) as State;
    state.articles ??= {};
    return state;
  } catch (err) {
    throw new Error(`${STATE_FILE} 不是合法的 JSON，修好或删掉后再发布（删掉后每篇都会新建草稿）：${err instanceof Error ? err.message : err}`);
  }
}

// 先写临时文件再改名，写到一半中断也不会留下损坏的 state.json；多个进程同时写时排队。
export async function saveArticleState(mdPath: string, patch: ArticleState) {
  await mkdir(HOME, { recursive: true });
  await withLock("state", { waitMs: 10_000 }, async () => {
    const state = await readState();
    state.articles[mdPath] = { ...state.articles[mdPath], ...patch, updatedAt: new Date().toISOString() };
    const tmp = `${STATE_FILE}.${process.pid}.tmp`;
    await Bun.write(tmp, JSON.stringify(state, null, 2) + "\n");
    await rename(tmp, STATE_FILE);
  });
}

// 按 md 路径加锁：同一篇文章同时发布两次时，第二次直接报错，避免建出两篇草稿。
export function lockArticle<T>(mdPath: string, run: () => Promise<T>) {
  const name = "article-" + createHash("sha1").update(mdPath).digest("hex").slice(0, 16);
  return withLock(name, { waitMs: 0, busy: "这篇文章正在发布，等上一次结束再试" }, run);
}

// 锁文件里记着进程号，进程已经退出的锁视为失效。
async function withLock<T>(name: string, opts: { waitMs: number; busy?: string }, run: () => Promise<T>): Promise<T> {
  await mkdir(join(HOME, "locks"), { recursive: true });
  const path = join(HOME, "locks", `${name}.lock`);
  const deadline = Date.now() + opts.waitMs;
  while (true) {
    try {
      const fd = await open(path, "wx");
      await fd.writeFile(String(process.pid));
      await fd.close();
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      const pid = Number(await readFile(path, "utf8").catch(() => ""));
      // 刚建好还没写进程号的锁，按占用处理。
      const fresh = !pid && Date.now() - ((await stat(path).catch(() => null))?.mtimeMs ?? 0) < 2000;
      if (!fresh && !alive(pid)) {
        await unlink(path).catch(() => {});
        continue;
      }
      if (Date.now() >= deadline) throw new Error(opts.busy ?? `等待锁超时：${path}`);
      await Bun.sleep(50);
    }
  }
  try {
    return await run();
  } finally {
    await unlink(path).catch(() => {});
  }
}

function alive(pid: number) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}
