import {
  Bell,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  FolderSearch,
  Image,
  LayoutDashboard,
  ListTodo,
  MessageSquareText,
  Star,
  Trash2,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";

export type WorkspaceRole = "MANAGER" | "WORKER" | "CLIENT";

export type WorkspaceNavigationItem = {
  title: string;
  href: string | null;
  status: "available" | "coming-soon";
  icon: LucideIcon;
};

export const workspaceNavigation: Record<WorkspaceRole, WorkspaceNavigationItem[]> = {
  MANAGER: [
    { title: "Dashboard", href: null, status: "coming-soon", icon: LayoutDashboard },
    { title: "Tasks", href: null, status: "coming-soon", icon: ListTodo },
    { title: "Brief Review", href: null, status: "coming-soon", icon: ClipboardCheck },
    { title: "Deleted Tasks", href: null, status: "coming-soon", icon: Trash2 },
    { title: "Brand Assets", href: null, status: "coming-soon", icon: Image },
    { title: "Notifications", href: null, status: "coming-soon", icon: Bell },
    { title: "Explore Briefs", href: null, status: "coming-soon", icon: FolderSearch },
    { title: "Reviews", href: null, status: "coming-soon", icon: Star },
    { title: "Inventory", href: null, status: "coming-soon", icon: Boxes },
    { title: "Schedule", href: null, status: "coming-soon", icon: CalendarDays },
    { title: "Team Invitations", href: "/manager/invitations", status: "available", icon: UserRoundPlus },
  ],
  WORKER: [
    { title: "Workspace", href: "/worker", status: "available", icon: LayoutDashboard },
    { title: "My Tasks", href: null, status: "coming-soon", icon: ListTodo },
    { title: "Brief Review", href: null, status: "coming-soon", icon: ClipboardCheck },
    { title: "Brand Assets", href: null, status: "coming-soon", icon: Image },
    { title: "Notifications", href: null, status: "coming-soon", icon: Bell },
    { title: "Reviews", href: null, status: "coming-soon", icon: Star },
    { title: "Schedule", href: null, status: "coming-soon", icon: CalendarDays },
  ],
  CLIENT: [
    { title: "Dashboard", href: "/client", status: "available", icon: LayoutDashboard },
    { title: "Project Feedback", href: null, status: "coming-soon", icon: MessageSquareText },
    { title: "Notifications", href: null, status: "coming-soon", icon: Bell },
  ],
};

export function isWorkspaceRole(role: string): role is WorkspaceRole {
  return role === "MANAGER" || role === "WORKER" || role === "CLIENT";
}

export function getWorkspaceHome(role: WorkspaceRole) {
  switch (role) {
    case "MANAGER":
      return "/manager/invitations";
    case "WORKER":
      return "/worker";
    case "CLIENT":
      return "/client";
  }
}

export function matchesWorkspacePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getWorkspacePageTitle(role: WorkspaceRole, pathname: string) {
  const item = workspaceNavigation[role].find(
    (navigationItem) =>
      navigationItem.href !== null && matchesWorkspacePath(pathname, navigationItem.href)
  );

  return item?.title ?? "Workspace";
}
