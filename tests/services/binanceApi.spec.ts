import { describe, expect, it } from 'vitest';
import { extractPositions, hmacSha256Hex } from '@/services/binanceApi';

/**
 * 签名实现的自证测试。
 *
 * 用公开的标准 HMAC-SHA256 测试向量验证：如果这些向量对得上，
 * 说明签名算法本身没问题，排查 -2015 时就可以把「签名算错」这一项排除。
 */
describe('hmacSha256Hex', () => {
  it('RFC 4231 风格向量：key=key / data=The quick brown fox…', async () => {
    const signature = await hmacSha256Hex(
      'key',
      'The quick brown fox jumps over the lazy dog',
    );
    expect(signature).toBe(
      'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
    );
  });

  it('空数据也有确定的签名（不是空串）', async () => {
    const signature = await hmacSha256Hex('secret', '');
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it('同样的输入产出同样的签名（确定性）', async () => {
    const payload = 'recvWindow=5000&timestamp=1700000000000';
    expect(await hmacSha256Hex('abcdef', payload)).toBe(
      await hmacSha256Hex('abcdef', payload),
    );
  });

  it('改动 payload 任何一位都会改变签名', async () => {
    const a = await hmacSha256Hex('abcdef', 'timestamp=1700000000000');
    const b = await hmacSha256Hex('abcdef', 'timestamp=1700000000001');
    expect(a).not.toBe(b);
  });

  it('输出是小写十六进制、长度 64（币安要求大小写不敏感，小写即可）', async () => {
    const signature = await hmacSha256Hex('secret', 'a=1&b=2');
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('extractPositions', () => {
  it('positionRisk 返回数组', () => {
    expect(extractPositions([{ symbol: 'BTCUSDT' }])).toHaveLength(1);
  });

  it('account 返回 { positions: [...] }', () => {
    expect(extractPositions({ positions: [{ symbol: 'ETHUSDT' }] })).toHaveLength(1);
  });

  it('结构不符时返回空数组', () => {
    expect(extractPositions(undefined)).toEqual([]);
    expect(extractPositions(42)).toEqual([]);
  });
});
