/**
 * 2D Simplex 噪声与纹理生成。
 *
 * 纯函数、无 DOM 依赖，便于单测；canvas 绘制放在 NoiseBackdrop 组件里。
 * 算法是经典的 2D simplex（Gustavson 构造），用 xorshift32 生成可复现的置换表。
 */

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

const GRAD2: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** 可复现的 32 位伪随机数（xorshift32），返回值落在 [0, 1)。 */
function createRandom(seed: number): () => number {
  let state = (seed | 0) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state |= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state |= 0;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

/** 用种子洗牌出 512 长度的置换表（前 256 与后 256 相同，避免越界取模）。 */
export function createPermutation(seed: number): Uint8Array {
  const base = new Uint8Array(256);
  for (let index = 0; index < 256; index += 1) base[index] = index;

  const random = createRandom(seed);
  for (let index = 255; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    const value = base[index] as number;
    base[index] = base[swapWith] as number;
    base[swapWith] = value;
  }

  const perm = new Uint8Array(512);
  perm.set(base, 0);
  perm.set(base, 256);
  return perm;
}

/**
 * 单点 2D simplex 噪声，返回值约在 [-1, 1]。
 * 置换表由调用方传入，避免每次采样都重建。
 */
export function simplex2D(perm: Uint8Array, xin: number, yin: number): number {
  const skew = (xin + yin) * F2;
  const i = Math.floor(xin + skew);
  const j = Math.floor(yin + skew);

  const unskew = (i + j) * G2;
  const x0 = xin - (i - unskew);
  const y0 = yin - (j - unskew);

  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;

  const ii = i & 255;
  const jj = j & 255;

  let n0 = 0;
  let n1 = 0;
  let n2 = 0;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) {
    const gradient = GRAD2[(perm[ii + (perm[jj] as number)] as number) & 7] as readonly [
      number,
      number,
    ];
    t0 *= t0;
    n0 = t0 * t0 * (gradient[0] * x0 + gradient[1] * y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) {
    const gradient = GRAD2[
      (perm[ii + i1 + (perm[jj + j1] as number)] as number) & 7
    ] as readonly [number, number];
    t1 *= t1;
    n1 = t1 * t1 * (gradient[0] * x1 + gradient[1] * y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) {
    const gradient = GRAD2[
      (perm[ii + 1 + (perm[jj + 1] as number)] as number) & 7
    ] as readonly [number, number];
    t2 *= t2;
    n2 = t2 * t2 * (gradient[0] * x2 + gradient[1] * y2);
  }

  return 70 * (n0 + n1 + n2);
}

export interface NoiseTileOptions {
  /** 纹理边长（像素），默认 512 */
  size?: number;
  /** 基础频率：越大颗粒越细，默认 0.08 */
  frequency?: number;
  /** 叠加的八度数量，默认 2 */
  octaves?: number;
  /** 随机种子，默认 20261016 */
  seed?: number;
}

export interface NoiseTile {
  size: number;
  /** RGBA 像素，长度 = size * size * 4 */
  rgba: Uint8ClampedArray;
}

/**
 * 生成一张可直接塞进 canvas 的噪点纹理。
 *
 * 像素语义：正值画亮颗粒、负值画暗颗粒，alpha 取噪声强度 ——
 * 这样在深色底上叠出来的就是"明暗交错"的胶片颗粒，而不是单色蒙版。
 *
 * 注意：亮颗粒用中性灰而不是纯白，暗颗粒也不用纯黑 —— 否则叠起来是
 * 黑白雪花屏。真正的颗粒感由组件的低不透明度（约 0.09）压出来。
 */
export function createNoiseTile(options: NoiseTileOptions = {}): NoiseTile {
  const size = Math.max(2, Math.floor(options.size ?? 512));
  const frequency = options.frequency ?? 0.08;
  const octaves = Math.max(1, Math.floor(options.octaves ?? 2));
  const perm = createPermutation(options.seed ?? 20_261_016);

  const rgba = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let amplitude = 1;
      let amplitudeSum = 0;
      let step = frequency;
      let value = 0;

      for (let octave = 0; octave < octaves; octave += 1) {
        value += simplex2D(perm, x * step, y * step) * amplitude;
        amplitudeSum += amplitude;
        amplitude *= 0.5;
        step *= 2;
      }

      value /= amplitudeSum;

      const offset = (y * size + x) * 4;
      const magnitude = Math.min(1, Math.abs(value) * 1.8);
      // 亮颗粒用偏白的冷灰、暗颗粒用近黑，避免纯白/纯黑造成的雪花屏观感
      const tone = value >= 0 ? 205 : 10;

      rgba[offset] = tone;
      rgba[offset + 1] = tone;
      rgba[offset + 2] = tone;
      rgba[offset + 3] = Math.round(magnitude * 255);
    }
  }

  return { size, rgba };
}
