/**
 * Geocodificação reversa: coordenadas do GPS → endereço, bairro e cidade.
 * Usa o Nominatim (OpenStreetMap), que é gratuito e aceita chamadas diretas do navegador.
 * Política de uso: no máximo 1 chamada por segundo — aqui só roda quando o representante
 * toca no botão GPS, então fica bem abaixo disso.
 */

export interface ReverseAddress {
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const TIMEOUT_MS = 8000;

type NominatimAddress = Record<string, string | undefined>;

/** Converte o objeto `address` do Nominatim nos campos do cadastro */
export function parseNominatimAddress(a: NominatimAddress | null | undefined): ReverseAddress | null {
  if (!a) return null;
  const first = (...keys: string[]): string => {
    for (const k of keys) {
      const v = a[k]?.trim();
      if (v) return v;
    }
    return '';
  };
  const result: ReverseAddress = {
    endereco: first('road', 'pedestrian', 'footway', 'path', 'residential'),
    numero: first('house_number'),
    // No Brasil o bairro costuma vir em suburb; neighbourhood/quarter/city_district são alternativas
    bairro: first('suburb', 'neighbourhood', 'quarter', 'city_district', 'borough'),
    cidade: first('city', 'town', 'village', 'municipality'),
  };
  return result.endereco || result.bairro || result.cidade ? result : null;
}

/** Busca o endereço de uma coordenada. Devolve null se não achar ou se a rede falhar. */
export async function reverseGeocode(lat: number, lon: number): Promise<ReverseAddress | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const qs = new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      zoom: '18',
      'accept-language': 'pt-BR',
      lat: String(lat),
      lon: String(lon),
    });
    const res = await fetch(`${NOMINATIM}?${qs.toString()}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: NominatimAddress } | null;
    return parseNominatimAddress(data?.address);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type AddressFields = {
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
};

/**
 * Aplica o endereço do GPS no formulário. Endereço, bairro e cidade são trocados pelos
 * atuais; o número só muda se o mapa souber (muitas ruas não têm número no OpenStreetMap,
 * e apagar o que o representante digitou seria pior).
 */
export function mergeAddress<T extends AddressFields>(prev: T, a: ReverseAddress): T {
  return {
    ...prev,
    endereco: a.endereco || prev.endereco || '',
    numero: a.numero || prev.numero || '',
    bairro: a.bairro || prev.bairro || '',
    cidade: a.cidade || prev.cidade || '',
  };
}
