import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const requiredPaths = [
  ".codex/rules/00-product-truth.md",
  ".codex/rules/10-monorepo-architecture.md",
  ".codex/rules/20-backend-data-api.md",
  ".codex/rules/30-shopify-implementation.md",
  ".codex/rules/40-ui-trust.md",
  ".codex/rules/50-ai-boundaries.md",
  ".codex/rules/60-testing-done.md",
  ".codex/rules/70-security-ops.md",
  ".codex/roles/shopify-embedded-app.md",
  ".codex/roles/deterministic-engine.md",
  ".codex/roles/release-hardening.md",
  "apps/shop-admin/README.md",
  "apps/marketing/README.md",
  "packages/db/README.md",
  "packages/domain/README.md",
  "packages/shopify-core/README.md",
  "packages/taxonomy-data/README.md",
  "docs/architecture/README.md",
  "docs/product/v1-scope.md",
  "docs/product/trust-model.md",
  "docs/standards/definition-of-done.md",
  "docs/standards/testing-matrix.md",
  "docs/standards/release-readiness.md",
  "docs/runbooks/deploy.md",
  "docs/runbooks/rollback.md",
  "docs/runbooks/webhook-failures.md",
  "docs/runbooks/incident-response.md",
  "ROADMAP.md"
];

const missing = [];

for (const relPath of requiredPaths) {
  try {
    await access(path.join(root, relPath), constants.F_OK);
  } catch {
    missing.push(relPath);
  }
}

if (missing.length > 0) {
  console.error("CategoryFix foundation verification failed.");
  console.error("Missing required files:");

  for (const relPath of missing) {
    console.error(`- ${relPath}`);
  }

  process.exit(1);
}

console.log("CategoryFix foundation verification passed.");
