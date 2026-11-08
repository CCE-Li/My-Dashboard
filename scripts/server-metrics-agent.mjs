#!/usr/bin/env node
/**
 * 服务器只读指标端点（零依赖）。
 *
 * 采集 CPU / 内存 / 磁盘 / 负载 / 运行时长，以 JSON 暴露给仪表盘的
 * SERVER_STATUS 磁贴。只读、不做任何写操作、不接收任何输入参数以外的指令。
 *
 * 用法：
 *   node scripts/server-metrics-agent.mjs [--port 8787] [--host 0.0.0.0]
 *
 * 返回结构（与 src/types/server.ts 的 RawServerMetrics 对应）：
 *   { hostname, platform, uptimeSec, loadAvg: [1m,5m,15m],
 *     cpu: { usagePercent, cores },
 *     memory: { totalBytes, usedBytes },
 *     disks: [{ mount, totalBytes, usedBytes }],
 *     generatedAt }
 *
 * ⚠️ 安全边界：
 * - 这是只读端点，但也别裸奔在公网：至少用防火墙限制来源 IP，
 *   或者放在反向代理后面加鉴权/仅本机访问。
 * - 从这里拿不到 shell，也不会执行任何请求里带的内容。
 *
 * ⚠️ 混合内容：仪表盘若部署在 https（如 GitHub Pages），浏览器会拒绝请求
 * 本端点的 http 地址。线上使用需给端点套一层 https 反代，或把仪表盘部署在本地。
 */

import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : fallback;
}

const PORT = Number(arg('port', '8787'));
const HOST = arg('host', '0.0.0.0');
const PATH = '/metrics';

/** 读 /proc/stat 的累计 CPU 时间（Linux）。非 Linux 返回 null。 */
async function readCpuTimes() {
  try {
    const text = await readFile('/proc/stat', 'utf8');
    const line = text.split('\n').find((entry) => entry.startsWith('cpu '));
    if (!line) return null;
    const parts = line.trim().split(/\s+/).slice(1).map(Number);
    if (parts.length < 4 || parts.some((value) => !Number.isFinite(value))) return null;
    const idle = parts[3] + (parts[4] ?? 0); // idle + iowait
    const total = parts.reduce((sum, value) => sum + value, 0);
    return { idle, total };
  } catch {
    return null;
  }
}

/** 两次采样 /proc/stat 求区间 CPU 使用率。 */
async function sampleCpu() {
  const cores = os.cpus().length;
  const first = await readCpuTimes();
  if (!first) return { usagePercent: 0, cores };
  await new Promise((resolve) => setTimeout(resolve, 200));
  const second = await readCpuTimes();
  if (!second) return { usagePercent: 0, cores };

  const totalDelta = second.total - first.total;
  const idleDelta = second.idle - first.idle;
  const usage = totalDelta > 0 ? (1 - idleDelta / totalDelta) * 100 : 0;
  return { usagePercent: Math.round(usage * 10) / 10, cores };
}

/** 用 df -kP 读磁盘；跳过 tmpfs 等伪设备。非 POSIX 环境返回空数组。 */
async function readDisks() {
  try {
    const { stdout } = await execFileAsync('df', ['-kP']);
    const lines = stdout.trim().split('\n').slice(1);
    const disks = [];
    for (const line of lines) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 6) continue;
      const [device, totalKb, usedKb, , , mount] = cols;
      if (/^(tmpfs|devtmpfs|overlay|squashfs|shm|none)$/.test(device)) continue;
      const totalBytes = Number(totalKb) * 1024;
      const usedBytes = Number(usedKb) * 1024;
      if (!Number.isFinite(totalBytes) || !Number.isFinite(usedBytes)) continue;
      disks.push({ mount, totalBytes, usedBytes });
    }
    return disks;
  } catch {
    return [];
  }
}

async function collect() {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    uptimeSec: Math.floor(os.uptime()),
    loadAvg: os.loadavg(),
    cpu: await sampleCpu(),
    memory: { totalBytes: total, usedBytes: total - free },
    disks: await readDisks(),
    generatedAt: new Date().toISOString(),
  };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept',
  'Cache-Control': 'no-store',
};

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (req.method !== 'GET' || url.pathname !== PATH) {
    res.writeHead(404, { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  try {
    const payload = await collect();
    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
  } catch (error) {
    res.writeHead(500, { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: String(error) }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`server-metrics-agent → http://${HOST}:${PORT}${PATH}`);
});
