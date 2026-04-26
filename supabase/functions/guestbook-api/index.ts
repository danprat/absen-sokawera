import { handleAppRequestWithErrors } from "../_shared/appApiCore.ts";

Deno.serve((req) =>
  handleAppRequestWithErrors(req, [
    "/api/v1/guestbook",
    "/api/v1/admin/guest-book",
  ], "guestbook-api")
);
