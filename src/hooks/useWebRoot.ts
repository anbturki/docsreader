import { useEffect, useState } from "react";
import { exists } from "@tauri-apps/plugin-fs";

const CONVENTION_DIRS = ["public", "static"] as const;

export function useWebRoot(rootPath: string | undefined): string | undefined {
  const [webRoot, setWebRoot] = useState<string | undefined>();

  useEffect(() => {
    setWebRoot(undefined);
    if (!rootPath) return;
    let cancelled = false;
    (async () => {
      for (const dir of CONVENTION_DIRS) {
        const candidate = `${rootPath}/${dir}`;
        try {
          if (await exists(candidate)) {
            if (!cancelled) setWebRoot(candidate);
            return;
          }
        } catch {
          // ignore - fall through
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootPath]);

  return webRoot;
}
