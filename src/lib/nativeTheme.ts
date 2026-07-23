import { isTauri } from "@tauri-apps/api/core";

import type { ResolvedScheme } from "@/lib/storage";

// The window controls are drawn by the OS, which cannot see the stylesheet, so
// a dark reader inside a light-appearance window leaves them near-invisible
// until hover. `null` hands the choice back to the OS, which is what following
// the system means. On macOS this is app-wide rather than per window.
export async function syncNativeTheme(scheme: ResolvedScheme | null): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setTheme(scheme);
}
