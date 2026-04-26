import {
  buildBackendPath,
  getAllowedMethod,
  isMethodAllowed,
} from "../_shared/faceRoutes.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  if (url.pathname.endsWith("/health")) {
    return jsonResponse({ status: "ok", service: "face-orchestrator" });
  }

  const faceServiceUrl = Deno.env.get("FACE_SERVICE_URL");
  if (!faceServiceUrl) {
    return jsonResponse({ detail: "FACE_SERVICE_URL is not configured" }, 500);
  }

  let backendPath: string;
  try {
    backendPath = buildBackendPath(url);
  } catch (error) {
    return jsonResponse({ detail: error instanceof Error ? error.message : "Unsupported path" }, 404);
  }

  const allowedMethod = getAllowedMethod(backendPath);
  if (!isMethodAllowed(req.method, allowedMethod)) {
    return jsonResponse({ detail: "Method not allowed" }, 405);
  }

  const targetUrl = joinUrl(faceServiceUrl, backendPath);
  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  const authorization = req.headers.get("authorization");
  const accept = req.headers.get("accept");
  const faceServiceApiKey = Deno.env.get("FACE_SERVICE_API_KEY");

  if (contentType) headers.set("content-type", contentType);
  if (authorization) headers.set("authorization", authorization);
  if (accept) headers.set("accept", accept);
  if (faceServiceApiKey) {
    headers.set("x-face-service-key", faceServiceApiKey);
    headers.set("x-face-app-key", faceServiceApiKey);
  }

  const body = req.method === "GET" ? undefined : await req.arrayBuffer();

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return jsonResponse(
      {
        detail: "Face service unavailable",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      502,
    );
  }
});
