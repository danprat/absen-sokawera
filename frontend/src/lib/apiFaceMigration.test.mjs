import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiSource = readFileSync(join(__dirname, "api.ts"), "utf8");
const assetsSource = readFileSync(join(__dirname, "assets.ts"), "utf8");
const envExampleSource = readFileSync(join(__dirname, "../../.env.example"), "utf8");
const edgeCoreSource = readFileSync(join(__dirname, "../../../supabase/functions/_shared/appApiCore.ts"), "utf8");

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

test("frontend production defaults do not point to the legacy app-api monolith", () => {
  assert.doesNotMatch(apiSource, /functions\/v1\/app-api/);
  assert.doesNotMatch(envExampleSource, /^VITE_API_BASE_URL=.*functions\/v1\/app-api/m);
});

test("frontend admin dashboard uses the aggregate Edge endpoint", () => {
  const dashboardSource = readFileSync(join(__dirname, "../pages/admin/AdminDashboard.tsx"), "utf8");

  assert.match(apiSource, /['"]\/api\/v1\/admin\/dashboard['"]/);
  assert.match(dashboardSource, /api\.admin\.dashboard\(\)/);
  assert.doesNotMatch(dashboardSource, /api\.admin\.attendance\.today\(\)/);
  assert.doesNotMatch(dashboardSource, /api\.admin\.auditLogs\.list\(\{ page_size: 5 \}\)/);
  assert.doesNotMatch(dashboardSource, /api\.admin\.settings\.get\(\)/);
});

test("frontend slow admin pages avoid redundant bootstrapping requests", () => {
  const historySource = readFileSync(join(__dirname, "../pages/admin/AdminRiwayat.tsx"), "utf8");
  const settingsSource = readFileSync(join(__dirname, "../pages/admin/AdminPengaturan.tsx"), "utf8");
  const employeeSource = readFileSync(join(__dirname, "../pages/admin/AdminPegawai.tsx"), "utf8");

  assert.doesNotMatch(historySource, /api\.employees\.list/);
  assert.match(settingsSource, /api\.admin\.settings\.overview/);
  assert.doesNotMatch(settingsSource, /Promise\.all\(\[\\s*api\.admin\.settings\.get\(\)/);
  assert.doesNotMatch(employeeSource, /useEffect\(\(\) => \{\s*fetchEmployees\(\);\s*\/\/ Cleanup camera on unmount/);
});

test("frontend face photos resolve from face service assets, not localhost backend", () => {
  assert.match(assetsSource, /VITE_FACE_ASSETS_BASE_URL/);
  assert.match(assetsSource, /\/uploads\/face\//);
  assert.doesNotMatch(assetsSource, /localhost:8000/);
});

test("employees edge listing uses a bulk face count lookup", () => {
  const listEmployeesBody = edgeCoreSource.match(/async function listEmployees[\s\S]*?async function getEmployee/)?.[0] || "";

  assert.match(edgeCoreSource, /async function getFaceCountsForEmployees/);
  assert.match(listEmployeesBody, /getFaceCountsForEmployees/);
  assert.doesNotMatch(listEmployeesBody, /getFaceCountForEmployee\(/);
});
