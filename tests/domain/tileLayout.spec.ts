import { describe, expect, it } from 'vitest';
import {
  computeFlipInverts,
  computePreviewShifts,
  findNearestTile,
  resolveDropTarget,
  type Point,
  type Rect,
} from '@/domain/tileLayout';

const COLUMNS = 3;
const CELL_WIDTH = 100;
const ROW_HEIGHT = 200;

/** 模拟一个 3 列网格：把磁贴下标映射成坐标 */
function positionForIndex(index: number): Point {
  return { x: (index % COLUMNS) * CELL_WIDTH, y: Math.floor(index / COLUMNS) * ROW_HEIGHT };
}

function gridRects(ids: readonly string[]): Map<string, Point> {
  const rects = new Map<string, Point>();
  ids.forEach((id, index) => rects.set(id, positionForIndex(index)));
  return rects;
}

/**
 * 复刻 useLayoutStore.moveTile 的落点语义。
 * 预览位移必须与这套语义完全一致，否则拖动时"让位"和最终落位会对不上。
 */
function applyMove(order: readonly string[], dragged: string, target: string): string[] {
  const next = [...order];
  const from = next.indexOf(dragged);
  const to = next.indexOf(target);
  if (from === -1 || to === -1 || from === to) return next;

  next.splice(from, 1);
  const insertAt = from < to ? next.indexOf(target) + 1 : next.indexOf(target);
  next.splice(insertAt, 0, dragged);
  return next;
}

const ORDER = ['search', 'brz', 'usage', 'cf', 'models'] as const;
const rects = gridRects(ORDER);

describe('computePreviewShifts', () => {
  it('向后拖：受影响的磁贴挪到各自的新格位', () => {
    // brz(1) 拖到 cf(3) → 最终顺序 search, usage, cf, brz, models
    const shifts = computePreviewShifts(ORDER, rects, 'brz', 'cf');

    // 被拖磁贴自己也要挪到落点（cf 原来的位置）：从 (100,0) 到 (0,200)
    // 否则邻居滑过来补位时会和原地不动的它重叠
    expect(shifts.get('brz')).toEqual({ x: -100, y: 200 });
    // usage 从 (200,0) 挪到 brz 原来那格 (100,0)
    expect(shifts.get('usage')).toEqual({ x: -100, y: 0 });
    // cf 从 (0,200) 挪到 usage 那格 (200,0)：跨行，横竖都要动
    expect(shifts.get('cf')).toEqual({ x: 200, y: -200 });
    // 目标之后的磁贴不受影响
    expect(shifts.has('models')).toBe(false);
  });

  it('向前拖：受影响的磁贴整体后退一格', () => {
    // models(4) 拖到 usage(2) → 最终顺序 search, brz, models, usage, cf
    const shifts = computePreviewShifts(ORDER, rects, 'models', 'usage');

    // 被拖磁贴挪到 usage 原来的位置 (200,0)
    expect(shifts.get('models')).toEqual({ x: 100, y: -200 });
    // usage 从 (200,0) 挪到 cf 那格 (0,200)
    expect(shifts.get('usage')).toEqual({ x: -200, y: 200 });
    // cf 从 (0,200) 挪到 models 那格 (100,200)
    expect(shifts.get('cf')).toEqual({ x: 100, y: 0 });
    expect(shifts.has('brz')).toBe(false);
    expect(shifts.has('search')).toBe(false);
  });

  it('拖到自己身上不产生位移', () => {
    expect(computePreviewShifts(ORDER, rects, 'brz', 'brz').size).toBe(0);
  });

  it('未知 id 不产生位移', () => {
    expect(computePreviewShifts(ORDER, rects, 'ghost', 'brz').size).toBe(0);
    expect(computePreviewShifts(ORDER, rects, 'brz', 'ghost').size).toBe(0);
  });

  it('缺少位置快照的磁贴被跳过，而不是算出 NaN', () => {
    const partial = new Map<string, Point>([['usage', { x: 200, y: 0 }]]);
    expect(computePreviewShifts(ORDER, partial, 'brz', 'cf').size).toBe(0);
  });

  it('位移小到看不出来时不写入（避免无意义的 transform）', () => {
    const overlapping = new Map<string, Point>([
      ['brz', { x: 0, y: 0 }],
      ['usage', { x: 100, y: 0 }],
      ['cf', { x: 100.4, y: 0 }],
    ]);
    const shifts = computePreviewShifts(['brz', 'usage', 'cf'], overlapping, 'brz', 'cf');

    // usage 要挪到 brz 的位置，位移明显 → 保留
    expect(shifts.get('usage')).toEqual({ x: -100, y: 0 });
    // 被拖磁贴挪到 cf 的位置，位移同样明显 → 保留
    expect(shifts.get('brz')).toEqual({ x: 100.4, y: 0 });
    // cf 只需挪到 usage 的位置，两者几乎重合 → 视为无需移动
    expect(shifts.has('cf')).toBe(false);
  });

  it('对任意拖拽组合，预览位移都恰好等于落到最终格位所需的位移', () => {
    // 这是本模块最关键的约束：让位动画与数据层落点必须是同一套数学。
    for (const dragged of ORDER) {
      for (const target of ORDER) {
        if (dragged === target) continue;

        const shifts = computePreviewShifts(ORDER, rects, dragged, target);
        const finalOrder = applyMove(ORDER, dragged, target);

        for (const [id, offset] of shifts) {
          const start = rects.get(id);
          expect(start, `${id} 缺少起点`).toBeDefined();
          const finalIndex = finalOrder.indexOf(id);
          expect(finalIndex, `${id} 不在最终顺序里`).toBeGreaterThanOrEqual(0);

          const landed = { x: (start?.x ?? 0) + offset.x, y: (start?.y ?? 0) + offset.y };
          expect(landed, `${dragged}→${target} 时 ${id} 的落点`).toEqual(
            positionForIndex(finalIndex),
          );
        }

        // 空位必须开在 target 原来的位置，也就是被拖磁贴的落点
        const draggedLanding = positionForIndex(finalOrder.indexOf(dragged));
        expect(draggedLanding).toEqual(rects.get(target));
      }
    }
  });
});

describe('computeFlipInverts', () => {
  it('反向位移 = 变化前 − 变化后', () => {
    const first = new Map<string, Point>([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 100, y: 0 }],
    ]);
    const last = new Map<string, Point>([
      ['a', { x: 100, y: 0 }],
      ['b', { x: 0, y: 0 }],
    ]);

    const inverts = computeFlipInverts(['a', 'b'], first, last);
    expect(inverts.get('a')).toEqual({ x: -100, y: 0 });
    expect(inverts.get('b')).toEqual({ x: 100, y: 0 });
  });

  it('位置没变的磁贴不产生反向位移', () => {
    const first = new Map<string, Point>([['a', { x: 0, y: 0 }]]);
    const last = new Map<string, Point>([['a', { x: 0, y: 0 }]]);
    expect(computeFlipInverts(['a'], first, last).size).toBe(0);
  });

  it('缺少任一侧测量时跳过', () => {
    const first = new Map<string, Point>([['a', { x: 0, y: 0 }]]);
    expect(computeFlipInverts(['a', 'b'], first, new Map()).size).toBe(0);
  });
});

/**
 * 真实布局的近似模型：
 * 第 1 行 search 占满整行；第 2 行 brz / usage / codeforces 各占一列；
 * 第 3 行 models 只占前两列 —— 第三列是网格里永远存在的空格。
 * 列宽 400、间距 20、行高依次 180 / 320 / 280。
 */
const REAL_RECTS = new Map<string, Rect>([
  ['search', { x: 0, y: 0, width: 1240, height: 180 }],
  ['brz', { x: 0, y: 200, width: 400, height: 320 }],
  ['usage', { x: 420, y: 200, width: 400, height: 320 }],
  ['codeforces', { x: 840, y: 200, width: 400, height: 320 }],
  ['models', { x: 0, y: 540, width: 820, height: 280 }],
]);

const MARGIN = 14;

describe('resolveDropTarget', () => {
  it('指针落在磁贴内部时命中该磁贴', () => {
    expect(resolveDropTarget(REAL_RECTS, { x: 620, y: 360 }, MARGIN)).toBe('usage');
    expect(resolveDropTarget(REAL_RECTS, { x: 1040, y: 360 }, MARGIN)).toBe('codeforces');
  });

  it('磁贴之间的缝隙归给更近的一侧（不再是不响应）', () => {
    // brz 右边界 400、usage 左边界 420，中间 20px 缝隙
    expect(resolveDropTarget(REAL_RECTS, { x: 408, y: 360 }, MARGIN)).toBe('brz');
    expect(resolveDropTarget(REAL_RECTS, { x: 412, y: 360 }, MARGIN)).toBe('usage');
  });

  it('超出外扩量则判定为无落点', () => {
    expect(resolveDropTarget(REAL_RECTS, { x: 2000, y: 360 }, MARGIN)).toBeNull();
  });

  it('最后一行的空格是命中测试的死区（需要调用方兜底）', () => {
    expect(resolveDropTarget(REAL_RECTS, { x: 1000, y: 680 }, MARGIN)).toBeNull();
  });
});

describe('findNearestTile', () => {
  it('先在纵向重叠的那一行里找：最后一行的空格落给 models，而不是上一行的 codeforces', () => {
    expect(findNearestTile(REAL_RECTS, { x: 1000, y: 680 })).toBe('models');
    expect(findNearestTile(REAL_RECTS, { x: 1100, y: 700 })).toBe('models');
  });

  it('同一行有多块时取横向更近的那块', () => {
    expect(findNearestTile(REAL_RECTS, { x: 700, y: 360 })).toBe('usage');
    expect(findNearestTile(REAL_RECTS, { x: 1000, y: 360 })).toBe('codeforces');
  });

  it('落在行间缝隙（不与任何行重叠）时退回全局最近', () => {
    // y=530 在 row2（结束 520）与 row3（开始 540）之间
    expect(findNearestTile(REAL_RECTS, { x: 600, y: 530 })).toBe('usage');
  });

  it('网格下方远处也能给出结果（由调用方用网格边界拦截）', () => {
    expect(findNearestTile(REAL_RECTS, { x: 600, y: 1400 })).toBe('models');
  });

  it('没有任何磁贴时返回 null', () => {
    expect(findNearestTile(new Map(), { x: 0, y: 0 })).toBeNull();
  });
});
