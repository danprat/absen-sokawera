import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBackendPath,
  getAllowedMethod,
} from "../_shared/faceRoutes.mjs";

test("maps attendance recognize to the FastAPI backend path", () => {
  const target = buildBackendPath(
    new URL("http://localhost:54321/functions/v1/face-orchestrator/attendance/recognize"),
  );

  assert.equal(target, "/api/v1/attendance/recognize");
});

test("maps agnostic face recognize and detect routes", () => {
  assert.equal(
    buildBackendPath(new URL("http://localhost:54321/functions/v1/face-orchestrator/recognize")),
    "/api/v1/recognize",
  );
  assert.equal(
    buildBackendPath(new URL("http://localhost:54321/functions/v1/face-orchestrator/detect")),
    "/api/v1/detect",
  );
});

test("maps agnostic subject and face routes", () => {
  assert.equal(
    buildBackendPath(new URL("http://localhost:54321/functions/v1/face-orchestrator/subjects")),
    "/api/v1/subjects",
  );
  assert.equal(
    buildBackendPath(new URL("http://localhost:54321/functions/v1/face-orchestrator/subjects/7/faces")),
    "/api/v1/subjects/7/faces",
  );
  assert.equal(
    buildBackendPath(new URL("http://localhost:54321/functions/v1/face-orchestrator/faces/11")),
    "/api/v1/faces/11",
  );
});

test("maps face enrollment with employee id to the FastAPI backend path", () => {
  const target = buildBackendPath(
    new URL("http://localhost:54321/functions/v1/face-orchestrator/employees/42/face/9"),
  );

  assert.equal(target, "/api/v1/employees/42/face/9");
});

test("rejects unknown face orchestrator paths", () => {
  assert.throws(
    () => buildBackendPath(new URL("http://localhost:54321/functions/v1/face-orchestrator/admins")),
    /Unsupported face orchestrator path/,
  );
});

test("limits methods by operation", () => {
  assert.equal(getAllowedMethod("/api/v1/attendance/recognize"), "POST");
  assert.equal(getAllowedMethod("/api/v1/attendance/confirm"), "POST");
  assert.equal(getAllowedMethod("/api/v1/employees/42/face"), "GET_POST");
  assert.equal(getAllowedMethod("/api/v1/employees/42/face/9"), "DELETE");
});
