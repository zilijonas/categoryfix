import process from "node:process";

const appUrl = process.env.SMOKE_APP_URL?.trim();
const publicSiteUrl =
  process.env.SMOKE_PUBLIC_SITE_URL?.trim() || process.env.PUBLIC_SITE_URL?.trim();

if (!appUrl) {
  throw new Error("SMOKE_APP_URL is required.");
}

if (!publicSiteUrl) {
  throw new Error("SMOKE_PUBLIC_SITE_URL or PUBLIC_SITE_URL is required.");
}

async function assertStatus(url, options, expectedStatuses) {
  const response = await fetch(url, options);

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `${url} returned ${response.status}, expected one of ${expectedStatuses.join(", ")}.`,
    );
  }

  return response;
}

async function run() {
  await assertStatus(new URL("/api/v1/health", appUrl), {}, [200]);
  await assertStatus(new URL("/", publicSiteUrl), {}, [200]);
  await assertStatus(new URL("/support", publicSiteUrl), {}, [200]);
  await assertStatus(new URL("/privacy", publicSiteUrl), {}, [200]);
  await assertStatus(new URL("/terms", publicSiteUrl), {}, [200]);
  await assertStatus(new URL("/app", appUrl), { redirect: "manual" }, [200, 302, 303]);
  await assertStatus(
    new URL("/webhooks/customers/redact", appUrl),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
    [401],
  );

  console.info(
    JSON.stringify({
      level: "info",
      event: "categoryfix.smoke.completed",
      appUrl,
      publicSiteUrl,
      timestamp: new Date().toISOString(),
    }),
  );
}

void run();
