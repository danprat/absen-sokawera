const FUNCTION_NAME = "face-orchestrator";

export function buildBackendPath(url) {
  const segments = url.pathname.split("/").filter(Boolean);
  const functionIndex = segments.indexOf(FUNCTION_NAME);
  const routeSegments = functionIndex >= 0 ? segments.slice(functionIndex + 1) : segments;
  const route = `/${routeSegments.join("/")}`;

  if (route === "/attendance/recognize") {
    return "/api/v1/attendance/recognize";
  }

  if (route === "/attendance/confirm") {
    return "/api/v1/attendance/confirm";
  }

  const employeeFaceMatch = route.match(/^\/employees\/(\d+)\/face(?:\/(\d+))?$/);
  if (employeeFaceMatch) {
    const [, employeeId, faceId] = employeeFaceMatch;
    return faceId
      ? `/api/v1/employees/${employeeId}/face/${faceId}`
      : `/api/v1/employees/${employeeId}/face`;
  }

  throw new Error(`Unsupported face orchestrator path: ${route}`);
}

export function getAllowedMethod(backendPath) {
  if (backendPath === "/api/v1/attendance/recognize") {
    return "POST";
  }

  if (backendPath === "/api/v1/attendance/confirm") {
    return "POST";
  }

  if (/^\/api\/v1\/employees\/\d+\/face$/.test(backendPath)) {
    return "GET_POST";
  }

  if (/^\/api\/v1\/employees\/\d+\/face\/\d+$/.test(backendPath)) {
    return "DELETE";
  }

  throw new Error(`Unsupported backend path: ${backendPath}`);
}

export function isMethodAllowed(actualMethod, allowedMethod) {
  if (allowedMethod === "GET_POST") {
    return actualMethod === "GET" || actualMethod === "POST";
  }

  return actualMethod === allowedMethod;
}
