import type { RawServerMetrics } from '@/types/server';

/**
 * 服务器只读指标端点客户端。
 *
 * 端点约定见 src/types/server.ts；配套采集脚本见 scripts/server-metrics-agent.mjs。
 * 浏览器直连要求端点返回 CORS 头，且注意 https 页面无法请求 http 端点（混合内容）。
 */

export type ServerMetricsErrorKind =
  | 'no-endpoint'
  | 'network'
  | 'bad-status'
  | 'non-json'
  | 'malformed';

export class ServerMetricsError extends Error {
  readonly kind: ServerMetricsErrorKind;

  constructor(kind: ServerMetricsErrorKind, message: string) {
    super(message);
    this.name = 'ServerMetricsError';
    this.kind = kind;
  }
}

/** 规整端点地址：去空白、去尾部斜杠。空串表示未配置。 */
export function normalizeEndpoint(input: string): string {
  return input.trim().replace(/\/+$/, '');
}

export async function fetchServerMetrics(endpoint: string): Promise<RawServerMetrics> {
  const url = normalizeEndpoint(endpoint);
  if (!url) {
    throw new ServerMetricsError('no-endpoint', '还没有配置服务器指标端点地址');
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new ServerMetricsError('no-endpoint', '端点地址必须以 http(s):// 开头');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    throw new ServerMetricsError(
      'network',
      `无法连接 ${url}，请检查地址、CORS 与混合内容限制（https 页面不能请求 http）`,
    );
  }

  if (!response.ok) {
    throw new ServerMetricsError('bad-status', `端点返回 HTTP ${response.status}`);
  }

  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ServerMetricsError('non-json', '端点返回了非 JSON 响应');
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new ServerMetricsError('malformed', '端点返回的 JSON 不是对象');
  }

  return payload as RawServerMetrics;
}
