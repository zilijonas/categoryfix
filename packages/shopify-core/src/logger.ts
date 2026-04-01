import * as Sentry from "@sentry/node";
import { z } from "zod";

const observabilityEnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().trim().min(1).optional(),
  SENTRY_RELEASE: z.string().trim().min(1).optional(),
});

export interface ObservabilityConfig {
  enabled: boolean;
  dsn: string | null;
  environment: string;
  release: string | null;
}

type LogLevel = "info" | "warn" | "error";

let observabilityConfigCache: ObservabilityConfig | null = null;
let sentryInitialized = false;

function normalizeMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).filter((entry) => entry[1] !== undefined),
  );
}

function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  return {
    errorName: error.name,
    errorMessage: error.message,
  };
}

function writeStructuredLog(
  level: LogLevel,
  event: string,
  metadata: Record<string, unknown> = {},
  error?: unknown,
) {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...normalizeMetadata(metadata),
    ...(serializeError(error) ?? {}),
  };
  const serialized = JSON.stringify(payload);

  switch (level) {
    case "warn":
      console.warn(serialized);
      return;
    case "error":
      console.error(serialized);
      return;
    default:
      console.info(serialized);
  }
}

export function parseObservabilityConfig(
  env: NodeJS.ProcessEnv = process.env,
): ObservabilityConfig {
  const parsed = observabilityEnvSchema.parse(env);
  const dsn = parsed.SENTRY_DSN?.trim() || null;

  return {
    enabled: Boolean(dsn),
    dsn,
    environment:
      parsed.SENTRY_ENVIRONMENT?.trim() ||
      parsed.NODE_ENV?.trim() ||
      "development",
    release: parsed.SENTRY_RELEASE?.trim() || null,
  };
}

export function initializeObservability(
  env: NodeJS.ProcessEnv = process.env,
  options: { serviceName?: string } = {},
) {
  const config = parseObservabilityConfig(env);
  observabilityConfigCache = config;

  if (!config.enabled || !config.dsn || sentryInitialized) {
    return config;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    ...(config.release ? { release: config.release } : {}),
    ...(options.serviceName ? { serverName: options.serviceName } : {}),
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  sentryInitialized = true;

  return config;
}

export function captureException(
  error: unknown,
  metadata: Record<string, unknown> = {},
) {
  const config = observabilityConfigCache ?? initializeObservability();

  if (!config.enabled) {
    return;
  }

  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(normalizeMetadata(metadata))) {
      scope.setExtra(key, value);
    }

    Sentry.captureException(error);
  });
}

export function logStructuredEvent(
  event: string,
  metadata: Record<string, unknown> = {},
): void {
  writeStructuredLog("info", event, metadata);
}

export function logStructuredWarning(
  event: string,
  metadata: Record<string, unknown> = {},
) {
  writeStructuredLog("warn", event, metadata);
}

export function logStructuredError(
  event: string,
  metadata: Record<string, unknown> = {},
  error?: unknown,
) {
  writeStructuredLog("error", event, metadata, error);

  if (error !== undefined) {
    captureException(error, {
      event,
      ...metadata,
    });
  }
}

export function createLogger(defaultMetadata: Record<string, unknown> = {}) {
  return {
    info(event: string, metadata: Record<string, unknown> = {}) {
      logStructuredEvent(event, {
        ...defaultMetadata,
        ...metadata,
      });
    },
    warn(event: string, metadata: Record<string, unknown> = {}) {
      logStructuredWarning(event, {
        ...defaultMetadata,
        ...metadata,
      });
    },
    error(
      event: string,
      error?: unknown,
      metadata: Record<string, unknown> = {},
    ) {
      logStructuredError(
        event,
        {
          ...defaultMetadata,
          ...metadata,
        },
        error,
      );
    },
  };
}
