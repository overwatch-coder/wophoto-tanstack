import {
  Bell,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FolderSearch,
  FolderKanban,
  Image,
  LayoutDashboard,
  ListTodo,
  MessageSquareText,
  Settings2,
  Star,
  Trash2,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";

export type WorkspaceRole = "MANAGER" | "WORKER" | "CLIENT";

export type WorkspaceNavigationItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  group: "primary" | "work" | "resources" | "operations" | "archive" | "communication" | "admin" | "account";
};

export const workspaceNavigation: Record<WorkspaceRole, WorkspaceNavigationItem[]> = {
  MANAGER: [
    { title: "Dashboard", href: "/manager", icon: LayoutDashboard, group: "primary" },
    { title: "Projects", href: "/manager/projects", icon: FolderKanban, group: "work" },
    { title: "Tasks", href: "/manager/tasks", icon: ListTodo, group: "work" },
    { title: "Schedule", href: "/manager/schedule", icon: CalendarDays, group: "work" },
    { title: "Brief Review", href: "/manager/brief-review", icon: ClipboardCheck, group: "work" },
    { title: "Explore Briefs", href: "/manager/explore-briefs", icon: FolderSearch, group: "work" },
    { title: "Reviews", href: "/manager/reviews", icon: Star, group: "work" },
    { title: "Work Requests", href: "/manager/work-requests", icon: ClipboardList, group: "work" },
    { title: "Brand Assets", href: "/manager/brand-assets", icon: Image, group: "resources" },
    { title: "Inventory", href: "/manager/inventory", icon: Boxes, group: "operations" },
    { title: "Deleted Tasks", href: "/manager/deleted-tasks", icon: Trash2, group: "archive" },
    { title: "Notifications", href: "/manager/notifications", icon: Bell, group: "communication" },
    { title: "Team Invitations", href: "/manager/invitations", icon: UserRoundPlus, group: "admin" },
    { title: "Settings", href: "/settings", icon: Settings2, group: "account" },
  ],
  WORKER: [
    { title: "Dashboard", href: "/worker", icon: LayoutDashboard, group: "primary" },
    { title: "My Tasks", href: "/worker/tasks", icon: ListTodo, group: "work" },
    { title: "Schedule", href: "/worker/schedule", icon: CalendarDays, group: "work" },
    { title: "Brief Review", href: "/worker/brief-review", icon: ClipboardCheck, group: "work" },
    { title: "Explore Briefs", href: "/worker/explore-briefs", icon: FolderSearch, group: "work" },
    { title: "Reviews", href: "/worker/reviews", icon: Star, group: "work" },
    { title: "Brand Assets", href: "/worker/brand-assets", icon: Image, group: "resources" },
    { title: "Inventory", href: "/worker/inventory", icon: Boxes, group: "resources" },
    { title: "Notifications", href: "/worker/notifications", icon: Bell, group: "communication" },
    { title: "Settings", href: "/settings", icon: Settings2, group: "account" },
  ],
  CLIENT: [
    { title: "Dashboard", href: "/client", icon: LayoutDashboard, group: "primary" },
    { title: "Project Feedback", href: "/client/project-feedback", icon: MessageSquareText, group: "work" },
    { title: "Work Requests", href: "/client/work-requests", icon: ClipboardList, group: "work" },
    { title: "Notifications", href: "/client/notifications", icon: Bell, group: "communication" },
    { title: "Settings", href: "/settings", icon: Settings2, group: "account" },
  ],
};

export function getWorkspaceNavigationGroups(role: WorkspaceRole) {
  const groups: WorkspaceNavigationItem[][] = [];
  for (const item of workspaceNavigation[role]) {
    const previous = groups.at(-1);
    if (previous?.[0]?.group === item.group) previous.push(item);
    else groups.push([item]);
  }
  return groups;
}

export function isWorkspaceRole(role: string): role is WorkspaceRole {
  return role === "MANAGER" || role === "WORKER" || role === "CLIENT";
}

export function getWorkspaceHome(role: WorkspaceRole) {
  switch (role) {
    case "MANAGER":
      return "/manager";
    case "WORKER":
      return "/worker";
    case "CLIENT":
      return "/client";
  }
}

export function matchesWorkspacePath(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/manager" || href === "/worker" || href === "/client") {
    return false;
  }
  return pathname.startsWith(`${href}/`);
}

export function getWorkspacePageTitle(role: WorkspaceRole, pathname: string) {
  const item = workspaceNavigation[role].find(
    (navigationItem) => matchesWorkspacePath(pathname, navigationItem.href)
  );

  return item?.title ?? "Workspace";
}
