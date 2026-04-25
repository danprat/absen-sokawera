import test from "node:test";
import assert from "node:assert/strict";

import {
  createFaceOperationUrl,
  normalizeBaseUrl,
} from "./faceOrchestratorRoutes.mjs";

test("normalizes the orchestrator base url without trailing slashes", () => {
  assert.equal(
    normalizeBaseUrl("http://127.0.0.1:54321/functions/v1/face-orchestrator/"),
    "http://127.0.0.1:54321/functions/v1/face-orchestrator",
  );
});

test("builds face operation URLs relative to the orchestrator", () => {
  assert.equal(
    createFaceOperationUrl(
      "http://127.0.0.1:54321/functions/v1/face-orchestrator/",
      "/attendance/recognize",
    ),
    "http://127.0.0.1:54321/functions/v1/face-orchestrator/attendance/recognize",
  );
});

test("keeps the legacy API v1 URL shape when backend is used as fallback", () => {
  assert.equal(
    createFaceOperationUrl("http://127.0.0.1:8000/api/v1", "employees/7/face"),
    "http://127.0.0.1:8000/api/v1/employees/7/face",
  );
});
