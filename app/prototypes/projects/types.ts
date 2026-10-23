export type ProjectStatus = "PLANNING" | "IN_PROGRESS" | "REVIEW" | "COMPLETED";

export type ProjectClient = {
  id: string;
  name: string;
  email: string;
  company?: string;
  avatarColor?: string;
};

export type PrototypeProject = {
  id: string;
  name: string;
  description: string;
  client: ProjectClient;
  status: ProjectStatus;
  category: "Wedding" | "Commercial" | "Editorial" | "Portrait" | "Event";
  totalTasks: number;
  completedTasks: number;
  dueDate: string;
  updatedAt: string;
};
