// Cliente para el backend FastAPI de AchachAI

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type Siniestro = {
  id_siniestro: string;
  id_poliza: string;
  cobertura: string;
  estado: string;
  fecha_ocurrencia: string;
  monto_reclamado_usd: number;
  monto_pagado_usd: number;
  ciudad_evento: string;
  documentos_completos: boolean;
  etiqueta_fraude_simulada: number;
  caso_inyectado: boolean;
};

export type Casos = {
  total: number;
  limit: number;
  offset: number;
  items: Siniestro[];
};

export type KPIs = {
  totales: {
    siniestros: number;
    fraudes_simulados: number;
    tasa_fraude_simulada: number;
    monto_reclamado_total_usd: number;
    monto_reclamado_fraudes_usd: number;
    proveedores_lista_restrictiva: number;
    documentos_totales: number;
    documentos_inconsistentes: number;
  };
  distribucion_cobertura: { cobertura: string; n: number }[];
  distribucion_estado: { estado: string; n: number }[];
};

export type DetalleCaso = {
  siniestro: Record<string, any>;
  descripcion: string;
  asegurado: { id: string; segmento: string; score: number; reclamos_12m: number };
  vehiculo: { marca: string; modelo: string; anio: number };
  proveedor: { nombre: string; tipo: string; lista_restrictiva: boolean };
  n_documentos: number;
  score: number;
  nivel: 'VERDE' | 'AMARILLO' | 'ROJO';
  reglas_criticas: { codigo: string; nombre: string; clasificacion: string; evidencia: string }[];
  senales_activadas: { id: number; nombre: string; puntos: number; evidencia: string }[];
  explicacion: string;
};

export type TopRiesgo = {
  total_evaluados: number;
  top: {
    id_siniestro: string;
    score: number;
    nivel: 'VERDE' | 'AMARILLO' | 'ROJO';
    cobertura: string;
    monto_reclamado_usd: number;
    ciudad: string;
    reglas_disparadas: string[];
    n_senales: number;
  }[];
};

export type Proveedor = {
  id_proveedor: string;
  nombre: string;
  tipo: string;
  ciudad: string;
  lista_restrictiva: boolean;
  n_siniestros: number;
  monto_promedio: number;
  n_fraudes_simulados: number;
};

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type ChatResponse = {
  response: string;
  tools_used: { tool: string; args: any; result_summary: string }[];
  tokens: number;
  iterations: number;
};

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status} en ${path}`);
  return r.json();
}

async function post<T>(path: string, body: any): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${r.status} en ${path}`);
  return r.json();
}

export const api = {
  health: () => get<{ status: string }>('/health'),
  kpis: () => get<KPIs>('/kpis'),
  casos: (params: { limit?: number; offset?: number; ciudad?: string; cobertura?: string }) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
    return get<Casos>(`/casos?${q}`);
  },
  caso: (id: string) => get<DetalleCaso>(`/casos/${id}`),
  topRiesgo: (limit = 10, nivel?: string) => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (nivel) q.set('nivel', nivel);
    return get<TopRiesgo>(`/top-riesgo?${q}`);
  },
  proveedores: (top_n = 10) => get<{ top: Proveedor[] }>(`/proveedores/ranking?top_n=${top_n}`),
  ciudades: (top_n = 10) => get<{ top: any[] }>(`/ciudades/ranking?top_n=${top_n}`),
  asegurados: () => get<{ top: any[] }>(`/asegurados/recurrentes`),
  chat: (message: string, history?: ChatMessage[]) =>
    post<ChatResponse>('/chat', { message, history }),
};

export function nivelColor(nivel: string) {
  return {
    ROJO: 'bg-red-100 text-red-800 border-red-300',
    AMARILLO: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    VERDE: 'bg-green-100 text-green-800 border-green-300',
  }[nivel] || 'bg-gray-100 text-gray-800 border-gray-300';
}

export function fmtUsd(v: number | undefined | null): string {
  if (v == null) return '-';
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

export function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}
