#!/usr/bin/env node
/**
 * 采集本机 Command Code 会话用量，生成仪表盘读取的 JSON 快照。
 *
 *   npm run sync:usage
 *   node scripts/sync-commandcode-usage.mjs --root <dir> --out <file>
 *
 * 数据源：`<root>/projects/<project-slug>/<session-uuid>.jsonl`
 * 只取 `type === "message"` 且 `message.role === "assistant"` 且带 `usage` 的行。
 * 必须排除同目录的 `<uuid>.checkpoints.jsonl`（checkpoint 快照不是模型调用）。
 *
 * 口径与 Command Code 自身一致（已在真实会话文件上核对）：
 * - `inputTokens` 是「含缓存命中」的总输入，cacheReadTokens 是它的子集
 * - `cacheWriteTokens` 在历史会话中恒为 0，这里如实透传
 * - `costUsd` 是 Command Code 的权威计价，本地**不重算**（本地价目表与它不一致）
 */

import { createReadStream, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const HOUR_WINDOW = 48;

function parseArgs(argv) {
  const options = {
    root: join(homedir(), '.commandcode'),
    out: join('public', 'data', 'command-code-usage.json'),
    quiet: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root' && argv[index + 1]) {
      options.root = argv[index + 1];
      index += 1;
    } else if (arg === '--out' && argv[index + 1]) {
      options.out = argv[index + 1];
      index += 1;
    } else if (arg === '--quiet') {
      options.quiet = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        [
          '用法: node scripts/sync-commandcode-usage.mjs [options]',
          '',
          '  --root <dir>   Command Code 数据根目录（默认 ~/.commandcode）',
          '  --out <file>   输出文件（默认 public/data/command-code-usage.json）',
          '  --quiet        不打印统计摘要',
        ].join('\n'),
      );
      process.exit(0);
    }
  }

  return options;
}

/** 列出所有会话文件，排除 checkpoints。 */
function listSessionFiles(projectsDir) {
  if (!existsSync(projectsDir)) return [];

  const files = [];
  for (const projectEntry of readdirSync(projectsDir, { withFileTypes: true })) {
    if (!projectEntry.isDirectory()) continue;
    const projectDir = join(projectsDir, projectEntry.name);
    for (const fileEntry of readdirSync(projectDir, { withFileTypes: true })) {
      if (!fileEntry.isFile()) continue;
      if (!fileEntry.name.endsWith('.jsonl')) continue;
      if (fileEntry.name.endsWith('.checkpoints.jsonl')) continue;
      files.push(join(projectDir, fileEntry.name));
    }
  }
  return files;
}

function pad2(value) {
  return value < 10 ? `0${value}` : String(value);
}

function dayKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function hourKey(date) {
  return `${dayKey(date)}T${pad2(date.getHours())}`;
}

function toNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * 写进 JSON 的路径要脱敏：这个文件会随公开仓库发布，
 * 不该把本机用户名（C:\Users\<name>\...）带出去。
 */
function sanitizePath(absolutePath) {
  const home = homedir();
  if (absolutePath === home) return '~';
  if (absolutePath.startsWith(home)) {
    return `~${absolutePath.slice(home.length).split('\\').join('/')}`;
  }
  return absolutePath;
}

function emptyTotals() {
  return {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0,
  };
}

function addInto(target, source) {
  target.requests += source.requests;
  target.inputTokens += source.inputTokens;
  target.outputTokens += source.outputTokens;
  target.cacheReadTokens += source.cacheReadTokens;
  target.cacheWriteTokens += source.cacheWriteTokens;
  target.costUsd += source.costUsd;
}

/** 一行一条 message；坏行与无关行静默跳过。 */
function extractSample(line) {
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }

  if (!parsed || parsed.type !== 'message') return null;
  const message = parsed.message;
  if (!message || message.role !== 'assistant') return null;
  const usage = parsed.usage;
  if (!usage || typeof usage !== 'object') return null;

  const timestamp = typeof parsed.timestamp === 'string' ? Date.parse(parsed.timestamp) : NaN;
  const inputTokens = toNumber(usage.inputTokens);
  const outputTokens = toNumber(usage.outputTokens);
  const cacheReadTokens = toNumber(usage.cacheReadTokens);

  // 完全没有 token 记录的行不计入（例如纯本地报错）
  if (inputTokens === 0 && outputTokens === 0 && cacheReadTokens === 0) return null;

  return {
    model: typeof parsed.model === 'string' && parsed.model ? parsed.model : 'unknown',
    at: Number.isFinite(timestamp) ? new Date(timestamp) : null,
    sample: {
      requests: 1,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens: toNumber(usage.cacheWriteTokens),
      costUsd: toNumber(usage.costUsd),
    },
  };
}

async function scanFile(file, state) {
  const stream = createReadStream(file, { encoding: 'utf8' });
  const reader = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of reader) {
    if (!line) continue;
    const extracted = extractSample(line);
    if (!extracted) continue;

    addInto(state.totals, extracted.sample);

    let modelRow = state.byModel.get(extracted.model);
    if (!modelRow) {
      modelRow = { model: extracted.model, ...emptyTotals() };
      state.byModel.set(extracted.model, modelRow);
    }
    addInto(modelRow, extracted.sample);

    if (extracted.at) {
      const key = dayKey(extracted.at);
      let dayRow = state.byDay.get(key);
      if (!dayRow) {
        dayRow = { day: key, requests: 0, totalTokens: 0, costUsd: 0 };
        state.byDay.set(key, dayRow);
      }
      dayRow.requests += 1;
      dayRow.totalTokens += extracted.sample.inputTokens + extracted.sample.outputTokens;
      dayRow.costUsd += extracted.sample.costUsd;

      const hour = hourKey(extracted.at);
      let hourRow = state.byHour.get(hour);
      if (!hourRow) {
        hourRow = { hour, requests: 0, totalTokens: 0, costUsd: 0 };
        state.byHour.set(hour, hourRow);
      }
      hourRow.requests += 1;
      hourRow.totalTokens += extracted.sample.inputTokens + extracted.sample.outputTokens;
      hourRow.costUsd += extracted.sample.costUsd;
    }
  }
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = resolve(options.root);
  const projectsDir = join(root, 'projects');
  const files = listSessionFiles(projectsDir);

  const state = {
    totals: emptyTotals(),
    byModel: new Map(),
    byDay: new Map(),
    byHour: new Map(),
  };

  for (const file of files) {
    await scanFile(file, state);
  }

  const now = new Date();
  const hourCutoffMs = now.getTime() - HOUR_WINDOW * 3_600_000;

  const byHour = [...state.byHour.values()]
    .filter((row) => {
      const [day, hour] = row.hour.split('T');
      const parsed = new Date(`${day}T${hour}:00:00`);
      return !Number.isNaN(parsed.getTime()) && parsed.getTime() >= hourCutoffMs;
    })
    .sort((a, b) => a.hour.localeCompare(b.hour))
    .map((row) => ({ ...row, costUsd: round(row.costUsd) }));

  const snapshot = {
    generatedAt: now.toISOString(),
    source: sanitizePath(root),
    sessionFiles: files.length,
    totals: {
      requests: state.totals.requests,
      inputTokens: state.totals.inputTokens,
      outputTokens: state.totals.outputTokens,
      cacheReadTokens: state.totals.cacheReadTokens,
      cacheWriteTokens: state.totals.cacheWriteTokens,
      costUsd: round(state.totals.costUsd),
    },
    byModel: [...state.byModel.values()]
      .sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens))
      .map((row) => ({ ...row, costUsd: round(row.costUsd) })),
    byDay: [...state.byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    byHour,
  };

  const outPath = resolve(options.out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  if (!options.quiet) {
    const totalTokens = snapshot.totals.inputTokens + snapshot.totals.outputTokens;
    console.log('Command Code 用量快照已生成');
    console.log(`  扫描目录   ${projectsDir}`);
    console.log(`  会话文件   ${files.length} 个`);
    console.log(`  调用次数   ${snapshot.totals.requests}`);
    console.log(`  总 tokens  ${totalTokens.toLocaleString('en-US')}`);
    console.log(`  估算费用   $${snapshot.totals.costUsd.toFixed(4)}（Command Code 权威计价）`);
    console.log(`  模型数     ${snapshot.byModel.length}`);
    console.log(`  输出       ${outPath}`);
  }
}

main().catch((error) => {
  console.error(`采集失败：${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
