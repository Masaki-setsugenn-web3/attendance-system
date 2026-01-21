import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { User, Loader2 } from "lucide-react";

export default function EmployeeSetup() {
  const [name, setName] = useState("");
  const [, setLocation] = useLocation();
  
  const registerMutation = trpc.employee.register.useMutation({
    onSuccess: (employee) => {
      localStorage.setItem("employeeId", employee.id.toString());
      localStorage.setItem("employeeName", employee.name);
      setLocation("/attendance");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      registerMutation.mutate({ name: name.trim() });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">勤怠管理システム</CardTitle>
          <CardDescription>
            従業員名を入力して開始してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="従業員名を入力"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-lg h-12"
                disabled={registerMutation.isPending}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 text-lg"
              disabled={!name.trim() || registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  登録中...
                </>
              ) : (
                "開始する"
              )}
            </Button>
          </form>
          {registerMutation.error && (
            <p className="mt-4 text-sm text-destructive text-center">
              {registerMutation.error.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
