import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { siteConfig } from "../src/content/site.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const distRoot = path.join(appRoot, "dist");

const requiredRoutes = [
  "/",
  "/product",
  "/how-it-works",
  "/docs",
  "/privacy",
  "/terms",
  "/support",
  "/beta",
];

function routeToHtmlFile(route: string): string {
  if (route === "/") {
    return path.join(distRoot, "index.html");
  }

  return path.join(distRoot, route.slice(1), "index.html");
}

function readRouteHtml(route: string): string {
  return readFileSync(routeToHtmlFile(route), "utf8");
}

function extractHrefs(html: string): string[] {
  return Array.from(html.matchAll(/href="([^"]+)"/g), (match) => match[1] ?? "");
}

beforeAll(() => {
  execFileSync("pnpm", ["build"], {
    cwd: appRoot,
    stdio: "pipe",
  });
});

describe("marketing build output", () => {
  it("builds all required public routes", () => {
    for (const route of requiredRoutes) {
      expect(existsSync(routeToHtmlFile(route)), `${route} should exist in dist`).toBe(true);
    }
  });

  it("keeps required trust copy on the homepage", () => {
    const html = readRouteHtml("/");

    expect(html).toContain("Preview every category change before anything is written.");
    expect(html).toContain("Undo and rollback stay available after apply jobs complete");
    expect(html).toContain("AI-assisted suggestions stay optional and advisory.");
    expect(html).not.toContain("fully autonomous");
  });

  it("publishes legal and support navigation links", () => {
    const html = readRouteHtml("/");
    const hrefs = extractHrefs(html);

    expect(hrefs).toContain("/");
    expect(hrefs).toContain("/product");
    expect(hrefs).toContain("/how-it-works");
    expect(hrefs).toContain("/docs");
    expect(hrefs).toContain("/privacy");
    expect(hrefs).toContain("/terms");
    expect(hrefs).toContain("/support");
    expect(hrefs).toContain("/beta");
  });

  it("uses the configured support email across support-facing pages", () => {
    const supportHtml = readRouteHtml("/support");
    const betaHtml = readRouteHtml("/beta");

    expect(supportHtml).toContain(siteConfig.supportEmail);
    expect(betaHtml).toContain(siteConfig.supportEmail);
  });

  it("keeps docs focused on the merchant workflow", () => {
    const html = readRouteHtml("/docs");

    expect(html).toContain("Run a scan");
    expect(html).toContain("Review findings by status");
    expect(html).toContain("Use preview counts before apply");
    expect(html).toContain("Keep rollback in mind");
  });
});
