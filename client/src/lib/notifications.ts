// Chrome通知機能

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("このブラウザは通知をサポートしていません");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

export function showNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === "granted") {
    new Notification(title, {
      icon: "/logo.png",
      badge: "/logo.png",
      ...options,
    });
  }
}

export function notifyTaskAdded(taskTitle: string, assignedBy?: string) {
  showNotification("新しいタスクが割り当てられました", {
    body: assignedBy 
      ? `${assignedBy}から「${taskTitle}」が割り当てられました`
      : `「${taskTitle}」が割り当てられました`,
    tag: "task-added",
  });
}

export function notifyTaskStatusUpdated(taskTitle: string, newStatus: string) {
  const statusText = 
    newStatus === "completed" ? "完了" :
    newStatus === "in_progress" ? "進行中" :
    "未着手";
  
  showNotification("タスクステータスが更新されました", {
    body: `「${taskTitle}」が${statusText}に変更されました`,
    tag: "task-status-updated",
  });
}
