import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiSource = readFileSync(join(__dirname, "api.ts"), "utf8");

test("frontend face enrollment uses agnostic subject and face routes", () => {
  assert.match(apiSource, /\/subjects/);
  assert.match(apiSource, /\/faces/);
  assert.doesNotMatch(apiSource, /createFaceOperationUrl\(FACE_ORCHESTRATOR_URL,\s*`\/employees\/\$\{employeeId\}\/face/);
});

test("frontend recognition and confirmation are split between face and attendance APIs", () => {
  assert.match(apiSource, /createFaceOperationUrl\(FACE_ORCHESTRATOR_URL,\s*['"]\/recognize['"]/);
  assert.match(apiSource, /['"]\/api\/v1\/attendance\/confirm['"]/);
  assert.doesNotMatch(apiSource, /createFaceOperationUrl\(FACE_ORCHESTRATOR_URL,\s*['"]\/attendance\/recognize['"]/);
  assert.doesNotMatch(apiSource, /createFaceOperationUrl\(FACE_ORCHESTRATOR_URL,\s*['"]\/attendance\/confirm['"]/);
});
