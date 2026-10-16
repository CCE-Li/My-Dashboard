import { describe, expect, it } from 'vitest';
import { classifyKeyCheck } from '@/services/commandCodeApi';

/** OpenAI 形状的错误信封 */
function openAiError(code: string, message = 'boom'): unknown {
  return { error: { message, type: 'invalid_request_error', code } };
}

/** Anthropic 形状的错误信封（没有 code 字段，类型在 error.type 上） */
function anthropicError(type: string, message = 'boom'): unknown {
  return { type: 'error', error: { type, message } };
}

describe('classifyKeyCheck', () => {
  it('401 → key 无效', () => {
    const result = classifyKeyCheck(401, openAiError('authentication_error', 'Missing auth'));
    expect(result.status).toBe('invalid');
    expect(result.detail).toContain('401');
  });

  it('403 → key 有效但套餐没有 API 权限', () => {
    const result = classifyKeyCheck(403, openAiError('upgrade_required'));
    expect(result.status).toBe('no-access');
    expect(result.detail).toContain('套餐');
  });

  it('400 + unsupported_model → 鉴权通过（说明已越过鉴权走到模型校验）', () => {
    const result = classifyKeyCheck(400, openAiError('unsupported_model'));
    expect(result.status).toBe('valid');
  });

  it('Anthropic 信封的 400 不足以判定鉴权通过（type 太宽泛）', () => {
    // invalid_request_error 只能说明「请求有问题」，无法区分是不是鉴权导致的，
    // 所以这里必须保持保守：不下结论
    const result = classifyKeyCheck(400, anthropicError('invalid_request_error'));
    expect(result.status).toBe('inconclusive');
  });

  it('400 的 code 会被带进 detail，便于排查', () => {
    const result = classifyKeyCheck(400, openAiError('something_else'));
    expect(result.detail).toContain('something_else');
  });

  it('无法辨认的 400 → 不做结论，而不是谎报有效', () => {
    const result = classifyKeyCheck(400, openAiError('something_else'));
    expect(result.status).toBe('inconclusive');
  });

  it('400 但响应体不是预期结构时也不谎报', () => {
    expect(classifyKeyCheck(400, null).status).toBe('inconclusive');
    expect(classifyKeyCheck(400, 'plain text').status).toBe('inconclusive');
    expect(classifyKeyCheck(400, {}).status).toBe('inconclusive');
  });

  it('429 → 限流，结论待定', () => {
    expect(classifyKeyCheck(429, openAiError('rate_limit_error')).status).toBe('inconclusive');
  });

  it('探测请求真的成功（2xx）说明探测模型存在，需要人工确认', () => {
    const result = classifyKeyCheck(200, { choices: [] });
    expect(result.status).toBe('inconclusive');
    expect(result.detail).toContain('模型');
  });

  it('5xx → 服务端问题，不归因于 key', () => {
    expect(classifyKeyCheck(503, null).status).toBe('inconclusive');
  });

  it('错误信息会被带进 detail，便于排查', () => {
    const result = classifyKeyCheck(401, openAiError('authentication_error', 'Invalid key'));
    expect(result.detail).toContain('Invalid key');
  });
});
