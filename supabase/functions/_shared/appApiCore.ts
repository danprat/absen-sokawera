import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";
import { SignJWT, jwtVerify } from "npm:jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const jwtSecret = new TextEncoder().encode(
  Deno.env.get("APP_JWT_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "dev-secret",
);

type AdminUser = {
  id: number;
  username: string;
  name: string;
  role: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function empty(status = 204) {
  return new Response(null, { status, headers: corsHeaders });
}

function bad(detail: string, status = 400) {
  return json({ detail }, status);
}

async function invalidateFaceServiceAttendanceCache() {
  const faceServiceUrl = Deno.env.get("FACE_SERVICE_URL");
  const faceServiceApiKey = Deno.env.get("FACE_SERVICE_API_KEY");

  if (!faceServiceUrl || !faceServiceApiKey) return;

  try {
    const response = await fetch(
      `${faceServiceUrl.replace(/\/+$/, "")}/api/v1/attendance/cache/invalidate`,
      {
        method: "POST",
        headers: {
          "x-face-service-key": faceServiceApiKey,
        },
      },
    );

    if (!response.ok) {
      console.warn(`Face service cache invalidation failed: ${response.status}`);
    }
  } catch (error) {
    console.warn("Face service cache invalidation failed", error);
  }
}

function parseBool(value: string | null) {
  if (value === null || value === undefined || value === "") return undefined;
  return value === "true" || value === "1";
}

function intParam(url: URL, name: string, fallback: number) {
  const value = Number(url.searchParams.get(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function bodyJson(req: Request) {
  if (req.headers.get("content-type")?.includes("application/json")) {
    return await req.json();
  }
  return {};
}

async function formBody(req: Request) {
  const text = await req.text();
  return new URLSearchParams(text);
}

async function createToken(admin: AdminUser) {
  return await new SignJWT({
    admin_id: admin.id,
    role: admin.role,
    name: admin.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.username)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(jwtSecret);
}

async function getAdmin(req: Request): Promise<AdminUser | null> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, jwtSecret);
    const adminId = Number(payload.admin_id);
    if (!adminId) return null;

    const { data, error } = await supabase
      .from("admins")
      .select("id, username, name, role")
      .eq("id", adminId)
      .single();

    if (error || !data) return null;
    return data as AdminUser;
  } catch {
    return null;
  }
}

async function requireAdmin(req: Request, write = false) {
  const admin = await getAdmin(req);
  if (!admin) throw new Response(JSON.stringify({ detail: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json", "WWW-Authenticate": "Bearer" } });
  if (write && admin.role !== "admin") throw new Response(JSON.stringify({ detail: "Akses ditolak" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  return admin;
}

async function logAudit(action: string, entityType: string, description: string, admin?: AdminUser, entityId?: number, details?: unknown) {
  await supabase.from("audit_logs").insert({
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    description,
    performed_by: admin?.name || admin?.username || "system",
    details: details ?? null,
  });
}

function stripRoute(url: URL) {
  const functionPath = url.pathname.match(/^\/functions\/v1\/[^/]+(\/.*)?$/);
  if (functionPath) return functionPath[1] || "/";

  const localFunctionPath = url.pathname.match(/^\/[^/]+(\/api\/v1\/.*|\/health)?$/);
  if (localFunctionPath) return localFunctionPath[1] || "/";

  return url.pathname;
}

function jakartaDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  const dayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };

  return {
    isoDate: `${part("year")}-${part("month")}-${part("day")}`,
    dayOfWeek: dayMap[part("weekday")] ?? 0,
  };
}

function todayIso() {
  return jakartaDateParts().isoDate;
}

function jakartaNowParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  const dayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };

  return {
    isoDate: `${part("year")}-${part("month")}-${part("day")}`,
    dateTime: `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`,
    dayOfWeek: dayMap[part("weekday")] ?? 0,
    minutes: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

function timeHHMM(value: string | null | undefined) {
  return value ? value.slice(0, 5) : value;
}

function dateTimeHHMM(value: unknown) {
  const text = typeof value === "string" ? value : "";
  return text.includes("T") ? text.split("T")[1].slice(0, 5) : text.slice(11, 16) || timeHHMM(text);
}

function timeToMinutes(value: string | null | undefined, fallback: string) {
  const [hour, minute] = (value || fallback).slice(0, 5).split(":").map((part) => Number(part));
  return hour * 60 + minute;
}

function attendanceStatus(attendance: Record<string, unknown> | null | undefined) {
  if (!attendance?.check_in_at) return "belum_absen";
  if (!attendance.check_out_at) return "sudah_check_in";
  return "sudah_lengkap";
}

function attendanceResponse(
  employee: Record<string, unknown>,
  attendance: Record<string, unknown>,
  message: string,
  confidence: number,
) {
  return json({
    employee: {
      id: employee.id,
      name: employee.name,
      position: employee.position,
      photo: employee.photo_url ?? null,
    },
    attendance: {
      id: attendance.id,
      status: String(attendance.status || "").toLowerCase(),
      check_in_at: attendance.check_in_at ?? null,
      check_out_at: attendance.check_out_at ?? null,
    },
    message,
    confidence: Math.round(confidence * 10) / 10,
    attendance_status: attendanceStatus(attendance),
  });
}

function currentYearJakarta() {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
    }).format(new Date()),
  );
}

function parseHolidayDate(value: unknown) {
  if (typeof value !== "string") return null;
  const parts = value.split("-").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  const [year, month, day] = parts;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeHolidayItem(item: Record<string, unknown>) {
  const date = parseHolidayDate(item.date ?? item.tanggal);
  const name = String(item.name ?? item.description ?? item.keterangan ?? "").trim();
  if (!date || !name) return null;

  return {
    date,
    name,
    is_cuti: Boolean(item.is_cuti) || /cuti bersama/i.test(name),
  };
}

async function fetchHolidayApi(year: number) {
  const configuredUrl = Deno.env.get("HOLIDAY_API_URL");
  const endpoints = [
    configuredUrl,
    "https://libur.deno.dev/api",
    "https://api-hari-libur.vercel.app/api",
    "https://dayoffapi.vercel.app/api",
  ].filter(Boolean) as string[];

  const errors: string[] = [];
  for (const endpoint of endpoints) {
    const url = new URL(endpoint);
    url.searchParams.set("year", String(year));

    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        errors.push(`${url.origin}: HTTP ${response.status}`);
        continue;
      }

      const payload = await response.json();
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

      const holidays = items
        .filter((item: unknown): item is Record<string, unknown> => item !== null && typeof item === "object")
        .map(normalizeHolidayItem)
        .filter(Boolean) as Array<{ date: string; name: string; is_cuti: boolean }>;

      if (holidays.length > 0) {
        return { holidays, source: url.origin };
      }

      errors.push(`${url.origin}: response kosong`);
    } catch (error) {
      errors.push(`${url.origin}: ${error instanceof Error ? error.message : "gagal fetch"}`);
    }
  }

  throw new Error(errors.join("; "));
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function csvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function csvResponse(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvValue).join(",")).join("\n");
  return new Response(csv, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

async function publicSettings() {
  let { data: settings } = await supabase.from("work_settings").select("*").order("id").limit(1).maybeSingle();
  if (!settings) {
    const inserted = await supabase.from("work_settings").insert({ village_name: "Desa" }).select("*").single();
    settings = inserted.data;
  }

  const dayOfWeek = jakartaDateParts().dayOfWeek;
  const { data: schedule } = await supabase
    .from("daily_work_schedules")
    .select("*")
    .eq("day_of_week", dayOfWeek)
    .maybeSingle();

  return {
    village_name: settings?.village_name || "Desa",
    officer_name: settings?.officer_name ?? null,
    logo_url: settings?.logo_url ?? null,
    background_url: settings?.background_url ?? null,
    today_schedule: schedule
      ? {
          is_workday: schedule.is_workday,
          check_in_start: timeHHMM(schedule.check_in_start),
          check_in_end: timeHHMM(schedule.check_in_end),
          check_out_start: timeHHMM(schedule.check_out_start),
        }
      : null,
  };
}

async function attendanceToday(adminShape = false) {
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, position, photo_url, is_active")
    .eq("is_active", true)
    .order("name");

  const { data: logs } = await supabase
    .from("attendance_logs")
    .select("*")
    .eq("date", todayIso())
    .order("check_in_at", { ascending: false });

  const employeeById = new Map((employees || []).map((employee) => [employee.id, employee]));
  const items = (logs || []).map((att) => {
    const employee = employeeById.get(att.employee_id);
    return {
      id: att.id,
      employee_id: att.employee_id,
      employee_name: employee?.name || "",
      employee_position: employee?.position || "",
      employee_photo: employee?.photo_url || null,
      check_in_at: att.check_in_at,
      check_out_at: att.check_out_at,
      status: String(att.status || "").toLowerCase(),
    };
  });

  if (!adminShape) return { items, total: items.length };

  const summary = {
    total_employees: employees?.length || 0,
    present: items.filter((item) => item.status === "hadir").length,
    late: items.filter((item) => item.status === "terlambat").length,
    absent: items.filter((item) => item.status === "alfa").length,
    on_leave: items.filter((item) => item.status === "izin").length,
    sick: items.filter((item) => item.status === "sakit").length,
  };

  return { items, summary };
}

async function listEmployees(url: URL) {
  const page = intParam(url, "page", 1);
  const pageSize = intParam(url, "page_size", 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const search = url.searchParams.get("search");
  const isActive = parseBool(url.searchParams.get("is_active"));

  let query = supabase.from("employees").select("*", { count: "exact" });
  if (isActive !== undefined) query = query.eq("is_active", isActive);
  if (search) query = query.or(`name.ilike.%${search}%,nik.ilike.%${search}%,position.ilike.%${search}%`);

  const { data, count, error } = await query.order("name").range(from, to);
  if (error) return bad(error.message, 500);

  const ids = (data || []).map((employee) => employee.id);
  const { data: subjects } = ids.length
    ? await supabase
      .from("face_subjects")
      .select("id, external_subject_id")
      .eq("tenant_id", "default")
      .in("external_subject_id", ids.map(String))
    : { data: [] };
  const subjectEmployeeIds = new Map<number, number>();
  (subjects || []).forEach((subject) => {
    subjectEmployeeIds.set(subject.id, Number(subject.external_subject_id));
  });
  const { data: faces } = subjectEmployeeIds.size
    ? await supabase.from("face_templates").select("subject_id").in("subject_id", Array.from(subjectEmployeeIds.keys()))
    : { data: [] };
  const faceCounts = new Map<number, number>();
  (faces || []).forEach((face) => {
    const employeeId = subjectEmployeeIds.get(face.subject_id);
    if (employeeId) faceCounts.set(employeeId, (faceCounts.get(employeeId) || 0) + 1);
  });

  return json({
    items: (data || []).map((employee) => ({ ...employee, face_count: faceCounts.get(employee.id) || 0 })),
    total: count || 0,
    page,
    page_size: pageSize,
  });
}

async function getEmployee(id: number) {
  const { data, error } = await supabase.from("employees").select("*").eq("id", id).single();
  if (error) return bad("Pegawai tidak ditemukan", 404);
  const { data: subject } = await supabase
    .from("face_subjects")
    .select("id")
    .eq("tenant_id", "default")
    .eq("external_subject_id", String(id))
    .maybeSingle();
  const { count } = subject?.id
    ? await supabase.from("face_templates").select("id", { count: "exact", head: true }).eq("subject_id", subject.id)
    : { count: 0 };
  return json({ ...data, face_count: count || 0 });
}

async function createEmployee(req: Request) {
  const admin = await requireAdmin(req, true);
  const data = await bodyJson(req);
  const payload = {
    tenant_id: "default",
    name: data.name,
    position: data.position,
    nik: data.nik || null,
    phone: data.phone || null,
    address: data.address || null,
    is_active: true,
  };
  const { data: created, error } = await supabase.from("employees").insert(payload).select("*").single();
  if (error) return bad(error.message, 400);
  await logAudit("CREATE", "EMPLOYEE", `Menambahkan pegawai: ${created.name}`, admin, created.id);
  return json({ ...created, face_count: 0 }, 201);
}

async function updateEmployee(req: Request, id: number) {
  const admin = await requireAdmin(req, true);
  const data = await bodyJson(req);
  const allowed = ["name", "position", "nik", "phone", "address", "is_active"];
  const payload = Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
  const { data: updated, error } = await supabase.from("employees").update(payload).eq("id", id).select("*").single();
  if (error) return bad(error.message, 400);
  await logAudit("UPDATE", "EMPLOYEE", `Mengupdate pegawai: ${updated.name}`, admin, id, payload);
  return json({ ...updated, face_count: 0 });
}

async function deleteEmployee(req: Request, id: number) {
  const admin = await requireAdmin(req, true);
  const { data } = await supabase.from("employees").update({ is_active: false }).eq("id", id).select("name").single();
  await logAudit("DELETE", "EMPLOYEE", `Menonaktifkan pegawai: ${data?.name || id}`, admin, id);
  return empty();
}

async function listAttendance(url: URL) {
  const page = intParam(url, "page", 1);
  const pageSize = intParam(url, "page_size", 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase.from("attendance_logs").select("*, employees(name)", { count: "exact" });
  if (url.searchParams.get("employee_id")) query = query.eq("employee_id", Number(url.searchParams.get("employee_id")));
  if (url.searchParams.get("start_date")) query = query.gte("date", url.searchParams.get("start_date"));
  if (url.searchParams.get("end_date")) query = query.lte("date", url.searchParams.get("end_date"));
  if (url.searchParams.get("status")) query = query.eq("status", String(url.searchParams.get("status")).toUpperCase());
  const { data, count, error } = await query.order("date", { ascending: false }).range(from, to);
  if (error) return bad(error.message, 500);
  return json({
    items: (data || []).map((item) => ({
      ...item,
      status: String(item.status || "").toLowerCase(),
      employee_name: item.employees?.name || "",
    })),
    total: count || 0,
    page,
    page_size: pageSize,
  });
}

async function correctAttendance(req: Request, id: number) {
  const admin = await requireAdmin(req, true);
  const data = await bodyJson(req);
  const payload = {
    ...data,
    status: data.status ? String(data.status).toUpperCase() : undefined,
    corrected_by: admin.name,
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  const { data: updated, error } = await supabase.from("attendance_logs").update(payload).eq("id", id).select("*, employees(name)").single();
  if (error) return bad(error.message, 400);
  await logAudit("CORRECT", "ATTENDANCE", `Koreksi absensi ${updated.employees?.name || id}`, admin, id, payload);
  return json({ ...updated, status: String(updated.status || "").toLowerCase(), employee_name: updated.employees?.name || "" });
}

async function confirmAttendance(req: Request) {
  const data = await bodyJson(req);
  const employeeId = Number(data.employee_id);
  const confidence = Number(data.confidence);
  if (!Number.isFinite(employeeId) || !Number.isFinite(confidence)) {
    return bad("employee_id dan confidence wajib diisi", 400);
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, name, position, photo_url, is_active")
    .eq("id", employeeId)
    .eq("is_active", true)
    .single();
  if (employeeError || !employee) return bad("Employee tidak ditemukan", 404);

  const now = jakartaNowParts();
  const { data: schedule } = await supabase
    .from("daily_work_schedules")
    .select("*")
    .eq("day_of_week", now.dayOfWeek)
    .maybeSingle();
  const isWorkday = schedule ? Boolean(schedule.is_workday) : now.dayOfWeek < 5;
  if (!isWorkday) return bad("Hari ini bukan hari kerja", 400);

  const { data: holiday } = await supabase
    .from("holidays")
    .select("id, is_excluded")
    .eq("date", now.isoDate)
    .maybeSingle();
  if (holiday && !holiday.is_excluded) return bad("Hari ini adalah hari libur", 400);

  const { data: settings } = await supabase.from("work_settings").select("late_threshold_minutes").order("id").limit(1).maybeSingle();
  const checkInStart = timeToMinutes(schedule?.check_in_start, "07:00");
  const checkInEnd = timeToMinutes(schedule?.check_in_end, "08:00");
  const checkOutStart = timeToMinutes(schedule?.check_out_start, "16:00");
  const checkOutEnd = 23 * 60 + 59;

  const { data: existingAttendance } = await supabase
    .from("attendance_logs")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("date", now.isoDate)
    .maybeSingle();

  const hasCheckedIn = Boolean(existingAttendance?.check_in_at);
  const isCheckInWindow = !hasCheckedIn && now.minutes >= checkInStart && now.minutes < checkOutStart;
  const isCheckOutWindow = hasCheckedIn && now.minutes >= checkOutStart && now.minutes <= checkOutEnd;
  if (!isCheckInWindow && !isCheckOutWindow) {
    return bad(`Di luar jam absensi (${timeHHMM(schedule?.check_in_start || "07:00")}-23:59)`, 400);
  }

  if (isCheckInWindow) {
    const lateThreshold = checkInEnd + Number(settings?.late_threshold_minutes ?? 15);
    const status = now.minutes <= lateThreshold ? "HADIR" : "TERLAMBAT";
    const payload = {
      employee_id: employeeId,
      date: now.isoDate,
      check_in_at: now.dateTime,
      status,
      confidence_score: confidence / 100,
      updated_at: now.dateTime,
    };

    const result = existingAttendance
      ? await supabase.from("attendance_logs").update(payload).eq("id", existingAttendance.id).select("*").single()
      : await supabase.from("attendance_logs").insert(payload).select("*").single();

    if (result.error || !result.data) return bad(result.error?.message || "Gagal menyimpan absensi", 400);
    return attendanceResponse(
      employee,
      result.data,
      status === "TERLAMBAT" ? `Selamat datang, ${employee.name} (Terlambat)` : `Selamat datang, ${employee.name}`,
      confidence,
    );
  }

  if (!existingAttendance?.check_in_at) return bad("Belum absen masuk hari ini", 400);
  if (existingAttendance.check_out_at) {
    return attendanceResponse(employee, existingAttendance, `Sudah absen pulang pukul ${dateTimeHHMM(existingAttendance.check_out_at)}`, confidence);
  }

  const checkInAt = new Date(String(existingAttendance.check_in_at)).getTime();
  const nowAt = new Date(now.dateTime).getTime();
  if (Number.isFinite(checkInAt) && Number.isFinite(nowAt) && nowAt - checkInAt < 180_000) {
    const minutesLeft = 3 - Math.floor((nowAt - checkInAt) / 60_000);
    return bad(`Anda baru saja check-in. Harap tunggu ${minutesLeft} menit lagi untuk check-out.`, 400);
  }

  const { data: updated, error } = await supabase
    .from("attendance_logs")
    .update({ check_out_at: now.dateTime, updated_at: now.dateTime })
    .eq("id", existingAttendance.id)
    .select("*")
    .single();
  if (error || !updated) return bad(error?.message || "Gagal menyimpan absensi pulang", 400);
  return attendanceResponse(employee, updated, `Sampai jumpa besok, ${employee.name}`, confidence);
}

async function monthlyReport(url: URL) {
  const month = intParam(url, "month", new Date().getMonth() + 1);
  const year = intParam(url, "year", new Date().getFullYear());
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth(year, month)).padStart(2, "0")}`;

  const { data: employees, error: employeeError } = await supabase
    .from("employees")
    .select("id, name, nik, position")
    .eq("is_active", true)
    .order("name");
  if (employeeError) return bad(employeeError.message, 500);

  const { data: logs, error: logsError } = await supabase
    .from("attendance_logs")
    .select("*")
    .gte("date", start)
    .lte("date", end);
  if (logsError) return bad(logsError.message, 500);

  const logsByEmployee = new Map<number, any[]>();
  (logs || []).forEach((log) => logsByEmployee.set(log.employee_id, [...(logsByEmployee.get(log.employee_id) || []), log]));

  const totalDays = daysInMonth(year, month);
  const items = (employees || []).map((employee) => {
    const employeeLogs = logsByEmployee.get(employee.id) || [];
    const countStatus = (status: string) => employeeLogs.filter((log) => String(log.status).toUpperCase() === status).length;
    const presentDays = countStatus("HADIR");
    const lateDays = countStatus("TERLAMBAT");
    const leaveDays = countStatus("IZIN");
    const sickDays = countStatus("SAKIT");
    const absentDays = countStatus("ALFA");

    return {
      employee_id: employee.id,
      employee_name: employee.name,
      employee_nik: employee.nik,
      employee_position: employee.position,
      total_days: totalDays,
      present_days: presentDays,
      late_days: lateDays,
      absent_days: absentDays,
      leave_days: leaveDays,
      sick_days: sickDays,
      checkout_days: employeeLogs.filter((log) => log.check_out_at).length,
      attendance_percentage: totalDays ? Math.round(((presentDays + lateDays) / totalDays) * 100) : 0,
    };
  });

  return json({ month, year, items, total_employees: items.length });
}

async function exportMonthlyReport(req: Request, url: URL) {
  await requireAdmin(req);
  const response = await monthlyReport(url);
  const report = await response.clone().json();
  const rows = [
    ["Nama", "NIK", "Jabatan", "Hadir", "Terlambat", "Izin", "Sakit", "Alfa", "Checkout", "Persentase"],
    ...report.items.map((item) => [
      item.employee_name,
      item.employee_nik || "",
      item.employee_position,
      item.present_days,
      item.late_days,
      item.leave_days,
      item.sick_days,
      item.absent_days,
      item.checkout_days,
      `${item.attendance_percentage}%`,
    ]),
  ];
  return csvResponse(`rekap-absensi-${report.month}-${report.year}.csv`, rows);
}

async function settingsGet() {
  const { data } = await supabase.from("work_settings").select("*").order("id").limit(1).maybeSingle();
  return json(data || { id: 1, village_name: "Desa" });
}

async function settingsUpdate(req: Request) {
  const admin = await requireAdmin(req, true);
  const data = await bodyJson(req);
  const { data: existing } = await supabase.from("work_settings").select("id").order("id").limit(1).maybeSingle();
  const result = existing
    ? await supabase.from("work_settings").update(data).eq("id", existing.id).select("*").single()
    : await supabase.from("work_settings").insert({ id: 1, ...data }).select("*").single();
  if (result.error) return bad(result.error.message, 400);
  await invalidateFaceServiceAttendanceCache();
  await logAudit("UPDATE", "SETTINGS", "Mengupdate pengaturan kantor", admin, result.data.id, data);
  return json(result.data);
}

async function uploadSettingAsset(req: Request, field: "logo_url" | "background_url", folder: string) {
  const admin = await requireAdmin(req, true);
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return bad("File harus diisi", 400);
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const upload = await supabase.storage.from("branding-assets").upload(path, await file.arrayBuffer(), {
    contentType: file.type || "application/octet-stream",
  });
  if (upload.error) return bad(upload.error.message, 400);
  const { data: publicUrl } = supabase.storage.from("branding-assets").getPublicUrl(path);
  const { data: existing } = await supabase.from("work_settings").select("id").order("id").limit(1).maybeSingle();
  const result = existing
    ? await supabase.from("work_settings").update({ [field]: publicUrl.publicUrl }).eq("id", existing.id).select("*").single()
    : await supabase.from("work_settings").insert({ id: 1, village_name: "Desa", [field]: publicUrl.publicUrl }).select("*").single();
  await logAudit("UPDATE", "SETTINGS", `Mengupload ${field}`, admin, result.data?.id, { [field]: publicUrl.publicUrl });
  return json({ message: "Upload berhasil", [field]: publicUrl.publicUrl });
}

async function deleteSettingAsset(req: Request, field: "logo_url" | "background_url") {
  const admin = await requireAdmin(req, true);
  const { data: existing } = await supabase.from("work_settings").select("id").order("id").limit(1).maybeSingle();
  if (!existing) return bad("Pengaturan tidak ditemukan", 404);
  await supabase.from("work_settings").update({ [field]: null }).eq("id", existing.id);
  await logAudit("DELETE", "SETTINGS", `Menghapus ${field}`, admin, existing.id);
  return json({ message: "Berhasil dihapus" });
}

async function holidays(url: URL, excluded = false) {
  let query = supabase.from("holidays").select("*", { count: "exact" });
  const year = url.searchParams.get("year");
  if (year) {
    query = query.gte("date", `${year}-01-01`).lte("date", `${year}-12-31`);
  }
  query = query.eq("is_excluded", excluded);
  const { data, count, error } = await query.order("date");
  if (error) return bad(error.message, 500);
  return json({ items: data || [], total: count || 0 });
}

async function createHoliday(req: Request) {
  const admin = await requireAdmin(req, true);
  const payload = await bodyJson(req);
  const { data, error } = await supabase.from("holidays").insert(payload).select("*").single();
  if (error) return bad(error.message, 400);
  await invalidateFaceServiceAttendanceCache();
  await logAudit("CREATE", "HOLIDAY", `Menambahkan hari libur: ${data.name} (${data.date})`, admin, data.id, payload);
  return json(data, 201);
}

async function restoreHoliday(req: Request, id: number) {
  const admin = await requireAdmin(req, true);
  const { data, error } = await supabase.from("holidays").update({ is_excluded: false }).eq("id", id).select("*").single();
  if (error) return bad(error.message, 400);
  await invalidateFaceServiceAttendanceCache();
  await logAudit("UPDATE", "HOLIDAY", `Mengembalikan hari libur: ${data.name}`, admin, id);
  return json(data);
}

async function deleteHoliday(req: Request, id: number) {
  const admin = await requireAdmin(req, true);
  const { data: holiday, error: findError } = await supabase.from("holidays").select("*").eq("id", id).single();
  if (findError || !holiday) return bad("Hari libur tidak ditemukan", 404);

  await logAudit("DELETE", "HOLIDAY", `Menghapus hari libur: ${holiday.name} (${holiday.date})`, admin, id);

  if (holiday.is_auto) {
    const { error } = await supabase.from("holidays").update({ is_excluded: true }).eq("id", id);
    if (error) return bad(error.message, 400);
    await invalidateFaceServiceAttendanceCache();
    return empty();
  }

  const { error } = await supabase.from("holidays").delete().eq("id", id);
  if (error) return bad(error.message, 400);
  await invalidateFaceServiceAttendanceCache();
  return empty();
}

async function syncHolidays(req: Request, url: URL) {
  const admin = await requireAdmin(req, true);
  const yearParam = Number(url.searchParams.get("year"));
  const year = Number.isFinite(yearParam) && yearParam >= 1900 ? yearParam : currentYearJakarta();
  const { holidays: apiHolidays, source } = await fetchHolidayApi(year);
  const stats = { added: 0, updated: 0, skipped: 0 };

  for (const holiday of apiHolidays) {
    const { data: existing, error: findError } = await supabase
      .from("holidays")
      .select("*")
      .eq("date", holiday.date)
      .maybeSingle();

    if (findError) return bad(findError.message, 500);

    if (existing?.is_excluded) {
      stats.skipped += 1;
      continue;
    }

    if (existing) {
      if (existing.is_auto) {
        const { error } = await supabase
          .from("holidays")
          .update({
            name: holiday.name,
            is_cuti: holiday.is_cuti,
            is_excluded: false,
          })
          .eq("id", existing.id);

        if (error) return bad(error.message, 500);
        stats.updated += 1;
      } else {
        stats.skipped += 1;
      }
      continue;
    }

    const { error } = await supabase.from("holidays").insert({
      date: holiday.date,
      name: holiday.name,
      is_auto: true,
      is_cuti: holiday.is_cuti,
      is_excluded: false,
    });

    if (error) return bad(error.message, 500);
    stats.added += 1;
  }

  await logAudit(
    "CREATE",
    "HOLIDAY",
    `Sync hari libur dari API: ${stats.added} ditambahkan, ${stats.updated} diperbarui`,
    admin,
    undefined,
    { ...stats, year, source },
  );

  await invalidateFaceServiceAttendanceCache();

  return json({
    ...stats,
    message: `Berhasil sync ${stats.added} hari libur baru, ${stats.updated} diperbarui`,
  });
}

async function schedulesList() {
  const { data } = await supabase.from("daily_work_schedules").select("*").order("day_of_week");
  return json(data || []);
}

async function schedulesUpdate(req: Request) {
  await requireAdmin(req, true);
  const body = await bodyJson(req);
  const schedules = body.schedules || [];
  for (const schedule of schedules) {
    await supabase.from("daily_work_schedules").upsert(schedule, { onConflict: "day_of_week" });
  }
  await invalidateFaceServiceAttendanceCache();
  return schedulesList();
}

async function listAuditLogs(url: URL) {
  const page = intParam(url, "page", 1);
  const pageSize = intParam(url, "page_size", 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase.from("audit_logs").select("*", { count: "exact" });
  if (url.searchParams.get("action")) query = query.eq("action", String(url.searchParams.get("action")).toUpperCase());
  if (url.searchParams.get("entity_type")) query = query.eq("entity_type", String(url.searchParams.get("entity_type")).toUpperCase());
  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);
  return json({ items: data || [], total: count || 0, page, page_size: pageSize });
}

async function listAdmins() {
  const { data } = await supabase.from("admins").select("id, username, name, role, created_at, updated_at").order("username");
  return json({ items: data || [], total: data?.length || 0 });
}

async function createAdmin(req: Request) {
  const admin = await requireAdmin(req, true);
  const data = await bodyJson(req);
  const payload = {
    username: data.username,
    name: data.name,
    role: data.role || "admin",
    password_hash: bcrypt.hashSync(data.password || "admin123", 10),
  };
  const { data: created, error } = await supabase
    .from("admins")
    .insert(payload)
    .select("id, username, name, role, created_at, updated_at")
    .single();
  if (error) return bad(error.message, 400);
  await logAudit("CREATE", "ADMIN", `Menambahkan admin: ${created.username}`, admin, created.id);
  return json(created, 201);
}

async function updateAdmin(req: Request, id: number) {
  const admin = await requireAdmin(req, true);
  const data = await bodyJson(req);
  const allowed = ["username", "name", "role"];
  const payload = Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
  const { data: updated, error } = await supabase
    .from("admins")
    .update(payload)
    .eq("id", id)
    .select("id, username, name, role, created_at, updated_at")
    .single();
  if (error) return bad(error.message, 400);
  await logAudit("UPDATE", "ADMIN", `Mengupdate admin: ${updated.username}`, admin, id, payload);
  return json(updated);
}

async function deleteAdmin(req: Request, id: number) {
  const admin = await requireAdmin(req, true);
  if (admin.id === id) return bad("Tidak bisa menghapus akun sendiri", 400);
  await supabase.from("admins").delete().eq("id", id);
  await logAudit("DELETE", "ADMIN", `Menghapus admin: ${id}`, admin, id);
  return empty();
}

async function guestTargets(activeOnly: boolean) {
  let query = supabase.from("guest_book_meeting_targets").select("*").order("name");
  if (activeOnly) query = query.eq("is_active", true);
  const { data } = await query;
  return json({ items: data || [], total: data?.length || 0 });
}

async function guestSubmit(req: Request) {
  const data = await bodyJson(req);
  let meetingTargetName = data.meeting_target_manual || "";
  if (data.meeting_target_id) {
    const { data: target } = await supabase.from("guest_book_meeting_targets").select("name").eq("id", data.meeting_target_id).single();
    meetingTargetName = target?.name || meetingTargetName;
  }
  const { data: created, error } = await supabase
    .from("guest_book_entries")
    .insert({ ...data, meeting_target_name: meetingTargetName })
    .select("*")
    .single();
  if (error) return bad(error.message, 400);
  return json({ message: "Buku tamu berhasil disimpan", id: created.id, ...created }, 201);
}

async function guestList(url: URL) {
  const page = intParam(url, "page", 1);
  const perPage = intParam(url, "per_page", 10);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  let query = supabase.from("guest_book_entries").select("*", { count: "exact" });
  if (url.searchParams.get("start_date")) query = query.gte("visit_date", url.searchParams.get("start_date"));
  if (url.searchParams.get("end_date")) query = query.lte("visit_date", url.searchParams.get("end_date"));
  if (url.searchParams.get("search")) {
    const search = url.searchParams.get("search");
    query = query.or(`name.ilike.%${search}%,institution.ilike.%${search}%`);
  }
  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);
  return json({ items: data || [], total: count || 0, page, per_page: perPage });
}

async function exportGuestBook(req: Request, url: URL) {
  await requireAdmin(req);
  const response = await guestList(url);
  const data = await response.clone().json();
  const rows = [
    ["Nama", "Instansi", "Tujuan Bertemu", "Keperluan", "Tanggal Kunjungan", "Dibuat"],
    ...data.items.map((item) => [
      item.name,
      item.institution,
      item.meeting_target_name,
      item.purpose,
      item.visit_date,
      item.created_at,
    ]),
  ];
  return csvResponse("buku-tamu.csv", rows);
}

async function surveyServiceTypes(includeInactive = false) {
  let query = supabase.from("service_types").select("*").order("name");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data } = await query;
  return data || [];
}

async function surveyQuestions(includeInactive = false) {
  let query = supabase.from("survey_questions").select("*").order("order").order("id");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data } = await query;
  return data || [];
}

async function surveySubmit(req: Request) {
  const data = await bodyJson(req);
  const { data: created, error } = await supabase
    .from("survey_responses")
    .insert({
      service_type_id: data.service_type_id,
      filled_by: data.filled_by,
      responses: data.responses,
      feedback: data.feedback || null,
    })
    .select("*")
    .single();
  if (error) return bad(error.message, 400);
  return json({ message: "Survey berhasil disimpan", id: created.id, ...created }, 201);
}

async function surveyResponses(url: URL) {
  const page = intParam(url, "page", 1);
  const perPage = intParam(url, "per_page", 20);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  let query = supabase.from("survey_responses").select("*, service_types(name)", { count: "exact" });
  if (url.searchParams.get("service_type_id")) query = query.eq("service_type_id", Number(url.searchParams.get("service_type_id")));
  if (url.searchParams.get("start_date")) query = query.gte("submitted_at", `${url.searchParams.get("start_date")}T00:00:00`);
  if (url.searchParams.get("end_date")) query = query.lte("submitted_at", `${url.searchParams.get("end_date")}T23:59:59`);
  const { data, count, error } = await query.order("submitted_at", { ascending: false }).range(from, to);
  if (error) return bad(error.message, 500);
  return json({
    items: (data || []).map((item) => ({
      ...item,
      service_type_name: item.service_types?.name || "",
    })),
    total: count || 0,
    page,
    per_page: perPage,
  });
}

function responseAnswerValue(answer: unknown) {
  if (answer && typeof answer === "object" && "answer" in answer) return String((answer as { answer?: unknown }).answer || "");
  return String(answer || "");
}

async function surveyStats(url: URL) {
  const responses = await surveyResponses(url);
  const data = await responses.clone().json();
  const ratingDistribution: Record<string, number> = {};
  const byService = new Map<number, { service_type_id: number; service_type_name: string; total: number; rating_distribution: Record<string, number> }>();
  const byFilledBy = { sendiri: 0, diwakilkan: 0 };

  for (const item of data.items) {
    byFilledBy[item.filled_by === "diwakilkan" ? "diwakilkan" : "sendiri"] += 1;
    const service = byService.get(item.service_type_id) || {
      service_type_id: item.service_type_id,
      service_type_name: item.service_type_name,
      total: 0,
      rating_distribution: {},
    };
    service.total += 1;

    Object.values(item.responses || {}).forEach((answer) => {
      const value = responseAnswerValue(answer);
      if (!value) return;
      ratingDistribution[value] = (ratingDistribution[value] || 0) + 1;
      service.rating_distribution[value] = (service.rating_distribution[value] || 0) + 1;
    });

    byService.set(item.service_type_id, service);
  }

  return json({
    total_responses: data.total,
    rating_distribution: ratingDistribution,
    by_service_type: [...byService.values()],
    by_filled_by: byFilledBy,
  });
}

async function surveyQuestionStats(url: URL) {
  const responses = await surveyResponses(url);
  const data = await responses.clone().json();
  const questions = await surveyQuestions(true);

  return json({
    total_responses: data.total,
    questions: questions.map((question) => {
      const ratingDistribution: Record<string, number> = {};
      const textResponses: unknown[] = [];
      const complaintResponses: unknown[] = [];

      data.items.forEach((response) => {
        const answer = response.responses?.[question.id] ?? response.responses?.[String(question.id)];
        if (!answer) return;
        if (question.question_type === "rating") {
          const value = responseAnswerValue(answer);
          ratingDistribution[value] = (ratingDistribution[value] || 0) + 1;
          if (typeof answer === "object" && answer.complaint) {
            complaintResponses.push({
              response_id: response.id,
              complaint: answer.complaint,
              rating: value,
              service_type_name: response.service_type_name,
              submitted_at: response.submitted_at,
            });
          }
        } else {
          textResponses.push({
            response_id: response.id,
            answer: responseAnswerValue(answer),
            service_type_name: response.service_type_name,
            submitted_at: response.submitted_at,
          });
        }
      });

      return {
        question_id: question.id,
        question_text: question.question_text,
        question_type: question.question_type,
        response_count: Object.keys(ratingDistribution).reduce((sum, key) => sum + ratingDistribution[key], 0) + textResponses.length,
        rating_distribution: ratingDistribution,
        text_responses: textResponses,
        complaint_responses: complaintResponses,
      };
    }),
  });
}

async function exportSurveyResponses(req: Request, url: URL) {
  await requireAdmin(req);
  const response = await surveyResponses(url);
  const data = await response.clone().json();
  const rows = [
    ["Layanan", "Pengisi", "Feedback", "Tanggal"],
    ...data.items.map((item) => [item.service_type_name, item.filled_by, item.feedback || "", item.submitted_at]),
  ];
  return csvResponse("survey.csv", rows);
}

async function reorderSurveyQuestions(req: Request) {
  const admin = await requireAdmin(req, true);
  const data = await bodyJson(req);
  const ids: number[] = data.question_ids || [];
  for (const [index, id] of ids.entries()) {
    await supabase.from("survey_questions").update({ order: index }).eq("id", id);
  }
  await logAudit("REORDER", "SURVEY_QUESTION", "Mengurutkan pertanyaan survey", admin, undefined, { question_ids: ids });
  return json({ message: "OK" });
}

async function simpleCrud(req: Request, table: string, entity: string, id?: number) {
  if (req.method === "GET") {
    const { data } = await supabase.from(table).select("*").order("id");
    return json({ items: data || [], total: data?.length || 0 });
  }
  if (req.method === "POST") {
    const admin = await requireAdmin(req, true);
    const payload = await bodyJson(req);
    const { data, error } = await supabase.from(table).insert(payload).select("*").single();
    if (error) return bad(error.message, 400);
    await logAudit("CREATE", entity, `Create ${entity}`, admin, data.id, payload);
    return json(data, 201);
  }
  if (req.method === "PATCH" && id) {
    const admin = await requireAdmin(req, true);
    const payload = await bodyJson(req);
    const { data, error } = await supabase.from(table).update(payload).eq("id", id).select("*").single();
    if (error) return bad(error.message, 400);
    await logAudit("UPDATE", entity, `Update ${entity}`, admin, id, payload);
    return json(data);
  }
  if (req.method === "DELETE" && id) {
    const admin = await requireAdmin(req, true);
    await supabase.from(table).delete().eq("id", id);
    await logAudit("DELETE", entity, `Delete ${entity}`, admin, id);
    return empty();
  }
  return bad("Unsupported operation", 405);
}

export async function handleAppRequest(req: Request, allowedPrefixes?: string[], serviceName = "module-api") {
  const url = new URL(req.url);
  const path = stripRoute(url);
  const method = req.method;

  if (method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (path === "/health") return json({ status: "healthy", service: serviceName });

  if (
    allowedPrefixes &&
    !allowedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  ) {
    return bad(`Unsupported path for this module: ${path}`, 404);
  }

  if (path === "/api/v1/auth/login" && method === "POST") {
    const form = await formBody(req);
    const username = form.get("username") || "";
    const password = form.get("password") || "";
    const { data: admin } = await supabase.from("admins").select("*").eq("username", username).single();
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      return bad("Username atau password salah", 401);
    }
    const token = await createToken(admin);
    return json({ access_token: token, token_type: "bearer", role: admin.role });
  }

  if (path === "/api/v1/auth/me" && method === "GET") {
    const admin = await requireAdmin(req);
    return json({ username: admin.username, role: admin.role, name: admin.name });
  }
  if (path === "/api/v1/auth/logout" && method === "POST") return json({ message: "Logout berhasil" });
  if (path === "/api/v1/auth/change-password" && method === "PATCH") {
    const currentAdmin = await requireAdmin(req);
    const data = await bodyJson(req);
    const { data: adminRow } = await supabase.from("admins").select("*").eq("id", currentAdmin.id).single();
    if (!adminRow || !bcrypt.compareSync(data.current_password || "", adminRow.password_hash)) {
      return bad("Password lama salah", 400);
    }
    await supabase.from("admins").update({ password_hash: bcrypt.hashSync(data.new_password || "", 10) }).eq("id", currentAdmin.id);
    return json({ message: "Password berhasil diubah" });
  }
  if (path === "/api/v1/auth/setup" && method === "POST") return bad("Setup awal sudah dilakukan di migration", 400);

  if (path === "/api/v1/public/settings" && method === "GET") return json(await publicSettings());

  if (path === "/api/v1/employees" && method === "GET") return listEmployees(url);
  if (path === "/api/v1/employees" && method === "POST") return createEmployee(req);
  const employeeMatch = path.match(/^\/api\/v1\/employees\/(\d+)$/);
  if (employeeMatch && method === "GET") return getEmployee(Number(employeeMatch[1]));
  if (employeeMatch && method === "PATCH") return updateEmployee(req, Number(employeeMatch[1]));
  if (employeeMatch && method === "DELETE") return deleteEmployee(req, Number(employeeMatch[1]));

  if (path === "/api/v1/attendance/today" && method === "GET") return json(await attendanceToday(false));
  if (path === "/api/v1/attendance/confirm" && method === "POST") return confirmAttendance(req);
  if (path === "/api/v1/admin/attendance" && method === "GET") {
    await requireAdmin(req);
    return listAttendance(url);
  }
  if (path === "/api/v1/admin/attendance/today" && method === "GET") {
    await requireAdmin(req);
    return json(await attendanceToday(true));
  }
  const correctionMatch = path.match(/^\/api\/v1\/admin\/attendance\/(\d+)$/);
  if (correctionMatch && method === "PATCH") return correctAttendance(req, Number(correctionMatch[1]));

  if (path === "/api/v1/admin/reports/monthly" && method === "GET") {
    await requireAdmin(req);
    return monthlyReport(url);
  }
  if (path === "/api/v1/admin/reports/export" && method === "GET") return exportMonthlyReport(req, url);

  if (path === "/api/v1/admin/settings" && method === "GET") {
    await requireAdmin(req);
    return settingsGet();
  }
  if (path === "/api/v1/admin/settings" && method === "PATCH") return settingsUpdate(req);
  if (path === "/api/v1/admin/settings/logo" && method === "POST") return uploadSettingAsset(req, "logo_url", "logos");
  if (path === "/api/v1/admin/settings/logo" && method === "DELETE") return deleteSettingAsset(req, "logo_url");
  if (path === "/api/v1/admin/settings/background" && method === "POST") return uploadSettingAsset(req, "background_url", "backgrounds");
  if (path === "/api/v1/admin/settings/background" && method === "DELETE") return deleteSettingAsset(req, "background_url");
  if (path === "/api/v1/admin/settings/holidays" && method === "GET") return holidays(url);
  if (path === "/api/v1/admin/settings/holidays/excluded" && method === "GET") return holidays(url, true);
  if (path === "/api/v1/admin/settings/holidays" && method === "POST") return createHoliday(req);
  const holidayMatch = path.match(/^\/api\/v1\/admin\/settings\/holidays\/(\d+)$/);
  if (holidayMatch && method === "DELETE") return deleteHoliday(req, Number(holidayMatch[1]));
  const holidayRestoreMatch = path.match(/^\/api\/v1\/admin\/settings\/holidays\/(\d+)\/restore$/);
  if (holidayRestoreMatch && method === "POST") return restoreHoliday(req, Number(holidayRestoreMatch[1]));
  if (path === "/api/v1/admin/settings/holidays/sync" && method === "POST") {
    return syncHolidays(req, url);
  }
  if (path === "/api/v1/admin/settings/schedules" && method === "GET") return schedulesList();
  if (path === "/api/v1/admin/settings/schedules" && method === "PATCH") return schedulesUpdate(req);

  if (path === "/api/v1/admin/audit-logs" && method === "GET") {
    await requireAdmin(req);
    return listAuditLogs(url);
  }
  if (path === "/api/v1/admin/admins" && method === "GET") {
    await requireAdmin(req);
    return listAdmins();
  }
  if (path === "/api/v1/admin/admins" && method === "POST") return createAdmin(req);
  const adminMatch = path.match(/^\/api\/v1\/admin\/admins\/(\d+)$/);
  if (adminMatch && method === "PATCH") return updateAdmin(req, Number(adminMatch[1]));
  if (adminMatch && method === "DELETE") return deleteAdmin(req, Number(adminMatch[1]));

  if (path === "/api/v1/guestbook/meeting-targets" && method === "GET") return guestTargets(true);
  if (path === "/api/v1/guestbook" && method === "POST") return guestSubmit(req);
  if (path === "/api/v1/admin/guest-book" && method === "GET") {
    await requireAdmin(req);
    return guestList(url);
  }
  if (path === "/api/v1/admin/guest-book/meeting-targets") return simpleCrud(req, "guest_book_meeting_targets", "GUESTBOOK");
  const targetMatch = path.match(/^\/api\/v1\/admin\/guest-book\/meeting-targets\/(\d+)$/);
  if (targetMatch) return simpleCrud(req, "guest_book_meeting_targets", "GUESTBOOK", Number(targetMatch[1]));
  const guestMatch = path.match(/^\/api\/v1\/admin\/guest-book\/(\d+)$/);
  if (guestMatch && method === "DELETE") return simpleCrud(req, "guest_book_entries", "GUESTBOOK", Number(guestMatch[1]));
  if (path === "/api/v1/admin/guest-book/export") return exportGuestBook(req, url);

  if (path === "/api/v1/survey/service-types" && method === "GET") return json(await surveyServiceTypes(false));
  if (path === "/api/v1/survey/questions" && method === "GET") return json(await surveyQuestions(false));
  if (path === "/api/v1/survey" && method === "POST") return surveySubmit(req);
  if (path === "/api/v1/admin/survey/service-types") {
    if (method === "GET") return json({ items: await surveyServiceTypes(parseBool(url.searchParams.get("include_inactive")) || false), total: (await surveyServiceTypes(true)).length });
    return simpleCrud(req, "service_types", "SERVICE_TYPE");
  }
  const serviceTypeMatch = path.match(/^\/api\/v1\/admin\/survey\/service-types\/(\d+)$/);
  if (serviceTypeMatch) return simpleCrud(req, "service_types", "SERVICE_TYPE", Number(serviceTypeMatch[1]));
  if (path === "/api/v1/admin/survey/questions") {
    if (method === "GET") return json({ items: await surveyQuestions(parseBool(url.searchParams.get("include_inactive")) || false), total: (await surveyQuestions(true)).length });
    return simpleCrud(req, "survey_questions", "SURVEY_QUESTION");
  }
  const questionMatch = path.match(/^\/api\/v1\/admin\/survey\/questions\/(\d+)$/);
  if (questionMatch) return simpleCrud(req, "survey_questions", "SURVEY_QUESTION", Number(questionMatch[1]));
  if (path === "/api/v1/admin/survey/questions/reorder" && method === "POST") return reorderSurveyQuestions(req);
  if (path === "/api/v1/admin/survey/responses" && method === "GET") {
    await requireAdmin(req);
    return surveyResponses(url);
  }
  if (path === "/api/v1/admin/survey/stats" && method === "GET") {
    await requireAdmin(req);
    return surveyStats(url);
  }
  if (path === "/api/v1/admin/survey/stats/questions" && method === "GET") {
    await requireAdmin(req);
    return surveyQuestionStats(url);
  }
  if (path === "/api/v1/admin/survey/export") return exportSurveyResponses(req, url);

  return bad(`Unsupported path: ${path}`, 404);
}

export async function handleAppRequestWithErrors(req: Request, allowedPrefixes?: string[], serviceName = "module-api") {
  try {
    return await handleAppRequest(req, allowedPrefixes, serviceName);
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ detail: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
}
