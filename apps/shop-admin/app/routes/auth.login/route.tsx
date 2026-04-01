import { useState } from "react";
import { Form, useActionData, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
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
  const errorProps = errors.shop ? { error: errors.shop } : {};

  return (
    <AppProvider embedded={false}>
      <s-page heading="CategoryFix">
        <Form method="post">
          <s-section heading="Install the embedded app">
            <s-paragraph>
              Enter the dev store domain to start Shopify-managed installation.
            </s-paragraph>
            <s-stack direction="block" gap="base">
              <s-text-field
                autocomplete="on"
                details="example.myshopify.com"
                {...errorProps}
                label="Shop domain"
                name="shop"
                onChange={(event) => setShop(event.currentTarget.value)}
                value={shop}
              />
              <s-button type="submit">Continue to Shopify</s-button>
            </s-stack>
          </s-section>
        </Form>
      </s-page>
    </AppProvider>
  );
}
