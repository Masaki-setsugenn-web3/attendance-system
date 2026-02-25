import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, User, Calendar, Flag } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const PRIORITY_LABELS: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "未着手",
  in_progress: "進行中",
  completed: "完了",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
};

export default function AdminStaffTasks() {
  const [, setLocation] = useLocation();
  const [adminToken] = useState(() => localStorage.getItem("adminToken") || "");
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");

  const employeesQuery = trpc.admin.getAllEmployees.useQuery({ token: adminToken });
  const staffTasksQuery = trpc.staffTask.getAll.useQuery({ token: adminToken });
  const createMutation = trpc.staffTask.create.useMutation({
    onSuccess: () => {
      toast.success("タスクを作成しました");
      setShowForm(false);
      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("medium");
      setSelectedEmployeeId("");
      staffTasksQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.staffTask.delete.useMutation({
    onSuccess: () => {
      toast.success("タスクを削除しました");
      staffTasksQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.staffTask.update.useMutation({
    onSuccess: () => {
      staffTasksQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (!adminToken) {
      setLocation("/admin");
    }
  }, [adminToken, setLocation]);

  const handleCreate = () => {
    if (!selectedEmployeeId || !title.trim()) {
      toast.error("従業員とタイトルは必須です");
      return;
    }
    createMutation.mutate({
      token: adminToken,
      employeeId: parseInt(selectedEmployeeId),
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate || undefined,
      priority,
    });
  };

  const handleStatusChange = (taskId: number, status: "pending" | "in_progress" | "completed") => {
    updateMutation.mutate({ token: adminToken, id: taskId, status });
  };

  const filteredTasks = staffTasksQuery.data?.filter(
    (t) => filterEmployeeId === "all" || t.employeeId === parseInt(filterEmployeeId)
  ) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-[#223025] text-white p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setLocation("/admin/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">スタッフタスク管理</h1>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* フィルター */}
        <div className="flex gap-2 items-center">
          <Label className="whitespace-nowrap text-sm">従業員:</Label>
          <Select value={filterEmployeeId} onValueChange={setFilterEmployeeId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="全員" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全員</SelectItem>
              {employeesQuery.data?.map((emp) => (
                <SelectItem key={emp.id} value={emp.id.toString()}>
                  {emp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowForm(!showForm)} className="bg-[#223025] hover:bg-[#2d4033]">
            <Plus className="h-4 w-4 mr-1" />
            新規
          </Button>
        </div>

        {/* 新規作成フォーム */}
        {showForm && (
          <Card className="border-[#223025]/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">新規タスク作成</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm">担当者 *</Label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="従業員を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeesQuery.data?.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">タイトル *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タスクのタイトル" />
              </div>
              <div>
                <Label className="text-sm">詳細</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="タスクの詳細説明" rows={3} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-sm">期限</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div className="flex-1">
                  <Label className="text-sm">優先度</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as "low" | "medium" | "high")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">低</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="high">高</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="flex-1 bg-[#223025] hover:bg-[#2d4033]">
                  {createMutation.isPending ? "作成中..." : "作成"}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                  キャンセル
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* タスク一覧 */}
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>タスクがありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <Card key={task.id} className={`${task.status === "completed" ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority || "medium"]}`}>
                          <Flag className="h-3 w-3 inline mr-0.5" />
                          {PRIORITY_LABELS[task.priority || "medium"]}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status || "pending"]}`}>
                          {STATUS_LABELS[task.status || "pending"]}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {task.employeeName}
                        </span>
                      </div>
                      <h3 className={`font-medium ${task.status === "completed" ? "line-through text-gray-400" : ""}`}>
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      )}
                      {task.dueDate && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          期限: {task.dueDate}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Select
                        value={task.status || "pending"}
                        onValueChange={(v) => handleStatusChange(task.id, v as "pending" | "in_progress" | "completed")}
                      >
                        <SelectTrigger className="h-8 text-xs w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">未着手</SelectItem>
                          <SelectItem value="in_progress">進行中</SelectItem>
                          <SelectItem value="completed">完了</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm("このタスクを削除しますか？")) {
                            deleteMutation.mutate({ token: adminToken, id: task.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
