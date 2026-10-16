import { describe, expect, it } from 'vitest';
import { buildCodeforcesStats, problemKey } from '@/domain/codeforces';
import type { CfSubmission, CfUser } from '@/types/codeforces';

function at(year: number, month: number, day: number, hour = 12): number {
  return Math.floor(new Date(year, month - 1, day, hour).getTime() / 1000);
}

let submissionId = 0;

function submission(partial: {
  verdict: string;
  contestId?: number;
  index: string;
  seconds: number;
}): CfSubmission {
  submissionId += 1;
  return {
    id: submissionId,
    creationTimeSeconds: partial.seconds,
    verdict: partial.verdict,
    problem:
      partial.contestId === undefined
        ? { index: partial.index, name: 'x' }
        : { contestId: partial.contestId, index: partial.index, name: 'x' },
  };
}

const touristFan: CfUser = {
  handle: 'Tourist_Fan',
  rating: 1895,
  maxRating: 1932,
  rank: 'expert',
  maxRank: 'candidate master',
};

describe('problemKey', () => {
  it('用 contestId + index 标识题目', () => {
    expect(problemKey({ contestId: 1895, index: 'A', name: 'x' })).toBe('1895-A');
  });

  it('没有 contestId 时回退到 problemsetName', () => {
    expect(problemKey({ problemsetName: 'acmsguru', index: '100', name: 'x' })).toBe(
      'acmsguru-100',
    );
  });
});

describe('buildCodeforcesStats', () => {
  const nowSeconds = at(2026, 3, 15);

  it('未 rating 的用户返回 null 而不是 0', () => {
    const stats = buildCodeforcesStats({
      user: { handle: 'newbie' },
      submissions: [],
      activityDays: 5,
      nowSeconds,
    });
    expect(stats.rating).toBeNull();
    expect(stats.maxRating).toBeNull();
    expect(stats.rank).toBeNull();
  });

  it('同一题多次通过只算一题', () => {
    const stats = buildCodeforcesStats({
      user: touristFan,
      submissions: [
        submission({ verdict: 'OK', contestId: 100, index: 'A', seconds: at(2026, 3, 10) }),
        submission({ verdict: 'OK', contestId: 100, index: 'A', seconds: at(2026, 3, 11) }),
        submission({ verdict: 'WRONG_ANSWER', contestId: 100, index: 'B', seconds: at(2026, 3, 11) }),
        submission({ verdict: 'OK', contestId: 100, index: 'B', seconds: at(2026, 3, 12) }),
      ],
      activityDays: 5,
      nowSeconds,
    });
    expect(stats.solvedInWindow).toBe(2);
    expect(stats.windowSize).toBe(4);
  });

  it('本月统计只计入当前自然月的通过题目', () => {
    const stats = buildCodeforcesStats({
      user: touristFan,
      submissions: [
        submission({ verdict: 'OK', contestId: 1, index: 'A', seconds: at(2026, 3, 2) }),
        submission({ verdict: 'OK', contestId: 2, index: 'A', seconds: at(2026, 2, 28) }),
      ],
      activityDays: 30,
      nowSeconds,
    });
    expect(stats.solvedThisMonth).toBe(1);
    expect(stats.solvedInWindow).toBe(2);
  });

  it('活动条按本地日历日分桶，长度为请求天数且含零值日', () => {
    const stats = buildCodeforcesStats({
      user: touristFan,
      submissions: [
        submission({ verdict: 'OK', contestId: 1, index: 'A', seconds: at(2026, 3, 15, 9) }),
        submission({ verdict: 'FAILED', contestId: 1, index: 'B', seconds: at(2026, 3, 15, 10) }),
        submission({ verdict: 'OK', contestId: 2, index: 'A', seconds: at(2026, 3, 13, 10) }),
      ],
      activityDays: 4,
      nowSeconds,
    });
    expect(stats.activity).toHaveLength(4);
    expect(stats.activity.map((day) => day.day)).toEqual([
      '2026-03-12',
      '2026-03-13',
      '2026-03-14',
      '2026-03-15',
    ]);
    expect(stats.activity[1]).toMatchObject({ submissions: 1, accepted: 1 });
    expect(stats.activity[2]).toMatchObject({ submissions: 0, accepted: 0 });
    expect(stats.activity[3]).toMatchObject({ submissions: 2, accepted: 1 });
  });

  it('窗口外的提交不计入活动条，但仍算进通过统计', () => {
    const stats = buildCodeforcesStats({
      user: touristFan,
      submissions: [
        submission({ verdict: 'OK', contestId: 9, index: 'Z', seconds: at(2026, 1, 1) }),
      ],
      activityDays: 3,
      nowSeconds,
    });
    expect(stats.activity.every((day) => day.submissions === 0)).toBe(true);
    expect(stats.solvedInWindow).toBe(1);
    expect(stats.lastSubmissionAt).toBe(at(2026, 1, 1));
  });

  it('无提交时 lastSubmissionAt 为 null', () => {
    const stats = buildCodeforcesStats({
      user: touristFan,
      submissions: [],
      activityDays: 3,
      nowSeconds,
    });
    expect(stats.lastSubmissionAt).toBeNull();
  });
});
