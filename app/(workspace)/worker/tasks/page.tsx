import { Suspense } from "react";
import { UserRole } from "@/generated/prisma/client";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { getTaskFormOptions, getTasks } from "@/lib/tasks";
import { requireRole } from "@/lib/authz";

export default function WorkerTasksPage() {
  return <Suspense fallback={<main className="min-h-[60vh]" />}><WorkerTasksContent /></Suspense>;
}

async function WorkerTasksContent() {
  await requireRole(UserRole.WORKER);
  const [initialData, options] = await Promise.all([getTasks(), getTaskFormOptions()]);
  return <TasksWorkspace role="WORKER" initialData={initialData} options={options} />;
}
