export type FsEventKind =
  | "create"
  | "remove"
  | "modify"
  | "rename"
  | "access"
  | "any"
  | "other";

export function describeEventKind(type: unknown): FsEventKind {
  if (type === "any") return "any";
  if (type === "other") return "other";
  if (typeof type !== "object" || type === null) return "other";
  if ("create" in type) return "create";
  if ("remove" in type) return "remove";
  if ("modify" in type) {
    const modify = (type as { modify: unknown }).modify;
    if (typeof modify === "object" && modify !== null && "kind" in modify) {
      const kind = (modify as { kind: unknown }).kind;
      if (kind === "rename") return "rename";
    }
    return "modify";
  }
  if ("access" in type) return "access";
  return "other";
}
