import type { DatabaseClient } from "@categoryfix/db";
import { getShopSettings } from "@categoryfix/db";

export interface AuthenticatedAdminContext {
  session: {
    shop: string;
  };
}

export async function createShopSettingsResponse(args: {
  request: Request;
  authenticateAdmin: (request: Request) => Promise<AuthenticatedAdminContext>;
  database: DatabaseClient;
}): Promise<Response> {
  const { session } = await args.authenticateAdmin(args.request);
  const installation = await getShopSettings(session.shop, args.database);

  return Response.json({
    shop: session.shop,
    installation,
  });
}
