import type {
  DashboardKPI,
  WeeklyLoadCell,
  ServiceWorkload,
  CollaboratorPerformance,
} from "./types";

export const mockKPIs: DashboardKPI = {
  activeTasksPerPerson: 11.1,
  activeTasksBenchmark: 8.0,
  teamProductivity: 1.0,
  avgTaskDurationDays: 2.4,
  onTimeDeliveryRate: 84.7,
  workloadBalanceIndex: 7.89,
};

export function getTrailingMonthsWeeklyLoad(): WeeklyLoadCell[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();

  const baselines = [
    { w1: 18.5, w2: 32.0, w3: 27.5, w4: 22.0 },
    { w1: 24.0, w2: 28.5, w3: 31.0, w4: 16.5 },
    { w1: 30.0, w2: 25.0, w3: 25.0, w4: 20.0 },
    { w1: 15.0, w2: 35.0, w3: 30.0, w4: 20.0 },
    { w1: 22.5, w2: 27.5, w3: 32.5, w4: 17.5 },
    { w1: 28.0, w2: 34.0, w3: 23.0, w4: 15.0 },
  ];

  const result: WeeklyLoadCell[] = [];
  for (let offset = 5; offset >= 0; offset--) {
    const d = new Date(currentYear, currentMonthIdx - offset, 1);
    const monthShort = d.toLocaleDateString("en-US", { month: "short" });
    const isCurrent = offset === 0;
    const base = baselines[5 - offset];
    result.push({
      month: monthShort,
      isCurrent,
      week1: base.w1,
      week2: base.w2,
      week3: base.w3,
      week4: base.w4,
    });
  }
  return result;
}

export const mockWeeklyLoad: WeeklyLoadCell[] = getTrailingMonthsWeeklyLoad();

export const mockServiceWorkloads: ServiceWorkload[] = [
  { service: "Photography", total: 326, open: 68, late: 42, onTime: 216, avgTime: "2.3 D" },
  { service: "Videography", total: 185, open: 27, late: 32, onTime: 126, avgTime: "2.8 D" },
  { service: "Content Creation", total: 66, open: 6, late: 11, onTime: 49, avgTime: "1.2 D" },
  { service: "Graphic Design", total: 37, open: 10, late: 6, onTime: 21, avgTime: "1.9 D" },
  { service: "Post Production", total: 19, open: 3, late: 2, onTime: 14, avgTime: "2.5 D" },
];

export const mockCollaborators: CollaboratorPerformance[] = [
  {
    id: "collab-1",
    name: "Ilyass Bessal",
    role: "Senior Multimedia Officer · Content Creation",
    initials: "IB",
    completedTasks: 72,
    avgDurationDays: 2.6,
    onTimeRate: 77.8,
    activeTasks: 38,
    capacityStatus: "heavy",
  },
  {
    id: "collab-2",
    name: "Abdelaziz Ourkiya",
    role: "Multimedia Officer · Lead Photographer",
    initials: "AO",
    completedTasks: 56,
    avgDurationDays: 3.2,
    onTimeRate: 89.3,
    activeTasks: 13,
    capacityStatus: "optimal",
  },
  {
    id: "collab-3",
    name: "Amine Azmi",
    role: "Motion & Graphic Designer",
    initials: "AA",
    completedTasks: 53,
    avgDurationDays: 1.7,
    onTimeRate: 90.6,
    activeTasks: 5,
    capacityStatus: "light",
  },
  {
    id: "collab-4",
    name: "Boutaina Cheraibi",
    role: "Videographer & Video Editor",
    initials: "BC",
    completedTasks: 51,
    avgDurationDays: 1.8,
    onTimeRate: 80.4,
    activeTasks: 26,
    capacityStatus: "heavy",
  },
  {
    id: "collab-5",
    name: "Imad Ouzrar",
    role: "Senior Multimedia Services Officer",
    initials: "IO",
    completedTasks: 41,
    avgDurationDays: 1.2,
    onTimeRate: 97.6,
    activeTasks: 8,
    capacityStatus: "optimal",
  },
  {
    id: "collab-6",
    name: "Bright Aboagye-Asare",
    role: "Masters in Media & Production Management",
    initials: "BA",
    completedTasks: 35,
    avgDurationDays: 0.9,
    onTimeRate: 91.4,
    activeTasks: 14,
    capacityStatus: "optimal",
  },
  {
    id: "collab-7",
    name: "Mehdi Bellafdil",
    role: "Visual Content & Lighting Specialist",
    initials: "MB",
    completedTasks: 28,
    avgDurationDays: 3.7,
    onTimeRate: 75.0,
    activeTasks: 10,
    capacityStatus: "optimal",
  },
  {
    id: "collab-8",
    name: "Aymen Erraoui",
    role: "Photography Assistant",
    initials: "AE",
    completedTasks: 23,
    avgDurationDays: 11.7,
    onTimeRate: 65.2,
    activeTasks: 14,
    capacityStatus: "heavy",
  },
  {
    id: "collab-9",
    name: "Wissam Essaiydy",
    role: "Technical Crew & Production Support",
    initials: "WE",
    completedTasks: 18,
    avgDurationDays: 3.6,
    onTimeRate: 72.2,
    activeTasks: 12,
    capacityStatus: "optimal",
  },
  {
    id: "collab-10",
    name: "Ayoub Hamou",
    role: "Videography Assistant",
    initials: "AH",
    completedTasks: 6,
    avgDurationDays: 11.9,
    onTimeRate: 66.7,
    activeTasks: 12,
    capacityStatus: "optimal",
  },
];
