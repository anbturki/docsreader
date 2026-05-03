interface Props {
  data: Record<string, unknown>;
}

export function Frontmatter({ data }: Props) {
  if (Object.keys(data).length === 0) return null;
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        Frontmatter
      </summary>
      <pre className="mt-1 bg-muted border rounded-md p-2 overflow-x-auto text-[11px]">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}
