import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { useLocation, Link } from "wouter";
import {
  ArrowLeft, Plus, Edit, Trash2, Loader2,
  Calendar, Target, ListTodo
} from "lucide-react";
import { toast } from "sonner";

interface TeamTask {
  id: number;
  title: string;
  description: string | null;
  taskType: "weekly" | "monthly";
  period: string;
  isActive: boolean | null;
  createdAt: Date;
}

export default function AdminTeamTasks() {
  const [, setLocation] = useLocation();
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    taskType: "weekly" as "weekly" | "monthly",
    period: "",
  });

  // 現在の週と月を計算
  const getCurrentPeriods = () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    const currentWeek = `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    return { currentWeek, currentMonth };
  };

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

  const { data: teamTasks, isLoading, refetch } = trpc.teamTask.getAll.useQuery(
    { token: adminToken! },
    { enabled: !!adminToken && sessionValid?.valid }
  );

  const createMutation = trpc.teamTask.create.useMutation({
    onSuccess: () => {
      toast.success("チームタスクを作成しました");
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.teamTask.update.useMutation({
    onSuccess: () => {
      toast.success("チームタスクを更新しました");
      setEditingTask(null);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.teamTask.delete.useMutation({
    onSuccess: () => {
      toast.success("チームタスクを削除しました");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    const { currentWeek } = getCurrentPeriods();
    setFormData({
      title: "",
      description: "",
      taskType: "weekly",
      period: currentWeek,
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEditDialog = (task: TeamTask) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      taskType: task.taskType,
      period: task.period,
    });
  };

  const handleCreate = () => {
    if (!adminToken || !formData.title || !formData.period) return;
    createMutation.mutate({
      token: adminToken,
      title: formData.title,
      description: formData.description || undefined,
      taskType: formData.taskType,
      period: formData.period,
    });
  };

  const handleUpdate = () => {
    if (!adminToken || !editingTask) return;
    updateMutation.mutate({
      token: adminToken,
      id: editingTask.id,
      title: formData.title,
      description: formData.description || undefined,
    });
  };

  const handleToggleActive = (task: TeamTask) => {
    if (!adminToken) return;
    updateMutation.mutate({
      token: adminToken,
      id: task.id,
      isActive: !task.isActive,
    });
  };

  const handleDelete = (task: TeamTask) => {
    if (!adminToken) return;
    if (confirm(`「${task.title}」を削除しますか？`)) {
      deleteMutation.mutate({ token: adminToken, id: task.id });
    }
  };

  const formatPeriod = (taskType: string, period: string) => {
    if (taskType === "weekly") {
      const match = period.match(/(\d{4})-W(\d{2})/);
      if (match) {
        return `${match[1]}年 第${parseInt(match[2])}週`;
      }
    } else {
      const match = period.match(/(\d{4})-(\d{2})/);
      if (match) {
        return `${match[1]}年${parseInt(match[2])}月`;
      }
    }
    return period;
  };

  const handleTaskTypeChange = (value: "weekly" | "monthly") => {
    const { currentWeek, currentMonth } = getCurrentPeriods();
    setFormData({
      ...formData,
      taskType: value,
      period: value === "weekly" ? currentWeek : currentMonth,
    });
  };

  if (!adminToken || !sessionValid?.valid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const weeklyTasks = teamTasks?.filter(t => t.taskType === "weekly") || [];
  const monthlyTasks = teamTasks?.filter(t => t.taskType === "monthly") || [];

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-primary text-primary-foreground shadow-md">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/dashboard">
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-lg font-semibold">チームタスク管理</h1>
                <p className="text-sm opacity-90">週間・月間タスクの設定</p>
              </div>
            </div>
            <Button
              onClick={openCreateDialog}
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              新規作成
            </Button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container py-6 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* 週間タスク */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  週間タスク
                </CardTitle>
              </CardHeader>
              <CardContent>
                {weeklyTasks.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>タイトル</TableHead>
                          <TableHead>期間</TableHead>
                          <TableHead>有効</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weeklyTasks.map((task) => (
                          <TableRow key={task.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{task.title}</p>
                                {task.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">
                                    {task.description}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{formatPeriod(task.taskType, task.period)}</TableCell>
                            <TableCell>
                              <Switch
                                checked={task.isActive ?? false}
                                onCheckedChange={() => handleToggleActive(task)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(task)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  onClick={() => handleDelete(task)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    週間タスクはまだありません
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 月間タスク */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  月間タスク
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyTasks.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>タイトル</TableHead>
                          <TableHead>期間</TableHead>
                          <TableHead>有効</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyTasks.map((task) => (
                          <TableRow key={task.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{task.title}</p>
                                {task.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">
                                    {task.description}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{formatPeriod(task.taskType, task.period)}</TableCell>
                            <TableCell>
                              <Switch
                                checked={task.isActive ?? false}
                                onCheckedChange={() => handleToggleActive(task)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(task)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  onClick={() => handleDelete(task)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    月間タスクはまだありません
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {/* 作成ダイアログ */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>チームタスクを作成</DialogTitle>
            <DialogDescription>
              チーム全員に表示されるタスクを作成します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>タスク種別</Label>
              <Select
                value={formData.taskType}
                onValueChange={handleTaskTypeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">週間タスク</SelectItem>
                  <SelectItem value="monthly">月間タスク</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>期間</Label>
              <Input
                type={formData.taskType === "weekly" ? "week" : "month"}
                value={formData.period}
                onChange={(e) => setFormData({ ...formData, period: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>タイトル</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="例: 新規顧客獲得 10件"
              />
            </div>
            <div className="space-y-2">
              <Label>詳細（任意）</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="タスクの詳細説明"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !formData.title || !formData.period}
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "作成"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編集ダイアログ */}
      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>チームタスクを編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>タイトル</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>詳細（任意）</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>
              キャンセル
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending || !formData.title}
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "更新"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
