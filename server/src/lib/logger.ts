type Level = "info" | "warn" | "error";

function write(level: Level, event: string, details?: Record<string, unknown>): void {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...details,
  };
  const payload = JSON.stringify(line);
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
}

export const logger = {
  info: (event: string, details?: Record<string, unknown>) => write("info", event, details),
  warn: (event: string, details?: Record<string, unknown>) => write("warn", event, details),
  error: (event: string, details?: Record<string, unknown>) => write("error", event, details),
};
