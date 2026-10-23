import { Suspense } from "react";
import { UserRole } from "@/generated/prisma/client";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { getTaskFormOptions, getTasks } from "@/lib/tasks";
import { requireRole } from "@/lib/authz";
import { parsePage } from "@/lib/pagination";

export default function ManagerTasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<main className="min-h-[60vh]" />}><ManagerTasksContent searchParams={searchParams} /></Suspense>;
}

async function ManagerTasksContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole(UserRole.MANAGER);
  const params = await searchParams;
  const [initialData, options] = await Promise.all([getTasks({ page: parsePage(params.page), status: first(params.status), priority: first(params.priority) }), getTaskFormOptions()]);
  return <TasksWorkspace role="MANAGER" initialData={initialData} options={options} searchParams={params} />;
}

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
