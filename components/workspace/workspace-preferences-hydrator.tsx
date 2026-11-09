
import { useEffect } from "react";

import { useWorkspacePreferences } from "@/components/workspace/workspace-preferences-context";
import type { SettingsDensity } from "@/generated/prisma/browser";

export function WorkspacePreferencesHydrator({
  density,
  soundAlerts,
}: {
  density: SettingsDensity;
  soundAlerts: boolean;
}) {
  const { setDensity, setSoundAlerts } = useWorkspacePreferences();

  useEffect(() => {
    setDensity(density);
    setSoundAlerts(soundAlerts);
  }, [density, setDensity, setSoundAlerts, soundAlerts]);

  return null;
}
