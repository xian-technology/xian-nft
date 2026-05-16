import type { ComponentType, ReactNode } from "react";

interface EmptyStateProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="glass rounded-2xl p-10 text-center">
      <div className="empty-icon mb-4">
        <Icon size={28} />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && (
        <p className="text-sm text-base-content/60 mt-2 max-w-md mx-auto">{description}</p>
      )}
      {children && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div>
      )}
    </div>
  );
}
