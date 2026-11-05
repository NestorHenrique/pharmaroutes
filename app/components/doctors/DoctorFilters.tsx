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
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
        <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} style={{ padding: '10px 12px', backgroundColor: 'rgba(24, 24, 27, 0.6)', color: '#e2e8f0', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '12px', outline: 'none' }}>
          <option value="ALL">Todas as Cidades</option>
          {cities.map(city => <option key={city} value={city}>{city.toUpperCase()}</option>)}
        </select>
        <select value={selectedShiftFilter} onChange={e => setSelectedShiftFilter(e.target.value)} style={{ padding: '10px 12px', backgroundColor: 'rgba(24, 24, 27, 0.6)', color: '#e2e8f0', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '12px', outline: 'none' }}>
          <option value="ALL">Todos os Turnos</option><option value="Manhã">Apenas Manhã</option><option value="Tarde">Apenas Tarde</option><option value="Manhã e Tarde">Integral</option>
        </select>
      </div>
      <input type="text" placeholder="Buscar por médico, clínica, bairro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(24, 24, 27, 0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
    </>
  );
}