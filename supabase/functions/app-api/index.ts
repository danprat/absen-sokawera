import { handleAppRequestWithErrors } from "../_shared/appApiCore.ts";

Deno.serve((req) => handleAppRequestWithErrors(req));
