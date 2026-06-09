import type { ChatInstanceOption } from "./types";

type FilterDropdownProps = {
  instances: ChatInstanceOption[];
  value: string;
  onChange: (value: string) => void;
};

export function FilterDropdown({ instances, value, onChange }: FilterDropdownProps) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      Instancia
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <option value="all">Todas</option>
        {instances.map((instance) => (
          <option key={instance.id} value={instance.id}>{instance.name}</option>
        ))}
      </select>
    </label>
  );
}
