import type { ComponentType, ReactNode } from "react";

interface EmptyStateProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="glass rounded-2xl p-12 text-center hairline">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-base-content/5 text-base-content/40 mb-4">
        <Icon size={32} />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="text-sm text-base-content/60 mt-2 max-w-md mx-auto">{description}</p>}
      {children && <div className="mt-6 flex items-center justify-center gap-2">{children}</div>}
    </div>
  );
}
