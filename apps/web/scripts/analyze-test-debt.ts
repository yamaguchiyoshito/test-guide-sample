import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'src');
const TEST_FILE_PATTERN = /\.(test|spec)\.tsx?$/;
const SKIP_PATTERN = /\b(?:describe|it|test)\.skip\(/g;
const ONLY_PATTERN = /\b(?:describe|it|test)\.only\(/g;
const TODO_PATTERN = /\b(?:it|test)\.todo\(/g;
const MARKER_PATTERN = /\b(?:TODO|FIXME|HACK)\b/g;

interface DebtFileResult {
  file: string;
  skipCount: number;
  onlyCount: number;
  todoCount: number;
  markerCount: number;
}

interface DebtReport {
  scannedTestFiles: number;
  debtFiles: DebtFileResult[];
  totals: {
    skipCount: number;
    onlyCount: number;
    todoCount: number;
    markerCount: number;
  };
}

function walkFiles(targetDir: string): string[] {
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

function countMatches(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length;
}

if (!fs.existsSync(root)) {
  console.log('src directory not found');
  process.exit(0);
}

const allFiles = walkFiles(root);
const testFiles = allFiles.filter((file) => TEST_FILE_PATTERN.test(file));

const report: DebtReport = {
  scannedTestFiles: testFiles.length,
  debtFiles: [],
  totals: {
    skipCount: 0,
    onlyCount: 0,
    todoCount: 0,
    markerCount: 0,
  },
};

for (const filePath of testFiles) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const skipCount = countMatches(raw, SKIP_PATTERN);
  const onlyCount = countMatches(raw, ONLY_PATTERN);
  const todoCount = countMatches(raw, TODO_PATTERN);
  const markerCount = countMatches(raw, MARKER_PATTERN);

  if (skipCount === 0 && onlyCount === 0 && todoCount === 0 && markerCount === 0) {
    continue;
  }

  const relativePath = path.relative(process.cwd(), filePath);
  report.debtFiles.push({
    file: relativePath,
    skipCount,
    onlyCount,
    todoCount,
    markerCount,
  });
  report.totals.skipCount += skipCount;
  report.totals.onlyCount += onlyCount;
  report.totals.todoCount += todoCount;
  report.totals.markerCount += markerCount;
}

console.log(JSON.stringify(report, null, 2));
