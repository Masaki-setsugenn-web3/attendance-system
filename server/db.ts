import { eq, and, desc, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  employees, InsertEmployee, Employee,
  attendanceRecords, InsertAttendanceRecord, AttendanceRecord,
  tasks, InsertTask, Task,
  breaks, InsertBreak, Break,
  adminSettings, InsertAdminSetting,
  teamTasks, InsertTeamTask, TeamTask,
  staffTasks, InsertStaffTask, StaffTask
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ========== User Functions ==========
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ========== Employee Functions ==========
export async function createEmployee(data: InsertEmployee): Promise<Employee> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(employees).values(data);
  const insertId = result[0].insertId;
  const [employee] = await db.select().from(employees).where(eq(employees.id, insertId));
  return employee;
}

export async function getEmployeeByName(name: string): Promise<Employee | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(employees).where(eq(employees.name, name)).limit(1);
  return result[0];
}

export async function getEmployeeByNumber(employeeNumber: string): Promise<Employee | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(employees).where(eq(employees.employeeNumber, employeeNumber)).limit(1);
  return result[0];
}

export async function authenticateEmployee(employeeNumber: string, password: string): Promise<Employee | null> {
  const employee = await getEmployeeByNumber(employeeNumber);
  if (!employee) return null;
  if (employee.password !== password) return null;
  return employee;
}

export async function initializeEmployees(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const initialEmployees = [
    { employeeNumber: "001", password: "y820", name: "百瀠友奈" },
    { employeeNumber: "002", password: "m110", name: "中井真樹" },
    { employeeNumber: "A-003", password: "m212", name: "高橋美月" },
  ];
  
  for (const emp of initialEmployees) {
    const existing = await getEmployeeByNumber(emp.employeeNumber);
    if (!existing) {
      await db.insert(employees).values(emp);
    }
  }
}

export async function getEmployeeById(id: number): Promise<Employee | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  return result[0];
}

export async function getAllEmployees(): Promise<Employee[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(employees).orderBy(employees.name);
}

// ========== Attendance Functions ==========
export async function createAttendanceRecord(data: InsertAttendanceRecord): Promise<AttendanceRecord> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(attendanceRecords).values(data);
  const insertId = result[0].insertId;
  const [record] = await db.select().from(attendanceRecords).where(eq(attendanceRecords.id, insertId));
  return record;
}

export async function getAttendanceByEmployeeAndDate(employeeId: number, date: string): Promise<AttendanceRecord | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select()
    .from(attendanceRecords)
    .where(and(
      eq(attendanceRecords.employeeId, employeeId),
      eq(attendanceRecords.date, date)
    ))
    .limit(1);
  return result[0];
}

export async function updateAttendanceRecord(id: number, data: Partial<InsertAttendanceRecord>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(attendanceRecords).set(data).where(eq(attendanceRecords.id, id));
}

export async function getAttendanceByEmployeeAndMonth(employeeId: number, yearMonth: string): Promise<AttendanceRecord[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const startDate = `${yearMonth}-01`;
  const endDate = `${yearMonth}-31`;
  
  return db.select()
    .from(attendanceRecords)
    .where(and(
      eq(attendanceRecords.employeeId, employeeId),
      gte(attendanceRecords.date, startDate),
      lte(attendanceRecords.date, endDate)
    ))
    .orderBy(desc(attendanceRecords.date));
}

export async function getAllAttendanceByDate(date: string): Promise<(AttendanceRecord & { employeeName: string })[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const records = await db.select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.date, date))
    .orderBy(attendanceRecords.clockInTime);
  
  const result: (AttendanceRecord & { employeeName: string })[] = [];
  for (const record of records) {
    const employee = await getEmployeeById(record.employeeId);
    result.push({
      ...record,
      employeeName: employee?.name || "Unknown"
    });
  }
  return result;
}

export async function getAllAttendanceByDateRange(startDate: string, endDate: string): Promise<(AttendanceRecord & { employeeName: string })[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const records = await db.select()
    .from(attendanceRecords)
    .where(and(
      gte(attendanceRecords.date, startDate),
      lte(attendanceRecords.date, endDate)
    ))
    .orderBy(desc(attendanceRecords.date), attendanceRecords.clockInTime);
  
  const result: (AttendanceRecord & { employeeName: string })[] = [];
  for (const record of records) {
    const employee = await getEmployeeById(record.employeeId);
    result.push({
      ...record,
      employeeName: employee?.name || "Unknown"
    });
  }
  return result;
}

export async function getAttendanceById(id: number): Promise<AttendanceRecord | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(attendanceRecords).where(eq(attendanceRecords.id, id)).limit(1);
  return result[0];
}

// ========== Task Functions ==========
export async function createTask(data: InsertTask): Promise<Task> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(tasks).values(data);
  const insertId = result[0].insertId;
  const [task] = await db.select().from(tasks).where(eq(tasks.id, insertId));
  return task;
}

export async function getTasksByAttendanceId(attendanceId: number): Promise<Task[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(tasks).where(eq(tasks.attendanceId, attendanceId));
}

export async function updateTask(id: number, data: Partial<InsertTask>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(tasks).set(data).where(eq(tasks.id, id));
}

export async function deleteTask(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(tasks).where(eq(tasks.id, id));
}

// ========== Break Functions ==========
export async function createBreak(data: InsertBreak): Promise<Break> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(breaks).values(data);
  const insertId = result[0].insertId;
  const [breakRecord] = await db.select().from(breaks).where(eq(breaks.id, insertId));
  return breakRecord;
}

export async function getBreaksByAttendanceId(attendanceId: number): Promise<Break[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(breaks).where(eq(breaks.attendanceId, attendanceId)).orderBy(breaks.startTime);
}

export async function getActiveBreak(attendanceId: number): Promise<Break | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select()
    .from(breaks)
    .where(and(
      eq(breaks.attendanceId, attendanceId),
      eq(breaks.endTime, null as any)
    ))
    .limit(1);
  return result[0];
}

export async function updateBreak(id: number, data: Partial<InsertBreak>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(breaks).set(data).where(eq(breaks.id, id));
}

// ========== Admin Settings Functions ==========
export async function getAdminSetting(key: string): Promise<string | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select()
    .from(adminSettings)
    .where(eq(adminSettings.settingKey, key))
    .limit(1);
  return result[0]?.settingValue;
}

export async function setAdminSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(adminSettings)
    .values({ settingKey: key, settingValue: value })
    .onDuplicateKeyUpdate({ set: { settingValue: value } });
}

export async function initializeAdminPassword(): Promise<void> {
  const existingPassword = await getAdminSetting("admin_password");
  if (!existingPassword) {
    await setAdminSetting("admin_password", "admin123");
  }
}

// ========== Team Task Functions ==========
export async function createTeamTask(data: InsertTeamTask): Promise<TeamTask> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(teamTasks).values(data);
  const insertId = result[0].insertId;
  const [task] = await db.select().from(teamTasks).where(eq(teamTasks.id, insertId));
  return task;
}

export async function updateTeamTask(id: number, data: Partial<InsertTeamTask>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(teamTasks).set(data).where(eq(teamTasks.id, id));
}

export async function deleteTeamTask(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(teamTasks).where(eq(teamTasks.id, id));
}

export async function getTeamTasksByPeriod(taskType: "weekly" | "monthly", period: string): Promise<TeamTask[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select()
    .from(teamTasks)
    .where(and(
      eq(teamTasks.taskType, taskType),
      eq(teamTasks.period, period),
      eq(teamTasks.isActive, true)
    ))
    .orderBy(desc(teamTasks.createdAt));
}

export async function getAllTeamTasks(): Promise<TeamTask[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select()
    .from(teamTasks)
    .orderBy(desc(teamTasks.createdAt));
}

export async function getActiveTeamTasks(): Promise<TeamTask[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select()
    .from(teamTasks)
    .where(eq(teamTasks.isActive, true))
    .orderBy(desc(teamTasks.createdAt));
}

export async function getTeamTaskById(id: number): Promise<TeamTask | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(teamTasks).where(eq(teamTasks.id, id)).limit(1);
  return result[0];
}

// ========== Staff Task Functions ==========
export async function createStaffTask(data: InsertStaffTask): Promise<StaffTask> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(staffTasks).values(data);
  const insertId = result[0].insertId;
  const [task] = await db.select().from(staffTasks).where(eq(staffTasks.id, insertId));
  return task;
}

export async function updateStaffTask(id: number, data: Partial<InsertStaffTask>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(staffTasks).set(data).where(eq(staffTasks.id, id));
}

export async function deleteStaffTask(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(staffTasks).where(eq(staffTasks.id, id));
}

export async function getStaffTasksByEmployeeId(employeeId: number): Promise<StaffTask[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select()
    .from(staffTasks)
    .where(eq(staffTasks.employeeId, employeeId))
    .orderBy(desc(staffTasks.createdAt));
}

export async function getActiveStaffTasksByEmployeeId(employeeId: number): Promise<StaffTask[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select()
    .from(staffTasks)
    .where(and(
      eq(staffTasks.employeeId, employeeId),
      eq(staffTasks.status, "pending")
    ))
    .orderBy(staffTasks.dueDate);
}

export async function getAllStaffTasks(): Promise<(StaffTask & { employeeName: string })[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const allTasks = await db.select()
    .from(staffTasks)
    .orderBy(desc(staffTasks.createdAt));
  
  const result: (StaffTask & { employeeName: string })[] = [];
  for (const task of allTasks) {
    const employee = await getEmployeeById(task.employeeId);
    result.push({
      ...task,
      employeeName: employee?.name || "Unknown"
    });
  }
  return result;
}

export async function getStaffTaskById(id: number): Promise<StaffTask | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(staffTasks).where(eq(staffTasks.id, id)).limit(1);
  return result[0];
}

export async function getUncompletedTasksFromPreviousDay(employeeId: number, currentDate: string): Promise<Task[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 前日の日付を計算
  const date = new Date(currentDate);
  date.setDate(date.getDate() - 1);
  const previousDate = date.toISOString().split('T')[0];
  
  // 前日の勤怠記録を取得
  const prevRecord = await getAttendanceByEmployeeAndDate(employeeId, previousDate);
  if (!prevRecord) return [];
  
  // 未完了タスクを取得
  const prevTasks = await getTasksByAttendanceId(prevRecord.id);
  return prevTasks.filter(t => !t.isCompleted);
}
