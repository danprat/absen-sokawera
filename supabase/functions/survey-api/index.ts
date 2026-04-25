import { handleAppRequestWithErrors } from "../_shared/appApiCore.ts";

Deno.serve((req) =>
  handleAppRequestWithErrors(req, [
    "/api/v1/survey",
    "/api/v1/admin/survey",
  ], "survey-api")
);
