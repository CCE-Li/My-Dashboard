import type { RawKline, RawPositionRisk, RawTicker24h } from '@/types/binance';

/**
 * 币安 U 本位合约 API 客户端。
 *
 * 两类接口：
 * - 公开（行情/K 线）：无需签名，直接从浏览器调用（实测 fapi 返回
 *   `Access-Control-Allow-Origin: *`）
 * - 签名（持仓）：需要 API key + secret，用 Web Crypto 做 HMAC-SHA256
 *
 * ⚠️ secret 保存在本机 localStorage 并由浏览器签名，这意味着它对你的账户
 * 有完整权限。务必使用只读 key（关闭合约交易与提现）并配置 IP 白名单。
 */

export const DEFAULT_BINANCE_BASE_URL = 'https://fapi.binance.com';

/**
 * 允许自定义 API 根地址（例如自建反代）。币安在部分地区不可直接访问，
 * 这时把地址换成自己的代理是唯一安全的做法 —— 不要把 key 交给公共 CORS 代理。
 */
export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_BINANCE_BASE_URL;
  if (!/^https?:\/\//i.test(trimmed)) return DEFAULT_BINANCE_BASE_URL;
  return trimmed;
}

/** rechunk：请求有效窗口，签名时一并发送 */
const RECV_WINDOW_MS = 5000;

export type BinanceErrorKind =
  | 'no-credentials'
  | 'network'
  | 'non-json'
  | 'api'
  | 'crypto-unavailable'
  | 'rate-limited';

export class BinanceApiError extends Error {
  readonly kind: BinanceErrorKind;
  readonly code: number | null;

  constructor(kind: BinanceErrorKind, message: string, code: number | null = null) {
    super(message);
    this.name = 'BinanceApiError';
    this.kind = kind;
    this.code = code;
  }
}

/** 把币安常见错误码翻译成人话，减少看文档的次数。 */
function describeCode(code: number, msg: string): string {
  switch (code) {
    case -2015:
      return `${msg}（API key 无效、IP 不在白名单，或该 key 没有合约读取权限）`;
    case -2014:
      return `${msg}（API key 格式不正确）`;
    case -1021:
      return `${msg}（本机时间与服务器偏差过大，稍后重试或校准系统时间）`;
    case -1102:
      return `${msg}（缺少必填参数）`;
    case -1003:
      return `${msg}（触发频率限制，稍后再试）`;
    default:
      return msg ? `${msg}（code=${code}）` : `请求失败（code=${code}）`;
  }
}

function toQuery(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // 币安在部分地区/异常情况下会返回 HTML 错误页，而不是 JSON
    throw new BinanceApiError(
      'non-json',
      `币安返回了非 JSON 响应（HTTP ${response.status}），可能是地域限制或网络被拦截`,
    );
  }
}

function assertOk(response: Response, payload: unknown): void {
  if (response.ok) return;

  const record = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
  const code = record && typeof record['code'] === 'number' ? record['code'] : null;
  const msg = record && typeof record['msg'] === 'string' ? record['msg'] : '';

  if (code !== null) {
    throw new BinanceApiError(
      response.status === 429 || code === -1003 ? 'rate-limited' : 'api',
      describeCode(code, msg),
      code,
    );
  }

  throw new BinanceApiError('api', `请求失败（HTTP ${response.status}）`);
}

async function publicGet<T>(
  path: string,
  params: Record<string, string | number> = {},
  baseUrl: string = DEFAULT_BINANCE_BASE_URL,
): Promise<T> {
  const query = toQuery(params);
  const url = `${baseUrl}${path}${query ? `?${query}` : ''}`;

  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new BinanceApiError(
      'network',
      `无法连接 ${baseUrl}，请检查网络/代理，或在设置里填写自建代理地址`,
    );
  }

  const payload = await readJson(response);
  assertOk(response, payload);
  return payload as T;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new BinanceApiError(
      'crypto-unavailable',
      '当前环境不支持 Web Crypto（需要 https 或 localhost），无法签名请求',
    );
  }

  const encoder = new TextEncoder();
  const key = await subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await subtle.sign('HMAC', key, encoder.encode(payload));

  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** 与币安服务器的时间偏差，签名时的 timestamp 用它校正。 */
export async function fetchServerTimeOffset(
  baseUrl: string = DEFAULT_BINANCE_BASE_URL,
): Promise<number> {
  const payload = await publicGet<{ serverTime?: number }>('/fapi/v1/time', {}, baseUrl);
  if (typeof payload.serverTime !== 'number') {
    throw new BinanceApiError('api', '币安未返回服务器时间');
  }
  return payload.serverTime - Date.now();
}

async function signedGet<T>(
  path: string,
  params: Record<string, string | number>,
  apiKey: string,
  secret: string,
  timeOffsetMs: number,
  baseUrl: string,
): Promise<T> {
  if (!apiKey.trim() || !secret.trim()) {
    throw new BinanceApiError('no-credentials', '还没有配置币安 API key / secret');
  }

  const signed = toQuery({
    ...params,
    recvWindow: RECV_WINDOW_MS,
    timestamp: Date.now() + timeOffsetMs,
  });
  const signature = await hmacSha256Hex(secret.trim(), signed);
  const url = `${baseUrl}${path}?${signed}&signature=${signature}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-MBX-APIKEY': apiKey.trim(),
      },
    });
  } catch {
    throw new BinanceApiError(
      'network',
      `无法连接 ${baseUrl}，请检查网络/代理，或在设置里填写自建代理地址`,
    );
  }

  const payload = await readJson(response);
  assertOk(response, payload);
  return payload as T;
}

/** 当前持仓（含未实现盈亏）。空仓会被调用方过滤掉。 */
export function fetchPositionRisk(
  apiKey: string,
  secret: string,
  timeOffsetMs: number,
  baseUrl: string = DEFAULT_BINANCE_BASE_URL,
): Promise<RawPositionRisk[]> {
  return signedGet<RawPositionRisk[]>(
    '/fapi/v1/positionRisk',
    {},
    apiKey,
    secret,
    timeOffsetMs,
    baseUrl,
  );
}

/** 24 小时行情（公开接口）。 */
export function fetchTicker24h(
  symbol: string,
  baseUrl: string = DEFAULT_BINANCE_BASE_URL,
): Promise<RawTicker24h> {
  return publicGet<RawTicker24h>('/fapi/v1/ticker/24hr', { symbol }, baseUrl);
}

/** 最近 N 根 K 线（公开接口），默认 1 小时线 24 根。 */
export function fetchKlines(
  symbol: string,
  interval = '1h',
  limit = 24,
  baseUrl: string = DEFAULT_BINANCE_BASE_URL,
): Promise<RawKline[]> {
  return publicGet<RawKline[]>('/fapi/v1/klines', { symbol, interval, limit }, baseUrl);
}

/** 连通性自检：分三步报告，便于定位「连不上」到底卡在哪一环。 */
export interface BinancePingStep {
  step: 'reachability' | 'public-read' | 'auth';
  ok: boolean;
  detail: string;
}

export async function selfCheck(
  apiKey: string,
  secret: string,
  baseUrl: string = DEFAULT_BINANCE_BASE_URL,
): Promise<BinancePingStep[]> {
  const steps: BinancePingStep[] = [];

  let timeOffset = 0;
  try {
    timeOffset = await fetchServerTimeOffset(baseUrl);
    steps.push({ step: 'reachability', ok: true, detail: `可达（时间偏差 ${timeOffset}ms）` });
    steps.push({ step: 'public-read', ok: true, detail: '公开接口可读（服务器时间已取到）' });
  } catch (caught) {
    const detail = caught instanceof Error ? caught.message : String(caught);
    steps.push({ step: 'reachability', ok: false, detail });
    steps.push({ step: 'public-read', ok: false, detail: '网络不通，后续步骤已跳过' });
    steps.push({ step: 'auth', ok: false, detail: '网络不通，未测试' });
    return steps;
  }

  if (!apiKey.trim() || !secret.trim()) {
    steps.push({ step: 'auth', ok: false, detail: '未填写 key / secret，跳过鉴权' });
    return steps;
  }

  try {
    const positions = await fetchPositionRisk(apiKey, secret, timeOffset, baseUrl);
    const open = positions.filter((item) => Number(item.positionAmt) !== 0).length;
    steps.push({ step: 'auth', ok: true, detail: `鉴权通过，当前 ${open} 个持仓` });
  } catch (caught) {
    steps.push({
      step: 'auth',
      ok: false,
      detail: caught instanceof Error ? caught.message : String(caught),
    });
  }

  return steps;
}
