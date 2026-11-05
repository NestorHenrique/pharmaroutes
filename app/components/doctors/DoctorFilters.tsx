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
    <div className="doctor-filters">
      <div className="doctor-filter-row">
        <select className="doctor-filter-input" value={selectedCity} onChange={e => setSelectedCity(e.target.value)}>
          <option value="ALL">Todas as Cidades</option>
          {cities.map(city => <option key={city} value={city}>{city}</option>)}
        </select>
        <select className="doctor-filter-input" value={selectedShiftFilter} onChange={e => setSelectedShiftFilter(e.target.value)}>
          <option value="ALL">Todos os Turnos</option><option value="Manhã">Manhã</option><option value="Tarde">Tarde</option><option value="Manhã e Tarde">Integral</option>
        </select>
      </div>
      <input className="doctor-filter-input" type="text" placeholder="Buscar médico, clínica ou bairro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
    </div>
  );
}