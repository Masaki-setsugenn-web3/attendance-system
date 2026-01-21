import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useLocation, Link } from "wouter";
import { User, Loader2, Shield, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function EmployeeSetup() {
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();

  const loginMutation = trpc.employee.login.useMutation({
    onSuccess: (employee) => {
      localStorage.setItem("employeeId", employee.id.toString());
      localStorage.setItem("employeeName", employee.name);
      toast.success(`ようこそ ${employee.name} さん！`);
      setLocation("/attendance");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (employeeNumber.trim() && password.trim()) {
      loginMutation.mutate({ 
        employeeNumber: employeeNumber.trim(),
        password: password.trim()
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-accent">勤怠管理システム</CardTitle>
          <CardDescription>
            従業員番号とパスワードを入力してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="employeeNumber">従業員番号</Label>
              <Input
                id="employeeNumber"
                type="text"
                placeholder="例: 001"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                className="mt-1"
                disabled={loginMutation.isPending}
              />
            </div>
            <div>
              <Label htmlFor="password">パスワード</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="パスワードを入力"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  disabled={loginMutation.isPending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-12"
              disabled={!employeeNumber.trim() || !password.trim() || loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ログイン中...
                </>
              ) : (
                "ログイン"
              )}
            </Button>
          </form>
          <div className="mt-6 pt-4 border-t">
            <Link href="/admin">
              <Button variant="ghost" className="w-full text-muted-foreground">
                <Shield className="w-4 h-4 mr-2" />
                管理者ログイン
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
