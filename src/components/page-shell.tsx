import type { ReactNode } from "react";
import { Construction } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="registry-enter registry-rule flex flex-col gap-4 border-b border-border pb-5 sm:pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl min-w-0">
        {eyebrow && <p className="text-eyebrow mb-1.5 sm:mb-2">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl break-words tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground break-words">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

export function ComingSoon({ note }: { note: string }) {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center shadow-panel">
      <span className="mx-auto flex size-11 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <Construction className="size-5" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-foreground">Coming soon</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{note}</p>
    </div>
  );
}

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  note,
}: {
  eyebrow: string;
  title: string;
  description: string;
  note: string;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <ComingSoon note={note} />
    </div>
  );
}
