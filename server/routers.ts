import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

// 管理者セッション用のシンプルなトークン管理
const adminSessions = new Map<string, { expiresAt: number }>();

function generateAdminToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function isValidAdminSession(token: string): boolean {
  const session = adminSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

// 日本時間 (JST) 関連のユーティリティ
const JST_OFFSET = 9 * 60 * 60 * 1000;

function getJSTDate(): Date {
  return new Date(Date.now() + JST_OFFSET);
}

function getTodayJST(): string {
  return getJSTDate().toISOString().split('T')[0];
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // 従業員関連API
  employee: router({
    login: publicProcedure
      .input(z.object({ 
        employeeNumber: z.string().min(1),
        password: z.string().min(1)
      }))
      .mutation(async ({ input }) => {
        await db.initializeEmployees();
        const employee = await db.authenticateEmployee(input.employeeNumber, input.password);
        if (!employee) {
          throw new Error("従業員番号またはパスワードが正しくありません");
        }
        return employee;
      }),

    getByName: publicProcedure
      .input(z.object({ name: z.string() }))
      .query(async ({ input }) => {
        return db.getEmployeeByName(input.name);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getEmployeeById(input.id);
      }),

    getAll: publicProcedure.query(async () => {
      return db.getAllEmployees();
    }),
  }),

  // 勤怠関連API
  attendance: router({
    // 今日の勤怠状況を取得
    getTodayStatus: publicProcedure
      .input(z.object({ employeeId: z.number() }))
      .query(async ({ input }) => {
        const today = getTodayJST();
        const record = await db.getAttendanceByEmployeeAndDate(input.employeeId, today);
        
        if (!record) {
          return { status: 'not_clocked_in' as const, record: null, breaks: [], activeBreak: null };
        }

        const breaks = await db.getBreaksByAttendanceId(record.id);
        const activeBreak = await db.getActiveBreak(record.id);

        if (record.clockOutTime) {
          return { status: 'clocked_out' as const, record, breaks, activeBreak: null };
        }
        
        if (activeBreak) {
          return { status: 'on_break' as const, record, breaks, activeBreak };
        }

        return { status: 'working' as const, record, breaks, activeBreak: null };
      }),

    // 出勤打刻
    clockIn: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        isLate: z.boolean().default(false),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const today = getTodayJST();
        
        const existing = await db.getAttendanceByEmployeeAndDate(input.employeeId, today);
        if (existing) {
          throw new Error("既に出勤打刻済みです");
        }

        const record = await db.createAttendanceRecord({
          employeeId: input.employeeId,
          date: today,
          clockInTime: new Date(),
          clockInLatitude: input.latitude?.toString(),
          clockInLongitude: input.longitude?.toString(),
          isLate: input.isLate,
        });

        return { record };
      }),

    // 退勤打刻
    clockOut: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        reflection: z.string().optional(),
        isEarlyLeave: z.boolean().default(false),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const today = getTodayJST();
        const record = await db.getAttendanceByEmployeeAndDate(input.employeeId, today);
        
        if (!record) {
          throw new Error("出勤打刻がありません");
        }
        if (record.clockOutTime) {
          throw new Error("既に退勤打刻済みです");
        }

        const activeBreak = await db.getActiveBreak(record.id);
        if (activeBreak) {
          await db.updateBreak(activeBreak.id, { endTime: new Date() });
        }

        await db.updateAttendanceRecord(record.id, {
          clockOutTime: new Date(),
          clockOutLatitude: input.latitude?.toString(),
          clockOutLongitude: input.longitude?.toString(),
          reflection: input.reflection,
          isEarlyLeave: input.isEarlyLeave,
        });

        const updatedRecord = await db.getAttendanceById(record.id);
        return { record: updatedRecord };
      }),

    // 中抜け開始
    startBreak: publicProcedure
      .input(z.object({ employeeId: z.number() }))
      .mutation(async ({ input }) => {
        const today = getTodayJST();
        const record = await db.getAttendanceByEmployeeAndDate(input.employeeId, today);
        
        if (!record) {
          throw new Error("出勤打刻がありません");
        }
        if (record.clockOutTime) {
          throw new Error("既に退勤済みです");
        }

        const activeBreak = await db.getActiveBreak(record.id);
        if (activeBreak) {
          throw new Error("既に中抜け中です");
        }

        const breakRecord = await db.createBreak({
          attendanceId: record.id,
          startTime: new Date(),
        });

        return breakRecord;
      }),

    // 中抜け終了
    endBreak: publicProcedure
      .input(z.object({ employeeId: z.number() }))
      .mutation(async ({ input }) => {
        const today = getTodayJST();
        const record = await db.getAttendanceByEmployeeAndDate(input.employeeId, today);
        
        if (!record) {
          throw new Error("出勤打刻がありません");
        }

        const activeBreak = await db.getActiveBreak(record.id);
        if (!activeBreak) {
          throw new Error("中抜け中ではありません");
        }

        await db.updateBreak(activeBreak.id, { endTime: new Date() });
     
        const updatedBreaks = await db.getBreaksByAttendanceId(record.id);
        return updatedBreaks;
      }),

    // 月別履歴取得
    getMonthlyHistory: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        yearMonth: z.string(),
      }))
      .query(async ({ input }) => {
        const records = await db.getAttendanceByEmployeeAndMonth(input.employeeId, input.yearMonth);
        const result = await Promise.all(records.map(async (record) => {
          const breaks = await db.getBreaksByAttendanceId(record.id);
          return { ...record, breaks };
        }));
        return result;
      }),
  }),

  // 管理者関連API
  admin: router({
    login: publicProcedure
      .input(z.object({ password: z.string() }))
      .mutation(async ({ input }) => {
        await db.initializeAdminPassword();
        const storedPassword = await db.getAdminSetting("admin_password");
        if (input.password !== storedPassword) {
          throw new Error("パスワードが正しくありません");
        }
        const token = generateAdminToken();
        adminSessions.set(token, { expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
        return { token };
      }),

    verifySession: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(({ input }) => {
        return { valid: isValidAdminSession(input.token) };
      }),

    logout: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(({ input }) => {
        adminSessions.delete(input.token);
        return { success: true };
      }),

    getAttendanceByDate: publicProcedure
      .input(z.object({ 
        token: z.string(),
        date: z.string() 
      }))
      .query(async ({ input }) => {
        if (!isValidAdminSession(input.token)) {
          throw new Error("認証が必要です");
        }
        const records = await db.getAllAttendanceByDate(input.date);
        const result = await Promise.all(records.map(async (record) => {
          const breaks = await db.getBreaksByAttendanceId(record.id);
          return { ...record, breaks };
        }));
        return result;
      }),

    getAttendanceByDateRange: publicProcedure
      .input(z.object({
        token: z.string(),
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        if (!isValidAdminSession(input.token)) {
          throw new Error("認証が必要です");
        }
        const records = await db.getAllAttendanceByDateRange(input.startDate, input.endDate);
        const result = await Promise.all(records.map(async (record) => {
          const breaks = await db.getBreaksByAttendanceId(record.id);
          return { ...record, breaks };
        }));
        return result;
      }),

    updateAttendance: publicProcedure
      .input(z.object({
        token: z.string(),
        attendanceId: z.number(),
        clockInTime: z.string().optional(),
        clockOutTime: z.string().optional(),
        isLate: z.boolean().optional(),
        isEarlyLeave: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        if (!isValidAdminSession(input.token)) {
          throw new Error("認証が必要です");
        }
        const updateData: Record<string, unknown> = {};
        if (input.clockInTime) updateData.clockInTime = new Date(input.clockInTime);
        if (input.clockOutTime) updateData.clockOutTime = new Date(input.clockOutTime);
        if (input.isLate !== undefined) updateData.isLate = input.isLate;
        if (input.isEarlyLeave !== undefined) updateData.isEarlyLeave = input.isEarlyLeave;
        await db.updateAttendanceRecord(input.attendanceId, updateData);
        return { success: true };
      }),

    changePassword: publicProcedure
      .input(z.object({
        token: z.string(),
        currentPassword: z.string(),
        newPassword: z.string().min(6),
      }))
      .mutation(async ({ input }) => {
        if (!isValidAdminSession(input.token)) {
          throw new Error("認証が必要です");
        }
        const storedPassword = await db.getAdminSetting("admin_password");
        if (input.currentPassword !== storedPassword) {
          throw new Error("現在のパスワードが正しくありません");
        }
        await db.setAdminSetting("admin_password", input.newPassword);
        return { success: true };
      }),

    getAllEmployees: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        if (!isValidAdminSession(input.token)) {
          throw new Error("認証が必要です");
        }
        return db.getAllEmployees();
      }),

    exportToSpreadsheet: publicProcedure
      .input(z.object({
        token: z.string(),
        yearMonth: z.string(),
      }))
      .mutation(async ({ input }) => {
        if (!isValidAdminSession(input.token)) {
          throw new Error("認証が必要です");
        }
        const [year, month] = input.yearMonth.split('-').map(Number);
        const startDate = `${input.yearMonth}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${input.yearMonth}-${lastDay.toString().padStart(2, '0')}`;

        const records = await db.getAllAttendanceByDateRange(startDate, endDate);
        const exportRecords = await Promise.all(records.map(async (record) => {
          const breaks = await db.getBreaksByAttendanceId(record.id);
          const employee = await db.getEmployeeById(record.employeeId);
          
          let workDuration = 0;
          if (record.clockInTime && record.clockOutTime) {
            const clockIn = new Date(record.clockInTime).getTime();
            const clockOut = new Date(record.clockOutTime).getTime();
            workDuration = Math.round((clockOut - clockIn) / 60000);
          }

          let totalBreakMinutes = 0;
          for (const breakRecord of breaks) {
            if (breakRecord.startTime && breakRecord.endTime) {
              const start = new Date(breakRecord.startTime).getTime();
              const end = new Date(breakRecord.endTime).getTime();
              totalBreakMinutes += Math.round((end - start) / 60000);
            }
          }

          const clockInLocation = record.clockInLatitude && record.clockInLongitude
            ? `${record.clockInLatitude},${record.clockInLongitude}`
            : '';
          const clockOutLocation = record.clockOutLatitude && record.clockOutLongitude
            ? `${record.clockOutLatitude},${record.clockOutLongitude}`
            : '';

          return {
            date: record.date,
            employeeName: employee?.name || '',
            clockIn: record.clockInTime?.toISOString(),
            clockOut: record.clockOutTime?.toISOString(),
            workDuration: workDuration > 0 ? workDuration - totalBreakMinutes : 0,
            isLate: record.isLate,
            isEarlyLeave: record.isEarlyLeave,
            goal: record.todayGoal || '',
            reflection: record.reflection || '',
            clockInLocation,
            clockOutLocation,
            totalBreakMinutes,
          };
        }));

        const GAS_URL = 'https://script.google.com/macros/s/AKfycbxSX21uVt2yn0bvxekOmoCsRFiC_vEhIW-sX-hAODoIjC8NF-j0PRwfDoGKp-U6K1wnAQ/exec';
        
        const response = await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: exportRecords }),
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'スプレッドシートへの出力に失敗しました');
        }
        return { success: true, count: exportRecords.length };
      }),
  }),
});

export type AppRouter = typeof appRouter;
