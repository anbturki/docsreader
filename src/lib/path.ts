export function dirname(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx > 0 ? path.slice(0, idx) : path;
}

export function isAbsolute(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}

export function normalizeJoin(dir: string, rel: string): string {
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  const parts = (dir + sep + rel).split(/[/\\]+/);
  const stack: string[] = [];
  const leadingSlash = dir.startsWith("/");
  for (const p of parts) {
    if (p === "..") stack.pop();
    else if (p && p !== ".") stack.push(p);
  }
  const joined = stack.join(sep);
  return leadingSlash ? "/" + joined : joined;
}

export function basename(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx >= 0 ? path.slice(idx + 1) : path;
}
