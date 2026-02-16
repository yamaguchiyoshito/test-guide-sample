import { execSync } from 'node:child_process';

const DEFAULT_TIMES = 5;
const DEFAULT_COMMAND = process.env.FLAKY_TEST_COMMAND ?? 'pnpm run test:unit';

function parseTimesArg(raw: string | undefined): number {
  if (!raw) {
    return DEFAULT_TIMES;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_TIMES;
  }

  return parsed;
}

function run(times = DEFAULT_TIMES, command = DEFAULT_COMMAND): void {
  let failures = 0;
  const failedRuns: number[] = [];
  const startedAt = Date.now();

  for (let i = 0; i < times; i += 1) {
    try {
      execSync(command, { stdio: 'ignore' });
    } catch {
      failures += 1;
      failedRuns.push(i + 1);
    }
  }

  const report = {
    command,
    runs: times,
    failures,
    failedRuns,
    failureRate: Number(((failures / times) * 100).toFixed(2)),
    durationMs: Date.now() - startedAt,
  };

  console.log(JSON.stringify(report, null, 2));
}

run(parseTimesArg(process.argv[2]));
