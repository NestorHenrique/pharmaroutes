import { TABS_NAVEGACAO } from '@/constants';

interface WeekTabsProps {
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
}

export default function WeekTabs({ selectedTab, setSelectedTab }: WeekTabsProps) {
  return (
    <div
      role="group"
      aria-label="Filtrar por dia da semana"
      className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-900/80 p-1.5 backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {TABS_NAVEGACAO.map((tab) => {
        const isSelected = selectedTab === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => setSelectedTab(tab.value)}
            aria-pressed={isSelected}
            className={`min-h-10 min-w-14 flex-1 whitespace-nowrap rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 ${
              isSelected
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-950/40'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
