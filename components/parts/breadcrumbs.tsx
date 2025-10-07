import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import Icon from "@/public/icon.svg";

interface BreadcrumbItem {
  name: string;
  href: string;
}

export const Breadcrumbs = ({ 
  pageName, 
  isLoading, 
  breadcrumbs 
}: { 
  pageName?: string, 
  isLoading?: boolean,
  breadcrumbs?: BreadcrumbItem[]
}) => {
  return (
    <Breadcrumb className="h-[67.63px] bg-muted/50 rounded-lg border flex items-center justify-between p-6">
      <BreadcrumbList>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <>
            {breadcrumbs.map((item, index) => (
              <div key={item.href} className="flex items-center">
                <BreadcrumbItem>
                  {index === breadcrumbs.length - 1 ? (
                    <BreadcrumbPage className="px-2 py-1 border bg-background rounded-sm">
                      {isLoading ? (
                        <Skeleton className="h-5 w-20" />
                      ) : (
                        <BreadcrumbLink>{item.name}</BreadcrumbLink>
                      )}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={item.href}>{item.name}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
              </div>
            ))}
          </>
        ) : (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbPage className="px-2 py-1 border bg-background rounded-sm">
              {isLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                <BreadcrumbLink>{pageName || "Dashboard"}</BreadcrumbLink>
              )}
            </BreadcrumbPage>
          </>
        )}
      </BreadcrumbList>
      <Image
        className="hover:animate-spin dark:invert"
        src={Icon}
        width={24}
        height={24}
        alt="ART Automatic Red Teaming Icon"
      />
    </Breadcrumb>
  );
};
