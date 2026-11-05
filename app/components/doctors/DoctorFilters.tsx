interface DoctorFiltersProps {
  cities: string[];
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  selectedShiftFilter: string;
  setSelectedShiftFilter: (shift: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export default function DoctorFilters({ cities, selectedCity, setSelectedCity, selectedShiftFilter, setSelectedShiftFilter, searchTerm, setSearchTerm }: DoctorFiltersProps) {
  const inputStyle = { padding: '14px 16px', backgroundColor: '#141414', color: '#FAFAFA', borderRadius: '16px', border: '1px solid #27272A', fontSize: '14px', outline: 'none', appearance: 'none' as const, width: '100%' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} style={inputStyle}>
          <option value="ALL">Todas as Cidades</option>
          {cities.map(city => <option key={city} value={city}>{city.toUpperCase()}</option>)}
        </select>
        <select value={selectedShiftFilter} onChange={e => setSelectedShiftFilter(e.target.value)} style={inputStyle}>
          <option value="ALL">Todos os Turnos</option><option value="Manhã">Manhã</option><option value="Tarde">Tarde</option><option value="Manhã e Tarde">Integral</option>
        </select>
      </div>
      <input type="text" placeholder="🔍 Buscar médico, clínica ou bairro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ ...inputStyle, boxSizing: 'border-box' }} />
    </div>
  );
}