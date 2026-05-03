import { useCallback, useEffect, useState } from "react";
import {
  defaultViewSettings,
  loadViewSettings,
  saveViewSettings,
  type ViewSettings,
} from "@/lib/storage";

export interface ViewSettingsHook {
  settings: ViewSettings;
  update: (next: ViewSettings) => void;
}

export function useViewSettings(): ViewSettingsHook {
  const [settings, setSettings] = useState<ViewSettings>(defaultViewSettings);

  useEffect(() => {
    void loadViewSettings().then(setSettings);
  }, []);

  const update = useCallback((next: ViewSettings) => {
    setSettings(next);
    void saveViewSettings(next);
  }, []);

  return { settings, update };
}
