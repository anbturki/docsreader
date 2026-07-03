import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { addConvertDeclined, loadConvertDeclined } from "@/lib/storage";
import type { RootScan } from "./useLibrary";

export interface ConvertPrompt {
  /** Root the prompt should currently show for, if any. */
  candidateRoot: string | undefined;
  convert: () => Promise<void>;
  declineRoot: (root: string) => void;
}

export function useConvertPrompt(
  activeRoot: string | undefined,
  activeScan: RootScan | undefined,
  rescan: (root: string) => Promise<void>
): ConvertPrompt {
  const [declined, setDeclined] = useState<string[] | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadConvertDeclined().then(setDeclined);
  }, []);

  // Only a scan finished this session is conclusive; cache-hydrated results
  // may predate an external conversion and would flash the dialog.
  const candidateRoot =
    declined !== undefined &&
    !busy &&
    activeRoot !== undefined &&
    activeScan !== undefined &&
    !activeScan.scanning &&
    activeScan.finishedAt !== undefined &&
    !activeScan.result.marker &&
    !declined.includes(activeRoot)
      ? activeRoot
      : undefined;

  const convert = useCallback(async () => {
    if (!candidateRoot) return;
    setBusy(true);
    try {
      await invoke("convert_workspace", { path: candidateRoot });
      await rescan(candidateRoot);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      void message(`Could not convert this folder.\n\n${detail}`, {
        title: "Convert to workspace",
        kind: "error",
      });
    } finally {
      setBusy(false);
    }
  }, [candidateRoot, rescan]);

  const declineRoot = useCallback((root: string) => {
    setDeclined((prev) => (prev?.includes(root) ? prev : [...(prev ?? []), root]));
    void addConvertDeclined(root);
  }, []);

  return { candidateRoot, convert, declineRoot };
}
