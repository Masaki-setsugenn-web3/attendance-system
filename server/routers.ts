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

    // Googleスプレッドシートに出力
    exportToSpreadsheet: publicProcedure
      .input(z.object({
        token: z.string(),
        yearMonth: z.string(), // YYYY-MM形式
      }))
      .mutation(async ({ input }) => {
        if (!isValidAdminSession(input.token)) {
          throw new Error("認証が必要です");
        }

        // 指定月の開始日と終了日を計算
        const [year, month] = input.yearMonth.split('-').map(Number);
        const startDate = `${input.yearMonth}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${input.yearMonth}-${lastDay.toString().padStart(2, '0')}`;

        // 勤怠データを取得
        const records = await db.getAllAttendanceByDateRange(startDate, endDate);
        
        // GASに送信するデータを整形
        const exportRecords = await Promise.all(records.map(async (record) => {
          const tasks = await db.getTasksByAttendanceId(record.id);
          const breaks = await db.getBreaksByAttendanceId(record.id);
          const employee = await db.getEmployeeById(record.employeeId);
          
          // 勤務時間を計算（分）
          let workDuration = 0;
          if (record.clockInTime && record.clockOutTime) {
            const clockIn = new Date(record.clockInTime).getTime();
            const clockOut = new Date(record.clockOutTime).getTime();
            workDuration = Math.round((clockOut - clockIn) / 60000);
          }

          // 中抜け時間を計算（分）
          let totalBreakMinutes = 0;
          for (const breakRecord of breaks) {
            if (breakRecord.startTime && breakRecord.endTime) {
              const start = new Date(breakRecord.startTime).getTime();
              const end = new Date(breakRecord.endTime).getTime();
              totalBreakMinutes += Math.round((end - start) / 60000);
            }
          }

          // 位置情報をフォーマット
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
            tasks: tasks.map(t => ({ text: t.content, completed: t.isCompleted })),
            reflection: record.reflection || '',
            clockInLocation,
            clockOutLocation,
            totalBreakMinutes,
          };
        }));

        // GASにデータを送信
        const GAS_URL = 'https://script.google.com/macros/s/AKfycbxSX21uVt2yn0bvxekOmoCsRFiC_vEhIW-sX-hAODoIjC8NF-j0PRwfDoGKp-U6K1wnAQ/exec';
        
        const response = await fetch(GAS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ records: exportRecords }),
        });

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'スプレッドシートへの出力に失敗しました');
        }

        return { success: true, count: exportRecords.length };
      }),
  }),

  // チームタスク関連API
  teamTask: router({
    // チームタスク作成（管理者のみ）
    create: publicProcedure
      .input(z.object({
        token: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        taskType: z.enum(["weekly", "monthly"]),
        period: z.string(),
      }))
      .mutation(async ({ input }) => {
        if (!isValidAdminSession(input.token)) {
          throw new Error("認証が必要です");
        }
        
        return db.createTeamTask({
          title: input.title,
          description: input.description,
          taskType: input.taskType,
          period: input.period,
          isActive: true,
        });
      }),

    // チームタスク更新（管理者のみ）
    update: publicProcedure
      .input(z.object({
        token: z.string(),
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        if (!isValidAdminSession(input.token)) {
          throw new Error("認証が必要です");
        }
        
        const updateData: Record<string, unknown> = {};
        if (input.title !== undefined) updateData.title = input.title;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;
        
        await db.updateTeamTask(input.id, updateData);
        return { success: true };
      }),

    // チームタスク削除（管理者のみ）
    delete: publicProcedure
      .input(z.object({
        token: z.string(),
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        if (!isValidAdminSession(input.token)) {
          throw new Error("認証が必要です");
        }
        
        await db.deleteTeamTask(input.id);
        return { success: true };
      }),

    // 全チームタスク取得（管理者用）
    getAll: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        if (!isValidAdminSession(input.token)) {
          throw new Error("認証が必要です");
        }
        return db.getAllTeamTasks();
      }),

    // アクティブなチームタスク取得（従業員用 - 認証不要）
    getActive: publicProcedure.query(async () => {
      return db.getActiveTeamTasks();
    }),

    // 期間別チームタスク取得（従業員用 - 認証不要）
    getByPeriod: publicProcedure
      .input(z.object({
        taskType: z.enum(["weekly", "monthly"]),
        period: z.string(),
      }))
      .query(async ({ input }) => {
        return db.getTeamTasksByPeriod(input.taskType, input.period);
      }),

    // 現在の週と月のチームタスクを取得（従業員用 - 認証不要）
    getCurrent: publicProcedure.query(async () => {
      const now = new Date();
      
      // 現在の月を取得 (YYYY-MM)
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // 現在の週番号を取得 (YYYY-Www)
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      const currentWeek = `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
      
      const weeklyTasks = await db.getTeamTasksByPeriod("weekly", currentWeek);
      const monthlyTasks = await db.getTeamTasksByPeriod("monthly", currentMonth);
      
      return {
        currentWeek,
        currentMonth,
        weeklyTasks,
        monthlyTasks,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
