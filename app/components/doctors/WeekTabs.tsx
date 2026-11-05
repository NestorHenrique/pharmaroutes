import { TABS_NAVEGACAO } from '@/constants';

interface WeekTabsProps {
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
}

export default function WeekTabs({ selectedTab, setSelectedTab }: WeekTabsProps) {
  return (
    <div style={{ display: 'flex', backgroundColor: '#141414', padding: '6px', borderRadius: '16px', marginBottom: '20px', border: '1px solid #27272A' }}>
      {TABS_NAVEGACAO.map((tab) => {
        const isSelected = selectedTab === tab.value;
        return (
          <button 
            key={tab.value} 
            onClick={() => setSelectedTab(tab.value)} 
            style={{ 
              flex: 1, padding: '10px 0', borderRadius: '12px', border: 'none', 
              backgroundColor: isSelected ? '#27272A' : 'transparent', 
              color: isSelected ? '#FFFFFF' : '#71717A', 
              fontWeight: isSelected ? 600 : 500, fontSize: '12px', 
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer',
              boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}