import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 従業員テーブル - 従業員番号とパスワードで認証
 */
export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  employeeNumber: varchar("employeeNumber", { length: 20 }).notNull().unique(),
  password: varchar("password", { length: 100 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;

/**
 * 勤怠記録テーブル
 */
export const attendanceRecords = mysqlTable("attendance_records", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD形式
  
  // 出勤情報
  clockInTime: timestamp("clockInTime"),
  clockInLatitude: decimal("clockInLatitude", { precision: 10, scale: 7 }),
  clockInLongitude: decimal("clockInLongitude", { precision: 10, scale: 7 }),
  todayGoal: text("todayGoal"),
  isLate: boolean("isLate").default(false),
  
  // 退勤情報
  clockOutTime: timestamp("clockOutTime"),
  clockOutLatitude: decimal("clockOutLatitude", { precision: 10, scale: 7 }),
  clockOutLongitude: decimal("clockOutLongitude", { precision: 10, scale: 7 }),
  reflection: text("reflection"),
  isEarlyLeave: boolean("isEarlyLeave").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = typeof attendanceRecords.$inferInsert;

/**
 * タスクテーブル - 出勤時に登録、退勤時に完了チェック
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  attendanceId: int("attendanceId").notNull(),
  content: text("content").notNull(),
  isCompleted: boolean("isCompleted").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * 中抜けテーブル
 */
export const breaks = mysqlTable("breaks", {
  id: int("id").autoincrement().primaryKey(),
  attendanceId: int("attendanceId").notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Break = typeof breaks.$inferSelect;
export type InsertBreak = typeof breaks.$inferInsert;

/**
 * 管理者設定テーブル
 */
export const adminSettings = mysqlTable("admin_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 50 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdminSetting = typeof adminSettings.$inferSelect;
export type InsertAdminSetting = typeof adminSettings.$inferInsert;

/**
 * チームタスクテーブル - 管理者が設定する週間/月間タスク
 */
export const teamTasks = mysqlTable("team_tasks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  taskType: mysqlEnum("taskType", ["weekly", "monthly"]).notNull(),
  // 週間タスクの場合: YYYY-Www形式（例: 2026-W04）
  // 月間タスクの場合: YYYY-MM形式（例: 2026-01）
  period: varchar("period", { length: 10 }).notNull(),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TeamTask = typeof teamTasks.$inferSelect;
export type InsertTeamTask = typeof teamTasks.$inferInsert;
