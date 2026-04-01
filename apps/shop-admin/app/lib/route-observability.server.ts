import { logStructuredError } from "@categoryfix/shopify-core";

function getRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

type RouteArgs = {
  request: Request;
};

export function withRouteErrorReporting<TArgs extends RouteArgs, TResult>(
  routeId: string,
  routeKind: "loader" | "action",
  handler: (args: TArgs) => Promise<TResult>,
) {
  return async (args: TArgs) => {
    try {
      return await handler(args);
    } catch (error) {
      const url = new URL(args.request.url);

      logStructuredError(
        "categoryfix.route.unhandled",
        {
          routeId,
          routeKind,
          requestId: getRequestId(args.request),
          method: args.request.method,
          pathname: url.pathname,
        },
        error,
      );

      throw error;
    }
  };
}
