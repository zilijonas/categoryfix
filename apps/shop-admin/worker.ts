import { prisma } from "./app/db.server.js";
import { runBackgroundWorkerLoop } from "./app/lib/background-worker.server.js";

const workerId = `categoryfix-worker-${process.pid}`;

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

void runBackgroundWorkerLoop({
  database: prisma,
  workerId,
});
