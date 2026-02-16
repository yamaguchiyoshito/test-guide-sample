import { sanitizeLogContext } from '@/lib/securityUtils';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Runtime = 'server' | 'client';

interface LogContext {
  [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_EVENT_NAME = 'app.log';

function isServerRuntime(): boolean {
  return typeof window === 'undefined';
}

function getRuntime(): Runtime {
  return isServerRuntime() ? 'server' : 'client';
}

function toLogLevel(value: string | undefined): LogLevel | null {
  if (!value) {
    return null;
  }

  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') {
    return value;
  }

  return null;
}

function getDefaultLogLevel(): LogLevel {
  if (process.env.NODE_ENV === 'development') {
    return 'debug';
  }
  if (process.env.NODE_ENV === 'test') {
    return 'warn';
  }
  return 'info';
}

function resolveConfiguredLogLevel(): LogLevel {
  const rawLevel = isServerRuntime() ? process.env.LOG_LEVEL : process.env.NEXT_PUBLIC_LOG_LEVEL;
  const normalized = toLogLevel(rawLevel?.toLowerCase());
  return normalized ?? getDefaultLogLevel();
}

function shouldEmit(level: LogLevel): boolean {
  const configuredLevel = resolveConfiguredLogLevel();
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLevel];
}

function extractEventName(context: LogContext): string {
  const event = context.event;
  if (typeof event !== 'string') {
    return DEFAULT_EVENT_NAME;
  }

  const normalized = event.trim();
  return normalized.length > 0 ? normalized : DEFAULT_EVENT_NAME;
}

function emit(level: LogLevel, message: string, context: LogContext): void {
  if (!shouldEmit(level)) {
    return;
  }

  const safeContext = sanitizeLogContext(context);
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    if (level === 'debug') {
      console.debug(`[api] ${message}`, safeContext);
      return;
    }
    if (level === 'info') {
      console.info(`[api] ${message}`, safeContext);
      return;
    }
    if (level === 'warn') {
      console.warn(`[api] ${message}`, safeContext);
      return;
    }
    console.error(`[api] ${message}`, safeContext);
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    event: extractEventName(safeContext),
    runtime: getRuntime(),
    context: safeContext,
  };
  const serialized = JSON.stringify(payload);

  if (level === 'debug') {
    console.debug(serialized);
    return;
  }
  if (level === 'info') {
    console.info(serialized);
    return;
  }
  if (level === 'warn') {
    console.warn(serialized);
    return;
  }
  console.error(serialized);
}

export const logger = {
  debug(message: string, context: LogContext = {}): void {
    emit('debug', message, context);
  },
  info(message: string, context: LogContext = {}): void {
    emit('info', message, context);
  },
  warn(message: string, context: LogContext = {}): void {
    emit('warn', message, context);
  },
  error(message: string, context: LogContext = {}): void {
    emit('error', message, context);
  },
};
