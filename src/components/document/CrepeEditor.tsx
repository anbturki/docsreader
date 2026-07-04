import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type KeyboardEvent,
} from "react";
import { Crepe } from "@milkdown/crepe";
import { FONT_SIZE_PX, type FontSize } from "@/lib/storage";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "./crepe-theme.css";

export interface CrepeEditorHandle {
  // The current markdown plus whether it differs from what loaded, or null
  // while the editor is not ready. Guards getMarkdown, which has no
  // created-state check and would throw if called before create() resolves.
  getResult: () => { markdown: string; dirty: boolean } | null;
}

interface Props {
  initialMarkdown: string;
  fontSize: FontSize;
  onRequestSave: () => void;
  onCancel: () => void;
  onReadyChange: (ready: boolean) => void;
}

export const CrepeEditor = forwardRef<CrepeEditorHandle, Props>(function CrepeEditor(
  { initialMarkdown, fontSize, onRequestSave, onCancel, onReadyChange },
  ref
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const readyRef = useRef(false);
  // Markdown Crepe reports right after load, once its serializer has
  // normalised the source. Comparing against it tells "unchanged" from
  // "edited", so an untouched doc is never rewritten or reformatted.
  const baselineRef = useRef(initialMarkdown);

  useImperativeHandle(
    ref,
    () => ({
      getResult: () => {
        const crepe = crepeRef.current;
        if (!crepe || !readyRef.current) return null;
        const markdown = crepe.getMarkdown();
        return { markdown, dirty: markdown !== baselineRef.current };
      },
    }),
    []
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const crepe = new Crepe({
      root: host,
      defaultValue: initialMarkdown,
      features: { [Crepe.Feature.AI]: false },
    });
    crepeRef.current = crepe;
    let created = false;
    let disposed = false;
    crepe
      .create()
      .then(() => {
        created = true;
        if (disposed) {
          void crepe.destroy();
          return;
        }
        baselineRef.current = crepe.getMarkdown();
        readyRef.current = true;
        onReadyChange(true);
      })
      .catch((err) => console.error("editor init failed", err));
    return () => {
      disposed = true;
      readyRef.current = false;
      crepeRef.current = null;
      onReadyChange(false);
      if (created) void crepe.destroy();
    };
  }, [initialMarkdown, onReadyChange]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      onRequestSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      ref={hostRef}
      onKeyDown={onKeyDown}
      className="crepe-host"
      style={{ fontSize: `${FONT_SIZE_PX[fontSize]}px` }}
      aria-label="Edit document"
    />
  );
});
