import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Lock, Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function AdminSettings() {
  const [, setLocation] = useLocation();
  const [adminToken, setAdminToken] = useState<string | null>(null);
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

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

  const changePasswordMutation = trpc.admin.changePassword.useMutation({
    onSuccess: () => {
      toast.success("パスワードを変更しました");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error("新しいパスワードが一致しません");
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error("パスワードは6文字以上で入力してください");
      return;
    }

    if (adminToken) {
      changePasswordMutation.mutate({
        token: adminToken,
        currentPassword,
        newPassword,
      });
    }
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
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold">設定</h1>
              <p className="text-sm opacity-90">管理者設定</p>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              パスワード変更
            </CardTitle>
            <CardDescription>
              管理者パスワードを変更します
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <Label htmlFor="currentPassword">現在のパスワード</Label>
                <div className="relative mt-1">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="newPassword">新しいパスワード</Label>
                <div className="relative mt-1">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  6文字以上で入力してください
                </p>
              </div>

              <div>
                <Label htmlFor="confirmPassword">新しいパスワード（確認）</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1"
                />
                {newPassword && confirmPassword && newPassword === confirmPassword && (
                  <p className="text-xs text-primary mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    パスワードが一致しています
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword ||
                  changePasswordMutation.isPending
                }
              >
                {changePasswordMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    変更中...
                  </>
                ) : (
                  "パスワードを変更"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
