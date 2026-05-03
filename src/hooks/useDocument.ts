import { useCallback, useEffect, useRef, useState } from "react";
import { readTextFile, watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { parseFrontmatter } from "@/lib/scan";
import { describeEventKind } from "@/lib/events";

export interface Document {
  selectedPath: string | undefined;
  content: string;
  meta: Record<string, unknown>;
  error: string | undefined;
  loading: boolean;
  openFile: (path: string) => Promise<void>;
}

export function useDocument(): Document {
  const [selectedPath, setSelectedPath] = useState<string | undefined>();
  const [content, setContent] = useState("");
  const [meta, setMeta] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const selectedPathRef = useRef<string | undefined>(undefined);
  selectedPathRef.current = selectedPath;

  const reloadFile = useCallback(async (path: string, withSpinner = true) => {
    if (withSpinner) setLoading(true);
    setError(undefined);
    try {
      const raw = await readTextFile(path);
      const { data, content: body } = parseFrontmatter(raw);
      setMeta(data);
      setContent(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setContent("");
      setMeta({});
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, []);

  const openFile = useCallback(
    async (path: string) => {
      setSelectedPath(path);
      await reloadFile(path);
    },
    [reloadFile]
  );

  useEffect(() => {
    if (!selectedPath) return;

    let unwatch: UnwatchFn | null = null;
    let cancelled = false;
    const target = selectedPath;

    (async () => {
      try {
        unwatch = await watch(
          target,
          (event) => {
            if (cancelled) return;
            const kind = describeEventKind(event.type);
            if (kind === "remove" || kind === "access") return;
            if (selectedPathRef.current === target) void reloadFile(target, false);
          },
          { recursive: false, delayMs: 400 }
        );
      } catch (err) {
        console.error("watch failed", err);
      }
    })();

    return () => {
      cancelled = true;
      if (unwatch) void unwatch();
    };
  }, [selectedPath, reloadFile]);

  return { selectedPath, content, meta, error, loading, openFile };
}
