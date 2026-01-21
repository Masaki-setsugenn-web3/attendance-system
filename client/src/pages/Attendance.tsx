import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useLocation, Link } from "wouter";
import { 
  Clock, LogIn, LogOut, Coffee, Plus, X, MapPin, 
  Loader2, History, Settings, CheckCircle2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";

interface Task {
  id?: number;
  content: string;
  isCompleted: boolean;
}

export default function Attendance() {
  const [, setLocation] = useLocation();
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [employeeName, setEmployeeName] = useState<string>("");
  
  // 出勤フォーム
  const [todayGoal, setTodayGoal] = useState("");
  const [tasks, setTasks] = useState<Task[]>([{ content: "", isCompleted: false }]);
  const [isLate, setIsLate] = useState(false);
  
  // 退勤フォーム
  const [reflection, setReflection] = useState("");
  const [isEarlyLeave, setIsEarlyLeave] = useState(false);
  
  // GPS
  const [location, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    const storedId = localStorage.getItem("employeeId");
    const storedName = localStorage.getItem("employeeName");
    if (!storedId || !storedName) {
      setLocation("/");
      return;
    }
    setEmployeeId(parseInt(storedId));
    setEmployeeName(storedName);
  }, [setLocation]);

  // 位置情報を取得
  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("位置情報がサポートされていません");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationError(null);
      },
      (error) => {
        setLocationError("位置情報を取得できませんでした");
        console.error("Geolocation error:", error);
      }
    );
  };

  useEffect(() => {
    getLocation();
  }, []);

  // 今日の勤怠状況を取得
  const { data: todayStatus, isLoading, refetch } = trpc.attendance.getTodayStatus.useQuery(
    { employeeId: employeeId! },
    { enabled: !!employeeId, refetchInterval: 30000 }
  );

  // 出勤打刻
  const clockInMutation = trpc.attendance.clockIn.useMutation({
    onSuccess: () => {
      toast.success("出勤打刻が完了しました");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // 退勤打刻
  const clockOutMutation = trpc.attendance.clockOut.useMutation({
    onSuccess: () => {
      toast.success("退勤打刻が完了しました");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // 中抜け開始
  const startBreakMutation = trpc.attendance.startBreak.useMutation({
    onSuccess: () => {
      toast.success("中抜けを開始しました");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // 中抜け終了
  const endBreakMutation = trpc.attendance.endBreak.useMutation({
    onSuccess: () => {
      toast.success("中抜けを終了しました");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleClockIn = () => {
    if (!employeeId) return;
    getLocation();
    clockInMutation.mutate({
      employeeId,
      todayGoal,
      tasks: tasks.map(t => t.content).filter(c => c.trim()),
      isLate,
      latitude: location?.lat,
      longitude: location?.lng,
    });
  };

  const handleClockOut = () => {
    if (!employeeId || !todayStatus?.tasks) return;
    getLocation();
    const completedTaskIds = todayStatus.tasks
      .filter((_, i) => tasks[i]?.isCompleted)
      .map(t => t.id);
    
    clockOutMutation.mutate({
      employeeId,
      reflection,
      isEarlyLeave,
      latitude: location?.lat,
      longitude: location?.lng,
      completedTaskIds,
    });
  };

  const addTask = () => {
    setTasks([...tasks, { content: "", isCompleted: false }]);
  };

  const removeTask = (index: number) => {
    if (tasks.length > 1) {
      setTasks(tasks.filter((_, i) => i !== index));
    }
  };

  const updateTask = (index: number, content: string) => {
    const newTasks = [...tasks];
    newTasks[index] = { ...newTasks[index], content };
    setTasks(newTasks);
  };

  const toggleTaskCompletion = (index: number) => {
    const newTasks = [...tasks];
    newTasks[index] = { ...newTasks[index], isCompleted: !newTasks[index].isCompleted };
    setTasks(newTasks);
  };

  // 既存タスクをセット
  useEffect(() => {
    if (todayStatus?.tasks && todayStatus.tasks.length > 0) {
      setTasks(todayStatus.tasks.map(t => ({
        id: t.id,
        content: t.content,
        isCompleted: t.isCompleted ?? false,
      })));
    }
  }, [todayStatus?.tasks]);

  const handleLogout = () => {
    localStorage.removeItem("employeeId");
    localStorage.removeItem("employeeName");
    setLocation("/");
  };

  if (isLoading || !employeeId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const formatTime = (date: Date | string | null | undefined) => {
    if (!date) return "--:--";
    const d = new Date(date);
    return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  };

  const renderClockInForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="w-5 h-5" />
          出勤打刻
        </CardTitle>
        <CardDescription>今日の目標とタスクを入力してください</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="goal">今日の目標</Label>
          <Textarea
            id="goal"
            placeholder="今日達成したいことを入力"
            value={todayGoal}
            onChange={(e) => setTodayGoal(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label>今日のタスク</Label>
          <div className="space-y-2 mt-1">
            {tasks.map((task, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`タスク ${index + 1}`}
                  value={task.content}
                  onChange={(e) => updateTask(index, e.target.value)}
                />
                {tasks.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeTask(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTask}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              タスクを追加
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="late"
            checked={isLate}
            onCheckedChange={(checked) => setIsLate(checked === true)}
          />
          <Label htmlFor="late" className="text-sm">遅刻</Label>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4" />
          {location ? (
            <span>位置情報: 取得済み</span>
          ) : locationError ? (
            <span className="text-destructive">{locationError}</span>
          ) : (
            <span>位置情報を取得中...</span>
          )}
        </div>

        <Button
          onClick={handleClockIn}
          className="w-full h-12 text-lg"
          disabled={clockInMutation.isPending}
        >
          {clockInMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <LogIn className="w-5 h-5 mr-2" />
          )}
          出勤する
        </Button>
      </CardContent>
    </Card>
  );

  const renderWorkingStatus = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            勤務中
          </CardTitle>
          <CardDescription>
            出勤時刻: {formatTime(todayStatus?.record?.clockInTime)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {todayStatus?.record?.todayGoal && (
            <div>
              <Label className="text-muted-foreground">今日の目標</Label>
              <p className="mt-1">{todayStatus.record.todayGoal}</p>
            </div>
          )}

          {todayStatus?.tasks && todayStatus.tasks.length > 0 && (
            <div>
              <Label className="text-muted-foreground">タスク</Label>
              <div className="space-y-2 mt-1">
                {tasks.map((task, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Checkbox
                      checked={task.isCompleted}
                      onCheckedChange={() => toggleTaskCompletion(index)}
                    />
                    <span className={task.isCompleted ? "line-through text-muted-foreground" : ""}>
                      {task.content}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {todayStatus?.breaks && todayStatus.breaks.length > 0 && (
            <div>
              <Label className="text-muted-foreground">中抜け履歴</Label>
              <div className="space-y-1 mt-1 text-sm">
                {todayStatus.breaks.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Coffee className="w-4 h-4" />
                    <span>
                      {formatTime(b.startTime)} - {b.endTime ? formatTime(b.endTime) : "継続中"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {todayStatus?.status === "on_break" ? (
              <Button
                onClick={() => endBreakMutation.mutate({ employeeId: employeeId! })}
                variant="outline"
                className="flex-1"
                disabled={endBreakMutation.isPending}
              >
                {endBreakMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Coffee className="w-4 h-4 mr-2" />
                )}
                中抜け終了
              </Button>
            ) : (
              <Button
                onClick={() => startBreakMutation.mutate({ employeeId: employeeId! })}
                variant="outline"
                className="flex-1"
                disabled={startBreakMutation.isPending}
              >
                {startBreakMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Coffee className="w-4 h-4 mr-2" />
                )}
                中抜け開始
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="w-5 h-5" />
            退勤打刻
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="reflection">振り返りメモ</Label>
            <Textarea
              id="reflection"
              placeholder="今日の振り返りを入力"
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="earlyLeave"
              checked={isEarlyLeave}
              onCheckedChange={(checked) => setIsEarlyLeave(checked === true)}
            />
            <Label htmlFor="earlyLeave" className="text-sm">早退</Label>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            {location ? (
              <span>位置情報: 取得済み</span>
            ) : locationError ? (
              <span className="text-destructive">{locationError}</span>
            ) : (
              <span>位置情報を取得中...</span>
            )}
          </div>

          <Button
            onClick={handleClockOut}
            className="w-full h-12 text-lg"
            disabled={clockOutMutation.isPending || todayStatus?.status === "on_break"}
          >
            {clockOutMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <LogOut className="w-5 h-5 mr-2" />
            )}
            退勤する
          </Button>
          {todayStatus?.status === "on_break" && (
            <p className="text-sm text-destructive text-center">
              中抜け中は退勤できません
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderClockedOut = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          本日の勤務完了
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">出勤</Label>
            <p className="text-lg font-medium">{formatTime(todayStatus?.record?.clockInTime)}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">退勤</Label>
            <p className="text-lg font-medium">{formatTime(todayStatus?.record?.clockOutTime)}</p>
          </div>
        </div>

        {todayStatus?.record?.todayGoal && (
          <div>
            <Label className="text-muted-foreground">今日の目標</Label>
            <p className="mt-1">{todayStatus.record.todayGoal}</p>
          </div>
        )}

        {todayStatus?.tasks && todayStatus.tasks.length > 0 && (
          <div>
            <Label className="text-muted-foreground">タスク</Label>
            <div className="space-y-1 mt-1">
              {todayStatus.tasks.map((task, i) => (
                <div key={i} className="flex items-center gap-2">
                  {task.isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={task.isCompleted ? "text-muted-foreground" : ""}>
                    {task.content}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {todayStatus?.record?.reflection && (
          <div>
            <Label className="text-muted-foreground">振り返り</Label>
            <p className="mt-1">{todayStatus.record.reflection}</p>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm">
          {todayStatus?.record?.isLate && (
            <span className="px-2 py-1 bg-destructive/10 text-destructive rounded">遅刻</span>
          )}
          {todayStatus?.record?.isEarlyLeave && (
            <span className="px-2 py-1 bg-destructive/10 text-destructive rounded">早退</span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-primary text-primary-foreground shadow-md">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">勤怠管理</h1>
              <p className="text-sm opacity-90">{employeeName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/history">
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                  <History className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/admin">
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                  <Settings className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container py-6 space-y-6">
        {/* 日付表示 */}
        <div className="text-center">
          <p className="text-2xl font-bold">
            {new Date().toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </p>
        </div>

        {/* 状態に応じた表示 */}
        {todayStatus?.status === "not_clocked_in" && renderClockInForm()}
        {(todayStatus?.status === "working" || todayStatus?.status === "on_break") && renderWorkingStatus()}
        {todayStatus?.status === "clocked_out" && renderClockedOut()}

        {/* ログアウトボタン */}
        <div className="pt-4">
          <Button variant="outline" onClick={handleLogout} className="w-full">
            別の従業員でログイン
          </Button>
        </div>
      </main>
    </div>
  );
}
