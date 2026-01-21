import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useLocation, Link } from "wouter";
import {
  ArrowLeft, Calendar, MapPin, Loader2, ExternalLink, LogIn, LogOut
} from "lucide-react";

interface LocationRecord {
  employeeName: string;
  type: "clockIn" | "clockOut";
  time: Date | null;
  latitude: string | null;
  longitude: string | null;
}

export default function AdminMap() {
  const [, setLocation] = useLocation();
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
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

  const { data: attendance, isLoading } = trpc.admin.getAttendanceByDate.useQuery(
    { token: adminToken!, date: selectedDate },
    { enabled: !!adminToken && sessionValid?.valid }
  );

  const formatTime = (date: Date | string | null | undefined) => {
    if (!date) return "--:--";
    const d = new Date(date);
    return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  };

  const getGoogleMapsUrl = (lat: string | null, lng: string | null) => {
    if (!lat || !lng) return null;
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  // 位置情報を持つ記録を抽出
  const locationRecords: LocationRecord[] = [];
  if (attendance) {
    for (const record of attendance) {
      if (record.clockInLatitude && record.clockInLongitude) {
        locationRecords.push({
          employeeName: record.employeeName,
          type: "clockIn",
          time: record.clockInTime,
          latitude: record.clockInLatitude,
          longitude: record.clockInLongitude,
        });
      }
      if (record.clockOutLatitude && record.clockOutLongitude) {
        locationRecords.push({
          employeeName: record.employeeName,
          type: "clockOut",
          time: record.clockOutTime,
          latitude: record.clockOutLatitude,
          longitude: record.clockOutLongitude,
        });
      }
    }
  }

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
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold">打刻位置マップ</h1>
              <p className="text-sm opacity-90">GPS位置情報</p>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container py-6 space-y-6">
        {/* 日付選択 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto"
              />
            </div>
          </CardContent>
        </Card>

        {/* 位置情報一覧 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              打刻位置一覧
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : locationRecords.length > 0 ? (
              <div className="space-y-4">
                {locationRecords.map((record, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        record.type === "clockIn" 
                          ? "bg-primary/10 text-primary" 
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {record.type === "clockIn" ? (
                          <LogIn className="w-5 h-5" />
                        ) : (
                          <LogOut className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{record.employeeName}</p>
                        <p className="text-sm text-muted-foreground">
                          {record.type === "clockIn" ? "出勤" : "退勤"} - {formatTime(record.time)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={getGoogleMapsUrl(record.latitude, record.longitude)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <MapPin className="w-4 h-4" />
                      <span className="hidden sm:inline">地図で見る</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>この日の位置情報はありません</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 全員の位置を地図で見るリンク */}
        {locationRecords.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                各打刻位置をGoogle Mapsで確認できます。上のリストから「地図で見る」をクリックしてください。
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-full bg-primary/10 text-primary">
                    <LogIn className="w-4 h-4" />
                  </div>
                  <span>出勤打刻</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-full bg-muted text-muted-foreground">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <span>退勤打刻</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
