/**
 * 磁贴拖拽 / 重排的几何计算。全部是纯函数，与 DOM 无关，
 * 便于用单测覆盖「让位位移」的数学，而不是靠肉眼看动画。
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  width: number;
  height: number;
}

function delta(from: Point, to: Point): Point {
  return { x: from.x - to.x, y: from.y - to.y };
}

function isNegligible(point: Point): boolean {
  return Math.abs(point.x) < 0.5 && Math.abs(point.y) < 0.5;
}

/**
 * 拖动预览：算出各磁贴应该位移多少像素，从而在落点处腾出一个空位。
 *
 * 语义必须与 useLayoutStore.moveTile 保持一致：
 * - 向后拖（目标在下标更大处）→ 被拖磁贴最终落在目标之后，也就是目标的原下标；
 * - 向前拖（目标在下标更小处）→ 被拖磁贴落在目标的原下标。
 *   两种情况下落点都是「目标的原下标」。
 *
 * 因此：
 * - 被拖磁贴自己也参与位移，平移到落点。必须这样，否则邻居滑过来补位时会
 *   和原地不动的自己重叠（实测会叠成一团）。
 * - 区间内的邻居整体朝被拖磁贴的原位置挪一格，把原位置填上。
 *
 * 位移量取自拖动开始时的位置快照（拖动期间不改 DOM，所以快照全程有效）。
 */
export function computePreviewShifts(
  order: readonly string[],
  rects: ReadonlyMap<string, Point>,
  draggedId: string,
  targetId: string,
): Map<string, Point> {
  const shifts = new Map<string, Point>();
  const sourceIndex = order.indexOf(draggedId);
  const targetIndex = order.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return shifts;

  /** 让某个磁贴移动到另一个磁贴当前所在的位置 */
  const shiftToNeighbour = (id: string, neighbourId: string): void => {
    const own = rects.get(id);
    const neighbour = rects.get(neighbourId);
    if (!own || !neighbour) return;
    const offset = delta(neighbour, own);
    if (isNegligible(offset)) return;
    shifts.set(id, offset);
  };

  // 被拖磁贴自己 → 落点（目标当前所在的位置）
  shiftToNeighbour(draggedId, targetId);

  if (targetIndex > sourceIndex) {
    for (let index = sourceIndex + 1; index <= targetIndex; index += 1) {
      const id = order[index];
      const previous = order[index - 1];
      if (id && previous && id !== draggedId) shiftToNeighbour(id, previous);
    }
  } else {
    for (let index = targetIndex; index <= sourceIndex - 1; index += 1) {
      const id = order[index];
      const next = order[index + 1];
      if (id && next && id !== draggedId) shiftToNeighbour(id, next);
    }
  }

  return shifts;
}

/**
 * FLIP：由「变化前」与「变化后」两次位置测量，算出每个磁贴需要先反向平移多少，
 * 才能在下一帧平滑地滑到新位置。
 */
export function computeFlipInverts(
  ids: readonly string[],
  first: ReadonlyMap<string, Point>,
  last: ReadonlyMap<string, Point>,
): Map<string, Point> {
  const inverts = new Map<string, Point>();
  for (const id of ids) {
    const before = first.get(id);
    const after = last.get(id);
    if (!before || !after) continue;
    const offset = delta(before, after);
    if (isNegligible(offset)) continue;
    inverts.set(id, offset);
  }
  return inverts;
}

/**
 * 指针命中测试：光标现在落在哪个磁贴上。
 *
 * 每个矩形向外扩 `margin`，这样磁贴之间的缝隙会归给最近的邻居 ——
 * 否则光标走在缝隙里时既不触发也不落位，拖动会显得很"迟钝"。
 * 命中多块（缝隙处）时取中心更近的那一块，保证结果稳定、不会来回抖。
 */
export function resolveDropTarget(
  rects: ReadonlyMap<string, Rect>,
  pointer: Point,
  margin: number,
): string | null {
  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [id, rect] of rects) {
    const inside =
      pointer.x >= rect.x - margin &&
      pointer.x <= rect.x + rect.width + margin &&
      pointer.y >= rect.y - margin &&
      pointer.y <= rect.y + rect.height + margin;
    if (!inside) continue;

    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const distance = (pointer.x - centerX) ** 2 + (pointer.y - centerY) ** 2;
    if (distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }

  return best;
}

/**
 * 最近的磁贴（按矩形中心距离，无边界限制）。
 *
 * 用途：网格里存在命中测试覆盖不到的空白（磁贴间的缝隙、以及最后一行空出来的格子，
 * 因为最后一个磁贴只跨 2 列）。拖到那些地方松手时，如果直接放弃，
 * 用户看到的就是「拖了半天没反应」。
 *
 * 选取规则：先在**与指针纵向重叠**的磁贴里找（也就是同一行），这一行为空才退回全局最近。
 * 这样拖到某一行右侧的空白处时会落到同一行的磁贴上 —— 例如拖到最后一行的空格
 * 就是「排到最后」，而不是被上一行的磁贴抢走。
 */
export function findNearestTile(rects: ReadonlyMap<string, Rect>, pointer: Point): string | null {
  const candidates = [...rects.entries()].filter(
    ([, rect]) => pointer.y >= rect.y && pointer.y <= rect.y + rect.height,
  );
  const pool = candidates.length > 0 ? candidates : [...rects.entries()];

  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [id, rect] of pool) {
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const distance = (pointer.x - centerX) ** 2 + (pointer.y - centerY) ** 2;
    if (distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }

  return best;
}
