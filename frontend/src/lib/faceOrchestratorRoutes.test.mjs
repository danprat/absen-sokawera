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
      "/recognize",
    ),
    "http://127.0.0.1:54321/functions/v1/face-orchestrator/recognize",
  );
});

test("builds agnostic subject and face URLs", () => {
  assert.equal(
    createFaceOperationUrl("http://127.0.0.1:54321/functions/v1/face-orchestrator", "subjects/7/faces"),
    "http://127.0.0.1:54321/functions/v1/face-orchestrator/subjects/7/faces",
  );
});
