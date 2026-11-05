import { TABS_NAVEGACAO } from '@/constants';

interface WeekTabsProps {
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
}

export default function WeekTabs({ selectedTab, setSelectedTab }: WeekTabsProps) {
  return (
    <div className="week-tabs">
      {TABS_NAVEGACAO.map((tab) => {
        const isSelected = selectedTab === tab.value;
        return (
          <button 
            key={tab.value} 
            onClick={() => setSelectedTab(tab.value)} 
            className={isSelected ? 'week-tab week-tab-active' : 'week-tab'}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}