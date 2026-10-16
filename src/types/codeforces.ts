export type CfVerdict =
  | 'OK'
  | 'FAILED'
  | 'PARTIAL'
  | 'COMPILATION_ERROR'
  | 'RUNTIME_ERROR'
  | 'WRONG_ANSWER'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'IDLENESS_LIMIT_EXCEEDED'
  | 'SECURITY_VIOLATED'
  | 'CRASHED'
  | 'INPUT_PREPARATION_CRASHED'
  | 'CHALLENGED'
  | 'SKIPPED'
  | 'TESTING'
  | 'REJECTED'
  | (string & {});

export interface CfUser {
  handle: string;
  rating?: number;
  maxRating?: number;
  rank?: string;
  maxRank?: string;
  titlePhoto?: string;
  contribution?: number;
  friendOfCount?: number;
  registrationTimeSeconds?: number;
  lastOnlineTimeSeconds?: number;
}

export interface CfProblem {
  contestId?: number;
  problemsetName?: string;
  index: string;
  name: string;
  rating?: number;
  tags?: string[];
}

export interface CfSubmission {
  id: number;
  creationTimeSeconds: number;
  verdict?: CfVerdict;
  problem: CfProblem;
}

export interface CfApiResponse<T> {
  status: 'OK' | 'FAILED';
  comment?: string;
  result?: T;
}

export interface CfActivityDay {
  /** 本地日历日 YYYY-MM-DD */
  day: string;
  submissions: number;
  accepted: number;
}

export interface CodeforcesStats {
  handle: string;
  rating: number | null;
  maxRating: number | null;
  rank: string | null;
  maxRank: string | null;
  /** 最近抓取窗口内通过的「不同题目」数（非全站历史总数） */
  solvedInWindow: number;
  windowSize: number;
  /** 最近抓取窗口内提交总数 */
  submissionsInWindow: number;
  /** 本月新增通过题目数 */
  solvedThisMonth: number;
  /** 近 N 天提交活动（用于微型活动条） */
  activity: CfActivityDay[];
  lastSubmissionAt: number | null;
  fetchedAt: number;
}

export type CfSyncState = 'idle' | 'loading' | 'ready' | 'error';
