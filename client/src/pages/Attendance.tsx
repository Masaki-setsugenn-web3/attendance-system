import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useLocation, Link } from "wouter";
import { 
  Clock, LogIn, LogOut, Coffee, 
  Loader2, History, CheckCircle2, AlertCircle, Flag
} from "lucide-react";
import { toast } from "sonner";

export default function Attendance() {
  const [, setLocation] = useLocation();
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [employeeName, setEmployeeName] = useState<string>("");
  
  // 出勤フォーム
  const [isLate, setIsLate] = useState(false);
  
  // 退勤フォーム
  const [reflection, setReflection] = useState("");
  const [isEarlyLeave, setIsEarlyLeave] = useState(false);
  
  // GPS
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);

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
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
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
      isLate,
      latitude: gpsLocation?.lat,
      longitude: gpsLocation?.lng,
    });
  };

  const handleClockOut = () => {
    if (!employeeId) return;
    getLocation();
    clockOutMutation.mutate({
      employeeId,
      reflection,
      isEarlyLeave,
      latitude: gpsLocation?.lat,
      longitude: gpsLocation?.lng,
    });
  };

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

  const calculateBreakMinutes = () => {
    if (!todayStatus?.breaks) return 0;
    return todayStatus.breaks.reduce((total, b) => {
      if (b.startTime && b.endTime) {
        return total + Math.round((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000);
      }
      return total;
    }, 0);
  };

  const renderClockInForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="w-5 h-5" />
          出勤打刻
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="isLate"
            checked={isLate}
            onCheckedChange={(checked) => setIsLate(checked === true)}
          />
          <Label htmlFor="isLate" className="flex items-center gap-1 text-amber-600">
            <Flag className="w-4 h-4" />
            遅刻
          </Label>
        </div>

        <Button
          onClick={handleClockIn}
          disabled={clockInMutation.isPending}
          className="w-full bg-primary hover:bg-primary/90 text-white py-6 text-lg font-bold"
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
      {/* 勤務状況カード */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="font-semibold text-primary">
                {todayStatus?.status === 'on_break' ? '中抜け中' : '勤務中'}
              </span>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">出勤時刻</div>
              <div className="font-bold text-lg">{formatTime(todayStatus?.record?.clockInTime)}</div>
            </div>
          </div>

          {todayStatus?.record?.isLate && (
            <div className="flex items-center gap-1 text-amber-600 text-sm mb-3">
              <Flag className="w-4 h-4" />
              <span>遅刻</span>
            </div>
          )}

          {calculateBreakMinutes() > 0 && (
            <div className="text-sm text-muted-foreground">
              中抜け合計: {calculateBreakMinutes()}分
            </div>
          )}
        </CardContent>
      </Card>

      {/* 中抜けボタン */}
      {todayStatus?.status === 'working' && (
        <Button
          variant="outline"
          onClick={() => startBreakMutation.mutate({ employeeId: employeeId! })}
          disabled={startBreakMutation.isPending}
          className="w-full border-amber-400 text-amber-600 hover:bg-amber-50 py-5"
        >
          {startBreakMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Coffee className="w-5 h-5 mr-2" />
          )}
          中抜け開始
        </Button>
      )}

      {todayStatus?.status === 'on_break' && (
        <Button
          onClick={() => endBreakMutation.mutate({ employeeId: employeeId! })}
          disabled={endBreakMutation.isPending}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white py-5"
        >
          {endBreakMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Coffee className="w-5 h-5 mr-2" />
          )}
          中抜け終了
        </Button>
      )}

      {/* 退勤フォーム */}
      {todayStatus?.status !== 'on_break' && (
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
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="今日の振り返りを入力..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isEarlyLeave"
                checked={isEarlyLeave}
                onCheckedChange={(checked) => setIsEarlyLeave(checked === true)}
              />
              <Label htmlFor="isEarlyLeave" className="flex items-center gap-1 text-amber-600">
                <Flag className="w-4 h-4" />
                早退
              </Label>
            </div>

            <Button
              onClick={handleClockOut}
              disabled={clockOutMutation.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-6 text-lg font-bold"
            >
              {clockOutMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <LogOut className="w-5 h-5 mr-2" />
              )}
              退勤する
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderClockedOut = () => (
    <Card className="border-green-200 bg-green-50">
      <CardContent className="pt-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-green-700 mb-2">お疲れさまでした！</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <div>出勤: {formatTime(todayStatus?.record?.clockInTime)}</div>
          <div>退勤: {formatTime(todayStatus?.record?.clockOutTime)}</div>
          {calculateBreakMinutes() > 0 && (
            <div>中抜け: {calculateBreakMinutes()}分</div>
          )}
        </div>
        {todayStatus?.record?.reflection && (
          <div className="mt-3 p-3 bg-white rounded-lg text-left text-sm">
            <div className="font-medium text-muted-foreground mb-1">振り返り</div>
            <div>{todayStatus.record.reflection}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="bg-primary text-white px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <div className="text-xs opacity-75">ようこそ</div>
            <div className="font-bold text-lg">{employeeName}さん！</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs opacity-75">
                {new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}
              </div>
              <div className="font-bold flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4 pb-24">
        {/* ステータス表示 */}
        {!todayStatus || todayStatus.status === 'not_clocked_in' ? (
          renderClockInForm()
        ) : todayStatus.status === 'clocked_out' ? (
          renderClockedOut()
        ) : (
          renderWorkingStatus()
        )}

        {/* エラー表示 */}
        {(clockInMutation.isError || clockOutMutation.isError) && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4 flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">
                {clockInMutation.error?.message || clockOutMutation.error?.message}
              </span>
            </CardContent>
          </Card>
        )}
      </main>

      {/* ボトムナビ */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border">
        <div className="max-w-md mx-auto flex">
          <button className="flex-1 py-3 flex flex-col items-center gap-1 text-primary">
            <Clock className="w-5 h-5" />
            <span className="text-xs font-medium">打刻</span>
          </button>
          <Link href="/history" className="flex-1 py-3 flex flex-col items-center gap-1 text-muted-foreground hover:text-primary">
            <History className="w-5 h-5" />
            <span className="text-xs">履歴</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex-1 py-3 flex flex-col items-center gap-1 text-muted-foreground hover:text-red-500"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-xs">ログアウト</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
