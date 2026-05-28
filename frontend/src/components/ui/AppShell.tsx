import React from "react";

type AppShellProps = {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell({ sidebar, header, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-[var(--nexus-bg)] text-[var(--nexus-text)]">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {header}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
