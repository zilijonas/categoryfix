import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getShopSettings, prisma } from "@categoryfix/db";
import { authenticate } from "../shopify.server.js";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const installation = await getShopSettings(session.shop, prisma);

  return {
    healthEndpoint: "/api/v1/health",
    installation,
    settingsEndpoint: "/api/v1/shop/settings",
    shop: session.shop,
  };
};

export default function AppIndexRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <s-page heading="CategoryFix">
      <s-section heading="Embedded shell ready">
        <s-paragraph>
          Phase 1 is live with Shopify-managed install/auth, Prisma session
          storage, and mandatory webhook endpoints.
        </s-paragraph>
      </s-section>

      <s-section heading="Current shop">
        <s-stack direction="block" gap="small">
          <s-text>{data.shop}</s-text>
          <s-text>
            Install state: {data.installation?.state ?? "MISSING_RECORD"}
          </s-text>
          <s-text>
            Scopes:{" "}
            {data.installation?.scopes.length
              ? data.installation.scopes.join(", ")
              : "No scopes recorded yet"}
          </s-text>
          <s-text>
            Installed at: {data.installation?.installedAt ?? "Not recorded yet"}
          </s-text>
        </s-stack>
      </s-section>

      <s-section heading="Phase 1 endpoints">
        <s-stack direction="block" gap="small">
          <s-link href={data.healthEndpoint}>{data.healthEndpoint}</s-link>
          <s-link href={data.settingsEndpoint}>{data.settingsEndpoint}</s-link>
        </s-stack>
      </s-section>
    </s-page>
  );
}
