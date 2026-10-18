import { describe, expect, it } from 'vitest';
import { createNoiseTile, createPermutation, simplex2D } from '@/utils/simplexNoise';

describe('createPermutation', () => {
  it('是 0..255 的一个排列（含 512 长度的复制）', () => {
    const perm = createPermutation(42);
    expect(perm).toHaveLength(512);

    const firstHalf = new Set(perm.slice(0, 256));
    expect(firstHalf.size).toBe(256);
    // 后半段必须与前半段一致，否则索引会越界取到别的值
    expect([...perm.slice(256)]).toEqual([...perm.slice(0, 256)]);
  });

  it('同一个种子给出同一个置换表', () => {
    expect([...createPermutation(7)]).toEqual([...createPermutation(7)]);
  });

  it('不同种子给出不同的置换表', () => {
    expect([...createPermutation(7)]).not.toEqual([...createPermutation(8)]);
  });
});

describe('simplex2D', () => {
  const perm = createPermutation(1);

  it('输出落在 [-1, 1] 附近', () => {
    for (let i = 0; i < 200; i += 1) {
      const value = simplex2D(perm, i * 0.37, i * 0.61);
      expect(value).toBeGreaterThanOrEqual(-1.05);
      expect(value).toBeLessThanOrEqual(1.05);
    }
  });

  it('是确定性的：同一坐标永远给同一个值', () => {
    expect(simplex2D(perm, 12.34, -56.78)).toBe(simplex2D(perm, 12.34, -56.78));
  });

  it('连续采样有变化，不是常量场', () => {
    const values = new Set<number>();
    for (let i = 0; i < 50; i += 1) values.add(simplex2D(perm, i * 0.9, i * 1.3));
    expect(values.size).toBeGreaterThan(40);
  });

  it('在整数格点附近也保持连续（相邻采样差不会突变到满量程）', () => {
    const a = simplex2D(perm, 3, 3);
    const b = simplex2D(perm, 3.01, 3.01);
    expect(Math.abs(a - b)).toBeLessThan(0.2);
  });
});

describe('createNoiseTile', () => {
  it('输出尺寸与缓冲区长度正确', () => {
    const tile = createNoiseTile({ size: 32, octaves: 2 });
    expect(tile.size).toBe(32);
    expect(tile.rgba).toHaveLength(32 * 32 * 4);
  });

  it('alpha 通道有明暗颗粒，不是全透明也不是全实心', () => {
    const tile = createNoiseTile({ size: 32, frequency: 0.2, octaves: 2 });
    const alphas: number[] = [];
    for (let index = 3; index < tile.rgba.length; index += 4) {
      alphas.push(tile.rgba[index] as number);
    }
    expect(Math.max(...alphas)).toBeGreaterThan(80);
    expect(Math.min(...alphas)).toBeLessThan(40);
  });

  it('同一参数生成相同纹理；换种子则不同', () => {
    const a = createNoiseTile({ size: 16, seed: 1 });
    const b = createNoiseTile({ size: 16, seed: 1 });
    const c = createNoiseTile({ size: 16, seed: 2 });
    expect([...a.rgba]).toEqual([...b.rgba]);
    expect([...a.rgba]).not.toEqual([...c.rgba]);
  });

  it('非法尺寸会被收敛到合法值', () => {
    expect(createNoiseTile({ size: 1 }).size).toBe(2);
    expect(createNoiseTile({ size: -5 }).size).toBe(2);
  });
});
