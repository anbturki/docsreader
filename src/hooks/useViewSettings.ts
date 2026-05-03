import { useCallback, useEffect, useRef, useState } from "react";
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
  const [hydrated, setHydrated] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const persistTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    void loadViewSettings().then((s) => {
      setSettings(s);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void saveViewSettings(settingsRef.current);
    }, 250);
  }, [settings, hydrated]);

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  const update = useCallback((next: ViewSettings) => {
    setSettings(next);
  }, []);

  return { settings, update };
}
