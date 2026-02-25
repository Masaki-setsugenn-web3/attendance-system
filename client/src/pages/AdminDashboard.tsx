import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { useLocation, Link } from "wouter";
import {
  ArrowLeft, Calendar, MapPin, Settings, LogOut,
  Loader2, Edit, Users, Clock, ExternalLink, FileSpreadsheet, ListTodo, ClipboardList, CheckCircle2, Circle, UserCheck
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AttendanceRecord {
  id: number;
  employeeId: number;
  employeeName: string;
  date: string;
  clockInTime: Date | null;
  clockOutTime: Date | null;
  clockInLatitude: string | null;
  clockInLongitude: string | null;
  clockOutLatitude: string | null;
  clockOutLongitude: string | null;
  todayGoal: string | null;
  reflection: string | null;
  isLate: boolean | null;
  isEarlyLeave: boolean | null;
  tasks: { id: number; content: string; isCompleted: boolean | null; comment: string | null }[];
  breaks: { id: number; startTime: Date; endTime: Date | null }[];
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [viewingTasksRecord, setViewingTasksRecord] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({
    clockInTime: "",
    clockOutTime: "",
    isLate: false,
    isEarlyLeave: false,
  });
  const [exportMonth, setExportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      setLocation("/admin");
      return;
    }
    setAdminToken(token);
  }, [setLocation]);

  const { data: sessionValid } = trpc.admin.verifySession.useQuery(
    { token: adminToken! },
    { enabled: !!adminToken }
  );

  useEffect(() => {
    if (sessionValid && !sessionValid.valid) {
      localStorage.removeItem("adminToken");
      setLocation("/admin");
    }
  }, [sessionValid, setLocation]);

  const { data: attendance, isLoading, refetch } = trpc.admin.getAttendanceByDate.useQuery(
    { token: adminToken!, date: selectedDate },
    { enabled: !!adminToken && sessionValid?.valid }
  );

  const updateMutation = trpc.admin.updateAttendance.useMutation({
    onSuccess: () => {
      toast.success("勤怠情報を更新しました");
      setEditingRecord(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const logoutMutation = trpc.admin.logout.useMutation({
    onSuccess: () => {
      localStorage.removeItem("adminToken");
      setLocation("/admin");
    },
  });

  const exportMutation = trpc.admin.exportToSpreadsheet.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count}件のデータをスプレッドシートに出力しました`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleExport = () => {
    if (adminToken && exportMonth) {
      exportMutation.mutate({ token: adminToken, yearMonth: exportMonth });
    }
  };

  const handleLogout = () => {
    if (adminToken) {
      logoutMutation.mutate({ token: adminToken });
    }
  };

  const openEditDialog = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditForm({
      clockInTime: record.clockInTime
        ? new Date(record.clockInTime).toISOString().slice(0, 16)
        : "",
      clockOutTime: record.clockOutTime
        ? new Date(record.clockOutTime).toISOString().slice(0, 16)
        : "",
      isLate: record.isLate ?? false,
      isEarlyLeave: record.isEarlyLeave ?? false,
    });
  };

  const handleUpdate = () => {
    if (!editingRecord || !adminToken) return;

    updateMutation.mutate({
      token: adminToken,
      attendanceId: editingRecord.id,
      clockInTime: editForm.clockInTime || undefined,
      clockOutTime: editForm.clockOutTime || undefined,
      isLate: editForm.isLate,
      isEarlyLeave: editForm.isEarlyLeave,
    });
  };

  const formatTime = (date: Date | string | null | undefined) => {
    if (!date) return "--:--";
    const d = new Date(date);
    return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  };

  const getGoogleMapsUrl = (lat: string | null, lng: string | null) => {
    if (!lat || !lng) return null;
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  if (!adminToken || !sessionValid?.valid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-primary text-primary-foreground shadow-md">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/attendance">
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-lg font-semibold">管理者ダッシュボード</h1>
                <p className="text-sm opacity-90">勤怠管理</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin/team-tasks">
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                  <ListTodo className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/admin/staff-tasks">
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                  <UserCheck className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/admin/map">
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                  <MapPin className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/admin/settings">
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                  <Settings className="w-5 h-5" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-primary-foreground/10"
                onClick={handleLogout}
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container py-6 space-y-6">
        {/* 日付選択とエクスポート */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-auto"
                />
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                <Input
                  type="month"
                  value={exportMonth}
                  onChange={(e) => setExportMonth(e.target.value)}
                  className="w-auto"
                />
                <Button
                  onClick={handleExport}
                  disabled={exportMutation.isPending}
                  className="whitespace-nowrap"
                >
                  {exportMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      出力中...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      スプレッドシートに出力
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 統計 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{attendance?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">出勤者数</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">
                    {attendance?.filter((a) => a.isLate).length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">遅刻</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <LogOut className="w-5 h-5 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">
                    {attendance?.filter((a) => a.isEarlyLeave).length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">早退</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">
                    {attendance?.filter((a) => a.clockOutTime).length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">退勤済み</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 勤怠一覧 */}
        <Card>
          <CardHeader>
            <CardTitle>勤怠一覧</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : attendance && attendance.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>従業員名</TableHead>
                      <TableHead>出勤</TableHead>
                      <TableHead>退勤</TableHead>
                      <TableHead>状態</TableHead>
                      <TableHead>位置</TableHead>
                      <TableHead>タスク詳細</TableHead>
                      <TableHead>編集</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {record.employeeName}
                        </TableCell>
                        <TableCell>{formatTime(record.clockInTime)}</TableCell>
                        <TableCell>{formatTime(record.clockOutTime)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {record.isLate && (
                              <span className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded">
                                遅刻
                              </span>
                            )}
                            {record.isEarlyLeave && (
                              <span className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded">
                                早退
                              </span>
                            )}
                            {!record.clockOutTime && (
                              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">
                                勤務中
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {getGoogleMapsUrl(record.clockInLatitude, record.clockInLongitude) && (
                              <a
                                href={getGoogleMapsUrl(record.clockInLatitude, record.clockInLongitude)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <MapPin className="w-3 h-3" />
                                出勤
                              </a>
                            )}
                            {getGoogleMapsUrl(record.clockOutLatitude, record.clockOutLongitude) && (
                              <a
                                href={getGoogleMapsUrl(record.clockOutLatitude, record.clockOutLongitude)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <MapPin className="w-3 h-3" />
                                退勤
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex items-center gap-2"
                            onClick={() => setViewingTasksRecord(record as AttendanceRecord)}
                          >
                            <ClipboardList className="w-4 h-4" />
                            <span className="hidden md:inline">
                              {record.tasks.filter(t => t.isCompleted).length}/{record.tasks.length}
                            </span>
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(record as AttendanceRecord)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>この日の勤怠記録はありません</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* タスク詳細ダイアログ */}
      <Dialog open={!!viewingTasksRecord} onOpenChange={() => setViewingTasksRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{viewingTasksRecord?.employeeName}さんの業務報告</DialogTitle>
            <DialogDescription>
              {viewingTasksRecord?.date} の業務内容詳細
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[50vh] pr-4">
            <div className="space-y-6">
              {/* 今日の目標 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <div className="w-1 h-6 bg-primary rounded-full"></div>
                  今日の目標
                </h3>
                <Card>
                  <CardContent className="pt-4 pb-4 bg-muted/30">
                    <p className="text-base">
                      {viewingTasksRecord?.todayGoal || "設定なし"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* タスク一覧 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                  タスク進捗
                  <Badge variant="outline" className="ml-2">
                    {viewingTasksRecord?.tasks.filter(t => t.isCompleted).length}/{viewingTasksRecord?.tasks.length} 完了
                  </Badge>
                </h3>
                <div className="space-y-3">
                  {viewingTasksRecord?.tasks.map((task) => (
                    <Card key={task.id} className={task.isCompleted ? "border-green-200 bg-green-50/30" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {task.isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                          )}
                          <div className="space-y-2 w-full">
                            <p className={task.isCompleted ? "line-through text-muted-foreground" : ""}>
                              {task.content}
                            </p>
                            {task.comment && (
                              <div className="bg-muted p-2 rounded text-sm text-muted-foreground mt-2">
                                <span className="font-semibold text-xs block mb-1">コメント:</span>
                                {task.comment}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {viewingTasksRecord?.tasks.length === 0 && (
                    <p className="text-muted-foreground text-center py-4">タスクはありません</p>
                  )}
                </div>
              </div>

              {/* 振り返り */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
                  一日の振り返り
                </h3>
                <Card>
                  <CardContent className="pt-4 pb-4 bg-muted/30">
                    <p className="text-base whitespace-pre-wrap">
                      {viewingTasksRecord?.reflection || "未入力"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button onClick={() => setViewingTasksRecord(null)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編集ダイアログ */}
      <Dialog open={!!editingRecord} onOpenChange={() => setEditingRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>勤怠情報の修正</DialogTitle>
            <DialogDescription>
              {editingRecord?.employeeName}さんの勤怠情報を修正します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="clockInTime">出勤時刻</Label>
              <Input
                id="clockInTime"
                type="datetime-local"
                value={editForm.clockInTime}
                onChange={(e) =>
                  setEditForm({ ...editForm, clockInTime: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="clockOutTime">退勤時刻</Label>
              <Input
                id="clockOutTime"
                type="datetime-local"
                value={editForm.clockOutTime}
                onChange={(e) =>
                  setEditForm({ ...editForm, clockOutTime: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="editIsLate"
                checked={editForm.isLate}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, isLate: checked === true })
                }
              />
              <Label htmlFor="editIsLate">遅刻</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="editIsEarlyLeave"
                checked={editForm.isEarlyLeave}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, isEarlyLeave: checked === true })
                }
              />
              <Label htmlFor="editIsEarlyLeave">早退</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRecord(null)}>
              キャンセル
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
