import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

interface Props {
  hasRoots: boolean;
}

export function EmptyDocument({ hasRoots }: Props) {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyTitle>Pick a file to start reading</EmptyTitle>
        <EmptyDescription>
          {hasRoots
            ? "Select a file from the tree on the left."
            : "Add a folder of markdown files using the sidebar."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
