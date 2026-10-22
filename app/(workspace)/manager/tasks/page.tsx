import { Suspense } from "react";
import { UserRole } from "@/generated/prisma/client";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { getTaskFormOptions, getTasks } from "@/lib/tasks";
import { requireRole } from "@/lib/authz";

export default function ManagerTasksPage() {
  return <Suspense fallback={<main className="min-h-[60vh]" />}><ManagerTasksContent /></Suspense>;
}

async function ManagerTasksContent() {
  await requireRole(UserRole.MANAGER);
  const [initialData, options] = await Promise.all([getTasks(), getTaskFormOptions()]);
  return <TasksWorkspace role="MANAGER" initialData={initialData} options={options} />;
}
