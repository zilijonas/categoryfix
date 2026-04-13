import { Link, Outlet, useLoaderData, useRouteError } from "react-router";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { withRouteErrorReporting } from "../lib/route-observability.server.js";
import { appConfig, authenticate } from "../shopify.server.js";

export const loader = withRouteErrorReporting("app", "loader", async ({
  request,
}: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return {
    apiKey: appConfig.apiKey,
  };
});

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <div className="admin-shell">
        <header className="admin-topbar">
          <div className="admin-brand-block">
            <Link className="admin-brand" to="/app">
              <span className="admin-brand-mark" aria-hidden="true">
                CF
              </span>
              <span className="admin-brand-copy">
                <strong>CategoryFix</strong>
                <span>Explainable category review inside Shopify</span>
              </span>
            </Link>
            <p className="admin-brand-note">
              Merchant workspace for deterministic review, explicit apply, and rollback.
            </p>
          </div>

          <div className="admin-topbar-actions">
            <nav className="admin-topnav" aria-label="App">
              <Link className="admin-toplink" to="/app">
                Overview
              </Link>
            </nav>

            <button className="admin-button admin-button-ghost admin-theme-toggle" data-theme-toggle type="button">
              <span data-theme-toggle-label>Theme: Dark</span>
            </button>
          </div>
        </header>

        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
