import { useState } from "react";
import { Form, useActionData, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import {
  AdminPage,
  AdminPanel,
  Field,
  InlineMessage,
  buttonClassName,
} from "../../components/admin-ui.js";
import { withRouteErrorReporting } from "../../lib/route-observability.server.js";
import { login } from "../../shopify.server.js";

interface LoginErrors {
  shop?: string;
}

function normalizeLoginErrors(value: unknown): LoginErrors {
  if (!value || typeof value !== "object") {
    return {};
  }

  const maybeResult = value as {
    shop?: unknown;
    errors?: {
      shop?: unknown;
    };
  };

  if (typeof maybeResult.shop === "string") {
    return { shop: maybeResult.shop };
  }

  if (typeof maybeResult.errors?.shop === "string") {
    return { shop: maybeResult.errors.shop };
  }

  return {};
}

async function resolveLoginResult(request: Request) {
  const result = await login(request);

  if (result instanceof Response) {
    return result;
  }

  return {
    errors: normalizeLoginErrors(result),
  };
}

export const loader = withRouteErrorReporting(
  "auth.login",
  "loader",
  async ({ request }: LoaderFunctionArgs) => {
    return resolveLoginResult(request);
  },
);

export const action = withRouteErrorReporting(
  "auth.login",
  "action",
  async ({ request }: ActionFunctionArgs) => {
    return resolveLoginResult(request);
  },
);

export default function LoginRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const errors = actionData?.errors ?? loaderData.errors;

  return (
    <AppProvider embedded={false}>
      <div className="admin-shell">
        <Form method="post">
          <AdminPage
            eyebrow="Install the embedded app"
            title="CategoryFix"
            description="Enter the dev store domain to start Shopify-managed installation."
            actions={
              <button
                className={`${buttonClassName("ghost")} admin-theme-toggle`}
                data-theme-toggle
                type="button"
              >
                <span data-theme-toggle-label>Theme: Dark</span>
              </button>
            }
          >
            <AdminPanel
              title="Install the embedded app"
              subtitle="Keep the entry flow simple: identify the shop, continue to Shopify, and let the managed install flow do the rest."
              tone="forest"
            >
              <div className="admin-form-grid">
                <Field htmlFor="shop" label="Shop domain">
                  <input
                    autoComplete="on"
                    id="shop"
                    name="shop"
                    onChange={(event) => setShop(event.currentTarget.value)}
                    placeholder="example.myshopify.com"
                    value={shop}
                  />
                </Field>

                {errors.shop ? <InlineMessage tone="danger">{errors.shop}</InlineMessage> : null}

                <div className="admin-inline-actions">
                  <button className={buttonClassName()} type="submit">
                    Continue to Shopify
                  </button>
                </div>
              </div>
            </AdminPanel>
          </AdminPage>
        </Form>
      </div>
    </AppProvider>
  );
}
