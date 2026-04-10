import "server-only";
import { appendFile, mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";

type LogLevel = "warn" | "error";
type LogContext = Record<string, unknown>;

const LOG_DIRECTORY = path.join(process.cwd(), "logs");
const LOG_FILE_PREFIX = "app-";
const LOG_FILE_SUFFIX = ".log";
const RETENTION_DAYS = 14;

let ensureLogDirectoryPromise: Promise<void> | null = null;
let cleanupDayStamp = "";

function getDayStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getLogFilePath(dayStamp: string): string {
  return path.join(LOG_DIRECTORY, `${LOG_FILE_PREFIX}${dayStamp}${LOG_FILE_SUFFIX}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet<object>(),
): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);

    if (isPlainObject(value)) {
      const normalized: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value)) {
        const normalizedEntry = normalizeValue(entry, seen);
        if (normalizedEntry !== undefined) {
          normalized[key] = normalizedEntry;
        }
      }
      seen.delete(value);
      return normalized;
    }

    seen.delete(value);
    return String(value);
  }

  return value;
}

function normalizeContext(context?: LogContext): Record<string, unknown> | undefined {
  if (!context) {
    return undefined;
  }

  const normalized = normalizeValue(context);
  if (!isPlainObject(normalized)) {
    return undefined;
  }

  if (Object.keys(normalized).length === 0) {
    return undefined;
  }

  return normalized;
}

function parseLogDateFromFilename(filename: string): Date | null {
  if (!filename.startsWith(LOG_FILE_PREFIX) || !filename.endsWith(LOG_FILE_SUFFIX)) {
    return null;
  }

  const datePart = filename.slice(LOG_FILE_PREFIX.length, -LOG_FILE_SUFFIX.length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return null;
  }

  const parsed = new Date(`${datePart}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function getRetentionThreshold(now: Date): number {
  const threshold = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  threshold.setUTCDate(threshold.getUTCDate() - (RETENTION_DAYS - 1));
  return threshold.getTime();
}

async function ensureLogDirectory(): Promise<void> {
  if (!ensureLogDirectoryPromise) {
    ensureLogDirectoryPromise = mkdir(LOG_DIRECTORY, { recursive: true }).then(() => undefined);
  }
  await ensureLogDirectoryPromise;
}

async function cleanupOldLogs(now: Date): Promise<void> {
  const dayStamp = getDayStamp(now);
  if (cleanupDayStamp === dayStamp) {
    return;
  }
  cleanupDayStamp = dayStamp;

  try {
    const threshold = getRetentionThreshold(now);
    const entries = await readdir(LOG_DIRECTORY, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isFile()) {
          return;
        }

        const fileDate = parseLogDateFromFilename(entry.name);
        if (!fileDate) {
          return;
        }

        if (fileDate.getTime() < threshold) {
          await unlink(path.join(LOG_DIRECTORY, entry.name));
        }
      }),
    );
  } catch {
    // Best-effort cleanup. Logging should continue even when cleanup fails.
  }
}

function fallbackToStderr(message: string): void {
  try {
    process.stderr.write(`${message}\n`);
  } catch {
    // Ignore fallback failures.
  }
}

async function writeLog(level: LogLevel, message: string, context?: LogContext): Promise<void> {
  const now = new Date();
  const entry: Record<string, unknown> = {
    timestamp: now.toISOString(),
    level,
    message,
  };
  const normalizedContext = normalizeContext(context);
  if (normalizedContext) {
    entry.context = normalizedContext;
  }

  try {
    await ensureLogDirectory();
    await cleanupOldLogs(now);
    await appendFile(getLogFilePath(getDayStamp(now)), `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    fallbackToStderr(`[server-logger] Failed to write ${level} log: ${errorMessage}`);
  }
}

export function logWarn(message: string, context?: LogContext): void {
  void writeLog("warn", message, context);
}

export function logError(message: string, context?: LogContext): void {
  void writeLog("error", message, context);
}
