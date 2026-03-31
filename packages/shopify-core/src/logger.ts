export function logStructuredEvent(
  event: string,
  metadata: Record<string, unknown> = {},
): void {
  console.info(
    JSON.stringify({
      level: "info",
      event,
      timestamp: new Date().toISOString(),
      ...metadata,
    }),
  );
}
