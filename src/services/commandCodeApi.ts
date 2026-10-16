import { APP_CONFIG } from '@/config/app.config';

/**
 * Command Code Provider API 客户端。
 *
 * 现状说明（很重要）：官方 Provider API 只有 5 个端点，全部是**调用模型**用的
 * （chat/completions、responses、messages、models、systemone），**没有任何读取
 * 账号用量的端点**。官方文档也明确要求不要用 API 探测去获取用量。
 *
 * 因此这里只做一件事：验证一个 API key 是否真的能通过鉴权。
 * 磁贴上的用量数字仍然来自 `npm run sync:usage` 生成的本地快照，key 不参与计算。
 */

export type ApiKeyCheckStatus =
  | 'valid'
  | 'invalid'
  | 'no-access'
  | 'inconclusive'
  | 'unreachable';

export interface ApiKeyCheckResult {
  status: ApiKeyCheckStatus;
  detail: string;
}

/**
 * 鉴权探测：故意用一个不存在的模型 id 发一次最小请求。
 *
 * 依据官方错误表：
 * - 未鉴权/鉴权失败 → 401 authentication_error
 * - 鉴权通过但模型不在目录里 → 400 unsupported_model
 * - Go 套餐（唯一没有 API 访问权的套餐）→ 403 upgrade_required
 *
 * 因为模型不存在，服务端不会真的跑推理，所以这个探测**不消耗额度**。
 */
export const PROBE_MODEL = '__cmd_api_probe_nonexistent__';

function readErrorEnvelope(payload: unknown): { code: string; type: string; message: string } {
  if (typeof payload !== 'object' || payload === null) {
    return { code: '', type: '', message: '' };
  }
  const error = (payload as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) {
    return { code: '', type: '', message: '' };
  }
  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === 'string' ? record.code : '',
    type: typeof record.type === 'string' ? record.type : '',
    message: typeof record.message === 'string' ? record.message : '',
  };
}

/** 把 HTTP 状态与响应体映射成结论。纯函数，便于单测。 */
export function classifyKeyCheck(httpStatus: number, payload: unknown): ApiKeyCheckResult {
  const { code, type, message } = readErrorEnvelope(payload);
  const suffix = message ? `：${message}` : '';

  if (httpStatus === 401) {
    return {
      status: 'invalid',
      detail: `鉴权失败，这个 key 无效或已被撤销（HTTP 401${suffix}）`,
    };
  }

  if (httpStatus === 403) {
    return {
      status: 'no-access',
      detail: `key 有效，但所在套餐没有 API 访问权限${suffix}`,
    };
  }

  if (httpStatus === 400) {
    // 只有拿到明确的 unsupported_model 才敢下「鉴权通过」的结论。
    // 其余 400 无法区分是鉴权问题还是请求问题，宁可不下结论，也不谎报有效 ——
    // 「你的 key 有效」这种断言，误报的代价比含糊更大。
    if (code === 'unsupported_model') {
      return {
        status: 'valid',
        detail: '鉴权通过（探测模型如预期被拒绝，未消耗额度）',
      };
    }
    const hint = [code && `code=${code}`, type && `type=${type}`].filter(Boolean).join(', ');
    return {
      status: 'inconclusive',
      detail: `收到 HTTP 400，无法确认鉴权是否通过${hint ? `（${hint}）` : ''}${suffix}`,
    };
  }

  if (httpStatus === 429) {
    return { status: 'inconclusive', detail: '被限流（HTTP 429），稍后重试' };
  }

  if (httpStatus >= 200 && httpStatus < 300) {
    return {
      status: 'inconclusive',
      detail: '探测请求竟然成功了 —— 说明该模型真实存在，请检查探测用的模型 id',
    };
  }

  if (httpStatus >= 500) {
    return { status: 'inconclusive', detail: `Command Code 服务端错误（HTTP ${httpStatus}）` };
  }

  return { status: 'inconclusive', detail: `未预期的响应（HTTP ${httpStatus}）` };
}

function maskForLog(): string {
  return '(已隐藏)';
}

/** 真正发起探测请求。key 只在请求头里出现，绝不写日志。 */
export async function verifyApiKey(apiKey: string): Promise<ApiKeyCheckResult> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { status: 'invalid', detail: '还没有填写 API key' };
  }

  const endpoint = `${APP_CONFIG.api.baseUrl}/chat/completions`;
  const body = JSON.stringify({
    model: PROBE_MODEL,
    messages: [{ role: 'user', content: 'ping' }],
    max_tokens: 1,
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${trimmed}`,
        'Content-Type': 'application/json',
      },
      body,
    });
  } catch {
    return {
      status: 'unreachable',
      detail: `无法连接 api.commandcode.ai（${maskForLog()}），请检查网络或代理`,
    };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return classifyKeyCheck(response.status, payload);
}
