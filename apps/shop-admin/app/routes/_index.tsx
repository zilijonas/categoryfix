import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { withRouteErrorReporting } from "../lib/route-observability.server.js";
import { authenticate } from "../shopify.server.js";

export const loader = withRouteErrorReporting("_index", "loader", async ({
  request,
}: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return redirect("/app");
});
