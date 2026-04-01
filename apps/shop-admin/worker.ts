import { prisma } from "./app/db.server.js";
import { runBackgroundWorkerLoop } from "./app/lib/background-worker.server.js";
import {
  initializeObservability,
  logStructuredError,
  logStructuredEvent,
} from "@categoryfix/shopify-core";

const workerId = `categoryfix-worker-${process.pid}`;
initializeObservability(process.env, {
  serviceName: "categoryfix-worker",
});

async function shutdown(signal: string) {
  logStructuredEvent("categoryfix.worker.shutdown", {
    workerId,
    signal,
  });
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", async () => {
  await shutdown("SIGINT");
});

process.on("SIGTERM", async () => {
  await shutdown("SIGTERM");
});

process.on("unhandledRejection", (error) => {
  logStructuredError(
    "categoryfix.worker.unhandled_rejection",
    {
      workerId,
    },
    error,
  );
});

process.on("uncaughtException", (error) => {
  logStructuredError(
    "categoryfix.worker.uncaught_exception",
    {
      workerId,
    },
    error,
  );
});

void runBackgroundWorkerLoop({
  database: prisma,
  workerId,
});
