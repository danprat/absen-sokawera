import { handleAppRequestWithErrors } from "../_shared/appApiCore.ts";

Deno.serve((req) =>
  handleAppRequestWithErrors(req, [
    "/api/v1/attendance",
    "/api/v1/admin/dashboard",
    "/api/v1/admin/attendance",
  ], "attendance-api")
);
