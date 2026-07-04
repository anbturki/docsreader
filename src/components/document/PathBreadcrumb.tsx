import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface Props {
  relPath: string;
  onSegmentClick: (segment: string) => void;
}

export function PathBreadcrumb({ relPath, onSegmentClick }: Props) {
  const segments = relPath.split(/[\\/]/).filter(Boolean);
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap gap-1 text-xs">
        {segments.map((segment, i) => {
          const isLast = i === segments.length - 1;
          return (
            <Fragment key={i}>
              <BreadcrumbItem className="min-w-0">
                {isLast ? (
                  <BreadcrumbPage className="truncate font-normal text-muted-foreground">
                    {segment}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    className="cursor-pointer hover:text-foreground truncate"
                    onClick={() => onSegmentClick(segment)}
                  >
                    {segment}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
