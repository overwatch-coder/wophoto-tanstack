export type DashboardKPI = {
  activeTasksPerPerson: number;
  activeTasksBenchmark: number;
  teamProductivity: number;
  avgTaskDurationDays: number;
  onTimeDeliveryRate: number;
  workloadBalanceIndex: number;
};

export type WeeklyLoadCell = {
  month: string;
  isCurrent?: boolean;
  week1: number;
  week2: number;
  week3: number;
  week4: number;
};

export type ServiceWorkload = {
  service: string;
  total: number;
  open: number;
  late: number;
  onTime: number;
  avgTime: string;
};

export type CollaboratorPerformance = {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  initials: string;
  completedTasks: number;
  avgDurationDays: number;
  onTimeRate: number;
  activeTasks: number;
  capacityStatus: "optimal" | "heavy" | "light";
};
