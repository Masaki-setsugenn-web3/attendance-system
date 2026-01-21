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
    // 従業員ログイン（従業員番号+パスワード）
    login: publicProcedure
      .input(z.object({ 
        employeeNumber: z.string().min(1),
        password: z.string().min(1)
      }))
      .mutation(async ({ input }) => {
        // 初期従業員データを登録
        await db.initializeEmployees();
        
        const employee = await db.authenticateEmployee(input.employeeNumber, input.password);
        if (!employee) {
          throw new Error("従業員番号またはパスワードが正しくありません");
        }
        return employee;
      }),

    // 従業員名で取得
    getByName: publicProcedure
      .input(z.object({ name: z.string() }))
      .query(async ({ input }) => {
        return db.getEmployeeByName(input.name);
      }),

    // IDで取得
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getEmployeeById(input.id);
      }),

    // 全従業員取得
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
        const today = new Date().toISOString().split('T')[0];
        const record = await db.getAttendanceByEmployeeAndDate(input.employeeId, today);
        
        if (!record) {
          return { status: 'not_clocked_in' as const, record: null, tasks: [], breaks: [], activeBreak: null };
        }

        const tasks = await db.getTasksByAttendanceId(record.id);
        const breaks = await db.getBreaksByAttendanceId(record.id);
        const activeBreak = await db.getActiveBreak(record.id);

        if (record.clockOutTime) {
          return { status: 'clocked_out' as const, record, tasks, breaks, activeBreak: null };
        }
        
        if (activeBreak) {
          return { status: 'on_break' as const, record, tasks, breaks, activeBreak };
        }

        return { status: 'working' as const, record, tasks, breaks, activeBreak: null };
      }),

    // 出勤打刻
    clockIn: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        todayGoal: z.string().optional(),
        tasks: z.array(z.string()),
        isLate: z.boolean().default(false),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const today = new Date().toISOString().split('T')[0];
        
        // 既存の記録をチェック
        const existing = await db.getAttendanceByEmployeeAndDate(input.employeeId, today);
        if (existing) {
          throw new Error("既に出勤打刻済みです");
        }

        // 勤怠記録を作成
        const record = await db.createAttendanceRecord({
          employeeId: input.employeeId,
          date: today,
          clockInTime: new Date(),
          clockInLatitude: input.latitude?.toString(),
          clockInLongitude: input.longitude?.toString(),
          todayGoal: input.todayGoal,
          isLate: input.isLate,
        });

        // タスクを作成
        for (const taskContent of input.tasks) {
          if (taskContent.trim()) {
            await db.createTask({
              attendanceId: record.id,
              content: taskContent.trim(),
              isCompleted: false,
            });
          }
        }

        const tasks = await db.getTasksByAttendanceId(record.id);
        return { record, tasks };
      }),

    // 退勤打刻
    clockOut: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        reflection: z.string().optional(),
        isEarlyLeave: z.boolean().default(false),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        completedTaskIds: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        const today = new Date().toISOString().split('T')[0];
        const record = await db.getAttendanceByEmployeeAndDate(input.employeeId, today);
        
        if (!record) {
          throw new Error("出勤打刻がありません");
        }
        if (record.clockOutTime) {
          throw new Error("既に退勤打刻済みです");
        }

        // アクティブな中抜けがあれば終了
        const activeBreak = await db.getActiveBreak(record.id);
        if (activeBreak) {
          await db.updateBreak(activeBreak.id, { endTime: new Date() });
        }

        // 勤怠記録を更新
        await db.updateAttendanceRecord(record.id, {
          clockOutTime: new Date(),
          clockOutLatitude: input.latitude?.toString(),
          clockOutLongitude: input.longitude?.toString(),
          reflection: input.reflection,
          isEarlyLeave: input.isEarlyLeave,
        });

        // タスク完了状態を更新
        for (const taskId of input.completedTaskIds) {
          await db.updateTask(taskId, { isCompleted: true });
        }

        const updatedRecord = await db.getAttendanceById(record.id);
        const tasks = await db.getTasksByAttendanceId(record.id);
        return { record: updatedRecord, tasks };
      }),

    // 中抜け開始
    startBreak: publicProcedure
      .input(z.object({ employeeId: z.number() }))
      .mutation(async ({ input }) => {
        const today = new Date().toISOString().split('T')[0];
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
        const today = new Date().toISOString().split('T')[0];
        const record = await db.getAttendanceByEmployeeAndDate(input.employeeId, today);
        
        if (!record) {
          throw new Error("出勤打刻がありません");
        }

        const activeBreak = await db.getActiveBreak(record.id);
        if (!activeBreak) {
          throw new Error("中抜け中ではありません");
        }

        await db.updateBreak(activeBreak.id, { endTime: new Date() });
        
        const updatedBreak = await db.getBreaksByAttendanceId(record.id);
        return updatedBreak;
      }),

    // 月別履歴取得
    getMonthlyHistory: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        yearMonth: z.string(), // YYYY-MM形式
      }))
      .query(async ({ input }) => {
        const records = await db.getAttendanceByEmployeeAndMonth(input.employeeId, input.yearMonth);
        
        const result = await Promise.all(records.map(async (record) => {
          const tasks = await db.getTasksByAttendanceId(record.id);
          const breaks = await db.getBreaksByAttendanceId(record.id);
          return { ...record, tasks, breaks };
        }));

        return result;
      }),
  }),

  // 管理者関連API
  admin: router({
    // 管理者ログイン
    login: publicProcedure
      .input(z.object({ password: z.string() }))
      .mutation(async ({ input }) => {
        // 初期パスワードを設定
        await db.initializeAdminPassword();
        
        const storedPassword = await db.getAdminSetting("admin_password");
        if (input.password !== storedPassword) {
          throw new Error("パスワードが正しくありません");
        }

        const token = generateAdminToken();
        adminSessions.set(token, { expiresAt: Date.now() + 24 * 60 * 60 * 1000 }); // 24時間有効

        return { token };
      }),

    // セッション検証
    verifySession: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(({ input }) => {
        return { valid: isValidAdminSession(input.token) };
      }),

    // ログアウト
    logout: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(({ input }) => {
        adminSessions.delete(input.token);
        return { success: true };
      }),

    // 日付別の全勤怠取得
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
          const tasks = await db.getTasksByAttendanceId(record.id);
          const breaks = await db.getBreaksByAttendanceId(record.id);
          return { ...record, tasks, breaks };
        }));

        return result;
      }),

    // 日付範囲の全勤怠取得
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
          const tasks = await db.getTasksByAttendanceId(record.id);
          const breaks = await db.getBreaksByAttendanceId(record.id);
          return { ...record, tasks, breaks };
        }));

        return result;
      }),

    // 打刻修正
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

    // パスワード変更
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

    // 全従業員取得
    getAllEmployees: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        if (!isValidAdminSession(input.token)) {
          throw new Error("認証が必要です");
        }
        return db.getAllEmployees();
      }),
  }),
});

export type AppRouter = typeof appRouter;
