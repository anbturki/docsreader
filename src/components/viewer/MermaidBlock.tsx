import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

interface Props {
  code: string;
}

let mermaidPromise: Promise<typeof import("mermaid").default> | undefined;
let lastTheme: "dark" | "default" | undefined;

function applyTheme(mermaid: typeof import("mermaid").default, isDark: boolean) {
  const theme = isDark ? "dark" : "default";
  if (lastTheme === theme) return;
  lastTheme = theme;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme,
  });
}

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      const mermaid = m.default;
      applyTheme(mermaid, document.documentElement.classList.contains("dark"));
      return mermaid;
    });
  }
  return mermaidPromise;
}

let darkVersion = 0;
const darkSubscribers = new Set<() => void>();
let darkObserver: MutationObserver | undefined;

function ensureDarkObserver() {
  if (darkObserver) return;
  darkObserver = new MutationObserver(() => {
    darkVersion++;
    darkSubscribers.forEach((cb) => cb());
  });
  darkObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

function subscribeDark(cb: () => void): () => void {
  ensureDarkObserver();
  darkSubscribers.add(cb);
  return () => {
    darkSubscribers.delete(cb);
  };
}

function getDarkSnapshot(): number {
  return darkVersion;
}

export function MermaidBlock({ code }: Props) {
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();
  const idRef = useRef(`mmd-${Math.random().toString(36).slice(2, 9)}`);
  const themeVersion = useSyncExternalStore(subscribeDark, getDarkSnapshot);

  useEffect(() => {
    let cancelled = false;
    setError(undefined);
    setSvg(undefined);
    void (async () => {
      try {
        const mermaid = await loadMermaid();
        applyTheme(mermaid, document.documentElement.classList.contains("dark"));
        const { svg: rendered } = await mermaid.render(idRef.current, code);
        if (!cancelled) setSvg(rendered);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, themeVersion]);

  if (error) {
    return (
      <pre className="my-5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
        {error}
      </pre>
    );
  }
  if (!svg) {
    return (
      <div className="my-5 flex justify-center text-xs text-muted-foreground">
        Rendering diagram…
      </div>
    );
  }
  return (
    <div
      className={cn("my-5 flex justify-center overflow-x-auto")}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
