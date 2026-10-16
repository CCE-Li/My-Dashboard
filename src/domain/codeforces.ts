import type {
  CfActivityDay,
  CfProblem,
  CfSubmission,
  CfUser,
  CodeforcesStats,
} from '@/types/codeforces';
import { lastNDayKeys, localDayKey, localMonthKey } from '@/utils/time';

/** 题目唯一键。部分题目（如 acmsguru）没有 contestId，用 problemsetName 兜底。 */
export function problemKey(problem: CfProblem): string {
  const contest = problem.contestId ?? problem.problemsetName ?? 'unknown';
  return `${contest}-${problem.index}`;
}

export interface BuildCodeforcesStatsInput {
  user: CfUser;
  submissions: readonly CfSubmission[];
  /** 活动条展示天数 */
  activityDays: number;
  /** 当前时间（秒级时间戳），用于计算本月/活动窗口 */
  nowSeconds: number;
}

/**
 * 从 CF 提交记录派生展示指标。
 *
 * 注意口径：Codeforces 官方 API 不暴露「全站累计通过题数」，因此
 * `solvedInWindow` 是「最近一次抓取窗口内通过的不同题目数」，
 * UI 上必须如实标注窗口大小，不能当成历史总数。
 */
export function buildCodeforcesStats(input: BuildCodeforcesStatsInput): CodeforcesStats {
  const { user, submissions, activityDays, nowSeconds } = input;
  const now = new Date(nowSeconds * 1000);
  const currentMonth = localMonthKey(now);

  const acceptedProblems = new Set<string>();
  const acceptedProblemsThisMonth = new Set<string>();

  const dayKeys = lastNDayKeys(activityDays, now);
  const activityMap = new Map<string, CfActivityDay>(
    dayKeys.map((day) => [day, { day, submissions: 0, accepted: 0 }]),
  );

  let lastSubmissionAt: number | null = null;

  for (const submission of submissions) {
    const created = new Date(submission.creationTimeSeconds * 1000);
    const isAccepted = submission.verdict === 'OK';
    const key = problemKey(submission.problem);

    if (isAccepted) {
      acceptedProblems.add(key);
      if (localMonthKey(created) === currentMonth) {
        acceptedProblemsThisMonth.add(key);
      }
    }

    const bucket = activityMap.get(localDayKey(created));
    if (bucket) {
      bucket.submissions += 1;
      if (isAccepted) bucket.accepted += 1;
    }

    if (lastSubmissionAt === null || submission.creationTimeSeconds > lastSubmissionAt) {
      lastSubmissionAt = submission.creationTimeSeconds;
    }
  }

  return {
    handle: user.handle,
    rating: typeof user.rating === 'number' ? user.rating : null,
    maxRating: typeof user.maxRating === 'number' ? user.maxRating : null,
    rank: user.rank ?? null,
    maxRank: user.maxRank ?? null,
    solvedInWindow: acceptedProblems.size,
    windowSize: submissions.length,
    submissionsInWindow: submissions.length,
    solvedThisMonth: acceptedProblemsThisMonth.size,
    activity: dayKeys.map((day) => activityMap.get(day) as CfActivityDay),
    lastSubmissionAt,
    fetchedAt: nowSeconds,
  };
}
