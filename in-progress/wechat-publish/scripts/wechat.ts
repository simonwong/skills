import type { Credentials } from "./config";

const API = process.env.WECHAT_API_BASE ?? "https://api.weixin.qq.com";

const HINTS: Record<number, string> = {
  40001: "AppSecret 错误，或 access_token 已失效",
  40013: "AppID 无效",
  40125: "AppSecret 错误",
  40164: "当前出口 IP 不在白名单：到公众号后台「设置与开发 → 开发接口管理」把本机公网 IP 加进去",
  48001: "账号没有这个接口的权限（个人主体账号可能已被回收）",
  45002: "正文超出长度限制",
  45003: "标题超出长度限制",
  45004: "摘要超出长度限制",
  45009: "接口今天的调用次数用完了，明天再试",
  45011: "调用太频繁，稍后再试",
  40007: "media_id 无效，草稿可能已发表或被删除",
  40113: "不支持的图片格式",
  40005: "不支持的文件类型",
  40006: "文件过大",
  40009: "图片过大",
  88000: "账号没有留言权限：在 ~/.config/wechat-publish/.env 里设 WECHAT_OPEN_COMMENT=0",
};

export class WechatError extends Error {
  constructor(
    public api: string,
    public code: number,
    msg: string,
  ) {
    super(`${api} 失败（${code} ${msg}）${HINTS[code] ? `：${HINTS[code]}` : ""}`);
  }
}

export type Upload = { bytes: Uint8Array; filename: string; mime: string };

// 封面裁剪：坐标按图片宽高归一化，左上角 (0,0)，右下角 (1,1)。
export type CoverCrop = { ratio: "2.35_1" | "1_1"; x1: string; y1: string; x2: string; y2: string };

export type DraftArticle = {
  title: string;
  author?: string;
  digest?: string;
  content: string;
  thumb_media_id: string;
  need_open_comment?: 0 | 1;
  cover_info?: { crop_percent_list: CoverCrop[] };
};

export class Wechat {
  private token?: { value: string; expiresAt: number };

  constructor(private creds: Credentials) {}

  private async accessToken() {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    const res = await call<{ access_token: string; expires_in: number }>("stable_token", `${API}/cgi-bin/stable_token`, {
      method: "POST",
      body: JSON.stringify({ grant_type: "client_credential", appid: this.creds.appId, secret: this.creds.appSecret }),
    });
    this.token = { value: res.access_token, expiresAt: Date.now() + (res.expires_in - 300) * 1000 };
    return res.access_token;
  }

  private async url(path: string, query = "") {
    return `${API}${path}?access_token=${await this.accessToken()}${query}`;
  }

  // 正文图片：只收 jpg/png 且小于 1MB，不占素材库。
  async uploadArticleImage(file: Upload) {
    const res = await call<{ url: string }>("uploadimg", await this.url("/cgi-bin/media/uploadimg"), { body: form(file) });
    return res.url;
  }

  // 永久图片素材：封面必须走这里；正文里的 gif 也走这里（上限 10MB），占素材库额度。
  async addImageMaterial(file: Upload) {
    return call<{ media_id: string; url: string }>(
      "add_material",
      await this.url("/cgi-bin/material/add_material", "&type=image"),
      { body: form(file) },
    );
  }

  async addDraft(article: DraftArticle) {
    const res = await call<{ media_id: string }>("draft/add", await this.url("/cgi-bin/draft/add"), {
      method: "POST",
      body: JSON.stringify({ articles: [article] }),
    });
    return res.media_id;
  }

  async updateDraft(mediaId: string, article: DraftArticle) {
    await call("draft/update", await this.url("/cgi-bin/draft/update"), {
      method: "POST",
      body: JSON.stringify({ media_id: mediaId, index: 0, articles: article }),
    });
  }

  // 草稿还在草稿箱里就返回 true；已发表或被删掉时接口报 40007，返回 false。其他错误照常抛出。
  async draftExists(mediaId: string) {
    try {
      await call("draft/get", await this.url("/cgi-bin/draft/get"), { method: "POST", body: JSON.stringify({ media_id: mediaId }) });
      return true;
    } catch (err) {
      if (err instanceof WechatError && err.code === 40007) return false;
      throw err;
    }
  }

  async materialCount() {
    const res = await call<{ image_count: number }>("get_materialcount", await this.url("/cgi-bin/material/get_materialcount"), {});
    return res.image_count;
  }

  async draftCount() {
    const res = await call<{ total_count: number }>("draft/count", await this.url("/cgi-bin/draft/count"), {});
    return res.total_count;
  }
}

function form(file: Upload) {
  const data = new FormData();
  data.append("media", new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: file.mime }), file.filename);
  return data;
}

async function call<T = unknown>(api: string, url: string, init: RequestInit & { body?: BodyInit }): Promise<T> {
  const method = init.method ?? (init.body ? "POST" : "GET");
  let res: Response;
  try {
    res = await fetch(url, { ...init, method, signal: AbortSignal.timeout(60_000) });
  } catch (err) {
    throw new Error(`${api} 请求失败：${err instanceof Error ? err.message : err}`);
  }
  const text = await res.text();
  let data: T & { errcode?: number; errmsg?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${api} 返回的不是 JSON（HTTP ${res.status}）：${text.slice(0, 200)}`);
  }
  if (data.errcode) throw new WechatError(api, data.errcode, data.errmsg ?? "");
  return data;
}
