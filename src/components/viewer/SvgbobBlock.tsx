import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  code: string;
}

let bobPromise: Promise<typeof import("bob-wasm").default> | undefined;

function loadBob() {
  if (!bobPromise) {
    bobPromise = import("bob-wasm").then(async (m) => {
      const bob = m.default;
      await bob.loadWASM();
      return bob;
    });
  }
  return bobPromise;
}

export function SvgbobBlock({ code }: Props) {
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setError(undefined);
    setSvg(undefined);
    void (async () => {
      try {
        const bob = await loadBob();
        const rendered = bob.render(code);
        if (!cancelled) setSvg(rendered);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

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
