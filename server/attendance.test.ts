import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  getEmployeeByName: vi.fn(),
  getEmployeeByNumber: vi.fn(),
  authenticateEmployee: vi.fn(),
  initializeEmployees: vi.fn(),
  createEmployee: vi.fn(),
  getAllEmployees: vi.fn(),
  getAttendanceByEmployeeAndDate: vi.fn(),
  createAttendanceRecord: vi.fn(),
  updateAttendanceRecord: vi.fn(),
  createTask: vi.fn(),
  getTasksByAttendanceId: vi.fn(),
  updateTask: vi.fn(),
  getBreaksByAttendanceId: vi.fn(),
  getActiveBreak: vi.fn(),
  createBreak: vi.fn(),
  updateBreak: vi.fn(),
  getAttendanceByEmployeeAndMonth: vi.fn(),
  getAdminSetting: vi.fn(),
  setAdminSetting: vi.fn(),
  initializeAdminPassword: vi.fn(),
  getAllAttendanceByDate: vi.fn(),
  getAttendanceById: vi.fn(),
}));

import * as db from "./db";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("employee router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs in with correct credentials", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.initializeEmployees).mockResolvedValue();
    vi.mocked(db.authenticateEmployee).mockResolvedValue({
      id: 1,
      employeeNumber: "001",
      password: "y820",
      name: "百瀠友奈",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await caller.employee.login({ employeeNumber: "001", password: "y820" });

    expect(result).toEqual(
      expect.objectContaining({
        id: 1,
        name: "百瀠友奈",
      })
    );
  });

  it("throws error with incorrect credentials", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.initializeEmployees).mockResolvedValue();
    vi.mocked(db.authenticateEmployee).mockResolvedValue(null);

    await expect(
      caller.employee.login({ employeeNumber: "001", password: "wrong" })
    ).rejects.toThrow("従業員番号またはパスワードが正しくありません");
  });
});

describe("attendance router", () => {
  it("returns not_clocked_in status when no record exists", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.getAttendanceByEmployeeAndDate).mockResolvedValue(undefined);

    const result = await caller.attendance.getTodayStatus({ employeeId: 1 });

    expect(result.status).toBe("not_clocked_in");
    expect(result.record).toBeNull();
  });

  it("clocks in successfully", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.getAttendanceByEmployeeAndDate).mockResolvedValue(undefined);
    vi.mocked(db.createAttendanceRecord).mockResolvedValue({
      id: 1,
      employeeId: 1,
      date: "2026-01-21",
      clockInTime: new Date(),
      clockInLatitude: "35.6762",
      clockInLongitude: "139.6503",
      clockOutTime: null,
      clockOutLatitude: null,
      clockOutLongitude: null,
      todayGoal: "テスト目標",
      reflection: null,
      isLate: false,
      isEarlyLeave: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.createTask).mockResolvedValue({
      id: 1,
      attendanceId: 1,
      content: "タスク1",
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.getTasksByAttendanceId).mockResolvedValue([
      {
        id: 1,
        attendanceId: 1,
        content: "タスク1",
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await caller.attendance.clockIn({
      employeeId: 1,
      todayGoal: "テスト目標",
      tasks: ["タスク1"],
      isLate: false,
      latitude: 35.6762,
      longitude: 139.6503,
    });

    expect(result.record).toBeDefined();
    expect(result.tasks).toHaveLength(1);
  });

  it("throws error when already clocked in", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.getAttendanceByEmployeeAndDate).mockResolvedValue({
      id: 1,
      employeeId: 1,
      date: "2026-01-21",
      clockInTime: new Date(),
      clockInLatitude: null,
      clockInLongitude: null,
      clockOutTime: null,
      clockOutLatitude: null,
      clockOutLongitude: null,
      todayGoal: null,
      reflection: null,
      isLate: false,
      isEarlyLeave: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      caller.attendance.clockIn({
        employeeId: 1,
        tasks: [],
      })
    ).rejects.toThrow("既に出勤打刻済みです");
  });
});

describe("admin router", () => {
  it("logs in with correct password", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.initializeAdminPassword).mockResolvedValue();
    vi.mocked(db.getAdminSetting).mockResolvedValue("admin123");

    const result = await caller.admin.login({ password: "admin123" });

    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe("string");
  });

  it("throws error with incorrect password", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.initializeAdminPassword).mockResolvedValue();
    vi.mocked(db.getAdminSetting).mockResolvedValue("admin123");

    await expect(
      caller.admin.login({ password: "wrongpassword" })
    ).rejects.toThrow("パスワードが正しくありません");
  });
});
