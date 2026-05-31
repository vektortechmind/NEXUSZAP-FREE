import React from "react";

type AppShellProps = {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell({ sidebar, header, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_20rem),var(--nexus-bg)] text-[var(--nexus-text)]">
      {sidebar}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col xl:pl-72">
        {header}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
