"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { SettingsDensity } from "@/generated/prisma/browser";

type WorkspacePreferences = {
  density: SettingsDensity;
  soundAlerts: boolean;
  setDensity: (density: SettingsDensity) => void;
  setSoundAlerts: (enabled: boolean) => void;
};

const WorkspacePreferencesContext = createContext<WorkspacePreferences | null>(null);

export function WorkspacePreferencesProvider({
  children,
  initialDensity,
  initialSoundAlerts,
}: {
  children: ReactNode;
  initialDensity: SettingsDensity;
  initialSoundAlerts: boolean;
}) {
  const [density, setDensity] = useState(initialDensity);
  const [soundAlerts, setSoundAlerts] = useState(initialSoundAlerts);
  const value = useMemo(
    () => ({ density, soundAlerts, setDensity, setSoundAlerts }),
    [density, soundAlerts],
  );

  return (
    <WorkspacePreferencesContext.Provider value={value}>
      {children}
    </WorkspacePreferencesContext.Provider>
  );
}

export function useWorkspacePreferences() {
  const preferences = useContext(WorkspacePreferencesContext);
  if (!preferences) {
    throw new Error("Workspace preferences are only available inside the workspace shell.");
  }
  return preferences;
}
