import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useLocation, Link } from "wouter";
import { 
  ArrowLeft, Clock, LogIn, LogOut, Coffee, CheckCircle2, 
  AlertCircle, Loader2, Calendar
} from "lucide-react";

export default function History() {
  const [, setLocation] = useLocation();
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [employeeName, setEmployeeName] = useState<string>("");
  
  // 月選択
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

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

  const { data: history, isLoading } = trpc.attendance.getMonthlyHistory.useQuery(
    { employeeId: employeeId!, yearMonth: selectedMonth },
    { enabled: !!employeeId }
  );

  // 月の選択肢を生成（過去12ヶ月）
  const monthOptions = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
    monthOptions.push({ value, label });
  }

  const formatTime = (date: Date | string | null | undefined) => {
    if (!date) return "--:--";
    const d = new Date(date);
    return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ja-JP", {
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  };

  const calculateWorkTime = (clockIn: Date | string | null | undefined, clockOut: Date | string | null | undefined, breaks: { startTime: Date | string; endTime: Date | string | null }[]) => {
    if (!clockIn || !clockOut) return "--:--";
    
    const start = new Date(clockIn).getTime();
    const end = new Date(clockOut).getTime();
    let totalBreakTime = 0;
    
    for (const b of breaks) {
      if (b.endTime) {
        totalBreakTime += new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
      }
    }
    
    const workMs = end - start - totalBreakTime;
    const hours = Math.floor(workMs / (1000 * 60 * 60));
    const minutes = Math.floor((workMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}時間${minutes}分`;
  };

  if (!employeeId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-primary text-primary-foreground shadow-md">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Link href="/attendance">
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold">勤怠履歴</h1>
              <p className="text-sm opacity-90">{employeeName}</p>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container py-6 space-y-6">
        {/* 月選択 */}
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 履歴一覧 */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : history && history.length > 0 ? (
          <div className="space-y-4">
            {history.map((record) => (
              <Card key={record.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{formatDate(record.date)}</span>
                    <div className="flex items-center gap-2">
                      {record.isLate && (
                        <span className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded">遅刻</span>
                      )}
                      {record.isEarlyLeave && (
                        <span className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded">早退</span>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 出退勤時刻 */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <LogIn className="w-4 h-4 text-primary" />
                      <span>{formatTime(record.clockInTime)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <LogOut className="w-4 h-4 text-primary" />
                      <span>{formatTime(record.clockOutTime)}</span>
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">
                        {calculateWorkTime(record.clockInTime, record.clockOutTime, record.breaks)}
                      </span>
                    </div>
                  </div>

                  {/* 中抜け */}
                  {record.breaks.length > 0 && (
                    <div className="text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Coffee className="w-4 h-4" />
                        <span>中抜け</span>
                      </div>
                      <div className="pl-5 space-y-1">
                        {record.breaks.map((b, i) => (
                          <div key={i}>
                            {formatTime(b.startTime)} - {formatTime(b.endTime)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 目標 */}
                  {record.todayGoal && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">目標: </span>
                      <span>{record.todayGoal}</span>
                    </div>
                  )}



                  {/* 振り返り */}
                  {record.reflection && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">振り返り: </span>
                      <span>{record.reflection}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>この月の勤怠記録はありません</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
