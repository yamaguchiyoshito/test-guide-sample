import fs from 'node:fs';
import path from 'node:path';

interface Metrics {
  timestamp: string;
  coverageLineRate: number;
  unitTestDurationMs: number;
  e2eDurationMs: number;
  unitTestFiles: number;
  e2eSpecFiles: number;
}

function parseDurationFromEnv(name: string): number {
  const raw = process.env[name];
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function walkFiles(targetDir: string): string[] {
  if (!fs.existsSync(targetDir)) {
    return [];
  }

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function countFiles(rootDir: string, pattern: RegExp): number {
  return walkFiles(rootDir).filter((filePath) => pattern.test(filePath)).length;
}

function parseLineCoverageFromLcov(lcovFilePath: string): number {
  if (!fs.existsSync(lcovFilePath)) {
    return 0;
  }

  const raw = fs.readFileSync(lcovFilePath, 'utf8');
  const lines = raw.split('\n');
  let totalFound = 0;
  let totalHit = 0;

  for (const line of lines) {
    if (line.startsWith('LF:')) {
      totalFound += Number(line.slice(3)) || 0;
      continue;
    }
    if (line.startsWith('LH:')) {
      totalHit += Number(line.slice(3)) || 0;
    }
  }

  if (totalFound === 0) {
    return 0;
  }

  return Number(((totalHit / totalFound) * 100).toFixed(2));
}

function collectMetrics(projectRoot = process.cwd()): Metrics {
  const coverageLineRate = parseLineCoverageFromLcov(path.join(projectRoot, 'coverage/lcov.info'));
  const unitTestFiles = countFiles(path.join(projectRoot, 'src'), /\.(test|spec)\.tsx?$/);
  const e2eSpecFiles = countFiles(path.join(projectRoot, 'e2e/tests'), /\.spec\.ts$/);

  return {
    timestamp: new Date().toISOString(),
    coverageLineRate,
    unitTestDurationMs: parseDurationFromEnv('UNIT_TEST_DURATION_MS'),
    e2eDurationMs: parseDurationFromEnv('E2E_TEST_DURATION_MS'),
    unitTestFiles,
    e2eSpecFiles,
  };
}

console.log(JSON.stringify(collectMetrics(), null, 2));
