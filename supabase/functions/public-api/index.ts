import { handleAppRequestWithErrors } from "../_shared/appApiCore.ts";

Deno.serve((req) =>
  handleAppRequestWithErrors(req, [
    "/api/v1/public",
  ], "public-api")
);
