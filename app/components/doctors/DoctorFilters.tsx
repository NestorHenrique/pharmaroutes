import { SearchIcon } from '../ui/Icons';

interface DoctorFiltersProps {
  cities: string[];
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  selectedShiftFilter: string;
  setSelectedShiftFilter: (shift: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

// 16px no mobile evita o zoom automático do iOS ao focar o campo.
const fieldClass =
  'w-full min-w-0 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-3 text-base text-slate-100 backdrop-blur-xl transition-colors placeholder:text-slate-500 hover:border-slate-700 focus-visible:border-blue-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:text-sm';

export default function DoctorFilters({ cities, selectedCity, setSelectedCity, selectedShiftFilter, setSelectedShiftFilter, searchTerm, setSearchTerm }: DoctorFiltersProps) {
  return (
    <div role="search" aria-label="Filtros do roteiro" className="mb-4 flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="min-w-0">
          <label htmlFor="filtro-cidade" className="sr-only">Cidade</label>
          <select id="filtro-cidade" className={fieldClass} value={selectedCity} onChange={e => setSelectedCity(e.target.value)}>
            <option value="ALL">Todas as Cidades</option>
            {cities.map(city => <option key={city} value={city}>{city}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="filtro-turno" className="sr-only">Turno</label>
          <select id="filtro-turno" className={fieldClass} value={selectedShiftFilter} onChange={e => setSelectedShiftFilter(e.target.value)}>
            <option value="ALL">Todos os Turnos</option><option value="Manhã">Manhã</option><option value="Tarde">Tarde</option><option value="Manhã e Tarde">Integral</option>
          </select>
        </div>
      </div>
      <div className="relative">
        <label htmlFor="filtro-busca" className="sr-only">Buscar médico, clínica ou bairro</label>
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <input
          id="filtro-busca"
          className={`${fieldClass} pl-10`}
          type="search"
          placeholder="Buscar médico, clínica ou bairro..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>
    </div>
  );
}
