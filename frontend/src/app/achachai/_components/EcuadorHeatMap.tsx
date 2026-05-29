'use client';
// @ts-nocheck
/**
 * Mapa de calor de Ecuador como SVG custom — sin dependencias.
 * Renderiza la silueta del pais + circulos de calor por ciudad,
 * con tamaño = volumen y color = intensidad (tasa de fraude / monto).
 *
 * Uso:
 *   <EcuadorHeatMap data={[{ciudad:'Quito', n_siniestros:4777, tasa_fraude:0.06, monto_promedio:11599}, ...]} />
 */
import { useEffect, useMemo, useState } from 'react';

// Coordenadas geo aproximadas de las ciudades clave de Ecuador
// (mismas 18 sucursales del dataset)
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Quito:           { lat:  -0.18, lng: -78.47 },
  Guayaquil:       { lat:  -2.17, lng: -79.93 },
  Cuenca:          { lat:  -2.90, lng: -79.00 },
  Ambato:          { lat:  -1.25, lng: -78.62 },
  Manta:           { lat:  -0.95, lng: -80.73 },
  Ibarra:          { lat:   0.34, lng: -78.13 },
  Loja:            { lat:  -3.99, lng: -79.20 },
  Portoviejo:      { lat:  -1.06, lng: -80.45 },
  'Santo Domingo': { lat:  -0.25, lng: -79.17 },
  Machala:         { lat:  -3.25, lng: -79.96 },
  Esmeraldas:      { lat:   0.97, lng: -79.65 },
  Babahoyo:        { lat:  -1.80, lng: -79.53 },
  Riobamba:        { lat:  -1.67, lng: -78.65 },
  Latacunga:       { lat:  -0.93, lng: -78.62 },
  Tulcan:          { lat:   0.81, lng: -77.72 },
  Azogues:         { lat:  -2.74, lng: -78.85 },
  Tena:            { lat:  -0.99, lng: -77.82 },
  Macas:           { lat:  -2.31, lng: -78.12 },
  'Quito Norte':   { lat:  -0.10, lng: -78.48 },
  'Quito Sur':     { lat:  -0.30, lng: -78.55 },
  'Guayaquil N.':  { lat:  -2.05, lng: -79.91 },
  'Guayaquil C.':  { lat:  -2.20, lng: -79.90 },
  Cumbayá:         { lat:  -0.20, lng: -78.43 },
  Tumbaco:         { lat:  -0.21, lng: -78.40 },
};

// BBox de Ecuador continental
const BBOX = { latMin: -5.0, latMax: 2.0, lngMin: -81.0, lngMax: -75.5 };

// Tamaño del SVG
const W = 380;
const H = 480;

function project(lat: number, lng: number): [number, number] {
  const x = ((lng - BBOX.lngMin) / (BBOX.lngMax - BBOX.lngMin)) * W;
  const y = ((BBOX.latMax - lat) / (BBOX.latMax - BBOX.latMin)) * H;
  return [x, y];
}

// DEPRECATED: silueta polígono dibujada a mano. Ahora usamos el GeoJSON real
// en /public/ec-all.geo.json (provincias de Ecuador del repo zpio/Mapa-Ecuador).
// Mantenemos el array como fallback por si el fetch falla.
const ECUADOR_BOUNDARY: [number, number][] = [
  // ---- NORTE: costa NW → Tulcán → frontera Colombia ----
  [1.10, -78.95],   // NW Mataje (frontera norte)
  [1.40, -78.55],
  [1.45, -78.05],   // pico norte Tulcán
  [1.20, -77.65],
  [0.95, -77.40],
  [0.75, -77.05],
  [0.65, -76.70],
  // ---- LENGUA AMAZÓNICA NE: sale hacia el este ----
  [0.50, -76.20],
  [0.40, -75.80],
  [0.20, -75.40],
  [0.05, -75.25],   // tip NE (más oriental)
  [-0.20, -75.20],
  [-0.50, -75.25],
  [-0.85, -75.40],
  // ---- FRONTERA E con Perú baja a Pastaza/Morona ----
  [-1.40, -75.55],
  [-2.00, -75.70],
  [-2.55, -75.80],
  [-3.10, -76.00],
  [-3.55, -76.30],
  [-3.95, -76.70],
  [-4.30, -77.10],
  // ---- FRONTERA SUR irregular con Perú (Cordillera del Cóndor) ----
  [-4.55, -77.50],
  [-4.85, -77.95],
  [-5.00, -78.45],  // punta SE Zumba
  [-4.85, -78.90],
  [-4.55, -79.20],
  [-4.40, -79.55],  // Macará
  [-4.30, -79.85],
  // ---- HUAQUILLAS: frontera sur sale al Pacífico ----
  [-3.95, -80.25],
  [-3.65, -80.05],  // pequeño entrante (estero)
  [-3.40, -80.15],
  // ---- GOLFO DE GUAYAQUIL: gran entrante (la marca de Ecuador) ----
  [-3.15, -80.35],
  [-3.05, -80.10],
  [-2.85, -79.95],  // Guayaquil interior (NO costa)
  [-2.75, -80.05],
  [-2.65, -80.30],
  [-2.55, -80.65],
  [-2.40, -80.90],
  [-2.20, -80.95],  // PUNTA SANTA ELENA (extremo oeste)
  // ---- COSTA OESTE (Manabí + Esmeraldas) sube norte ----
  [-1.85, -80.85],
  [-1.50, -80.85],
  [-1.20, -80.80],
  [-1.05, -80.75],  // Manta
  [-0.80, -80.60],
  [-0.55, -80.55],  // Pedernales
  [-0.20, -80.35],
  [0.20, -80.15],
  [0.55, -80.00],
  [0.85, -79.75],
  [1.05, -79.55],   // Esmeraldas
  [1.12, -79.30],
  [1.10, -78.95],   // cierra el polígono
];

type CityRow = {
  ciudad: string;
  n_siniestros?: number;
  tasa_fraude?: number;
  monto_promedio?: number;
};

interface Props {
  data: CityRow[];
  metric?: 'volumen' | 'tasa' | 'monto'; // qué métrica usa el color
  height?: number;
  title?: string;
  showLegend?: boolean;
}

export function EcuadorHeatMap({
  data = [],
  metric = 'tasa',
  height = 460,
  title = 'Concentración geográfica',
  showLegend = true,
}: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const [geo, setGeo] = useState<any>(null);

  // Cargamos el GeoJSON real de Ecuador en WGS84 (lat/lng), servido desde /public
  useEffect(() => {
    fetch('/ecuador-wgs84.geo.json')
      .then(r => r.ok ? r.json() : null)
      .then(g => setGeo(g))
      .catch(() => setGeo(null));
  }, []);

  // Convierte un anillo [[lng,lat],[lng,lat],...] a un path SVG ya proyectado.
  function ringToPath(ring: number[][]): string {
    return ring.map(([lng, lat], i) => {
      const [x, y] = project(lat, lng);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ') + ' Z';
  }

  // Devuelve los paths de cada provincia con su key (id legible).
  const provincePaths = useMemo(() => {
    if (!geo?.features) return [];
    const out: { key: string; name: string; d: string }[] = [];
    for (const f of geo.features) {
      const name = f.properties?.name || f.properties?.['hc-key'] || 'prov';
      const key = f.properties?.['hc-key'] || name;
      const g = f.geometry;
      if (!g) continue;
      if (g.type === 'Polygon') {
        // un Polygon = [outer_ring, hole1, hole2, ...]
        const d = g.coordinates.map(ringToPath).join(' ');
        out.push({ key, name, d });
      } else if (g.type === 'MultiPolygon') {
        // MultiPolygon = [[outer, ...holes], [outer, ...holes], ...]
        const d = g.coordinates.flatMap((poly: number[][][]) => poly.map(ringToPath)).join(' ');
        out.push({ key, name, d });
      }
    }
    return out;
  }, [geo]);

  const enriched = useMemo(() => {
    const rows: any[] = [];
    for (const d of data) {
      const coord = CITY_COORDS[d.ciudad];
      if (!coord) continue;
      const [x, y] = project(coord.lat, coord.lng);
      rows.push({ ...d, x, y });
    }
    return rows;
  }, [data]);

  const maxN = Math.max(1, ...enriched.map(r => r.n_siniestros || 0));
  const maxMonto = Math.max(1, ...enriched.map(r => r.monto_promedio || 0));

  function radius(d: any): number {
    const n = d.n_siniestros || 0;
    return 6 + (n / maxN) * 18;
  }

  function color(d: any): string {
    if (metric === 'tasa') {
      const t = d.tasa_fraude || 0;
      if (t >= 0.10) return '#C5333A';
      if (t >= 0.07) return '#E87A4F';
      if (t >= 0.04) return '#D4A574';
      return '#4A7C59';
    }
    if (metric === 'monto') {
      const m = d.monto_promedio || 0;
      const ratio = m / maxMonto;
      if (ratio >= 0.8) return '#C5333A';
      if (ratio >= 0.6) return '#E87A4F';
      if (ratio >= 0.4) return '#D4A574';
      return '#4A7C59';
    }
    const ratio = (d.n_siniestros || 0) / maxN;
    if (ratio >= 0.7) return '#C5333A';
    if (ratio >= 0.4) return '#E87A4F';
    if (ratio >= 0.2) return '#D4A574';
    return '#4A7C59';
  }

  if (enriched.length === 0) {
    return (
      <div style={{
        padding: 20, textAlign: 'center', color: 'var(--ink-mute)',
        fontSize: 12, background: 'var(--marfil-paper)', borderRadius: 8,
      }}>
        Sin datos geográficos para mostrar.
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(180deg, #F4EDE4, #FFFFFF)',
      borderRadius: 12, padding: 14, position: 'relative',
      border: '1px solid var(--line)',
    }}>
      {title && (
        <div style={{
          fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '.1em',
          textTransform: 'uppercase', fontWeight: 700, marginBottom: 6,
        }}>
          {title}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 14, alignItems: 'center' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, display: 'block' }}>
          <defs>
            <pattern id="rhombi-bg" width="14" height="14" patternUnits="userSpaceOnUse">
              <path d="M7 0 L14 7 L7 14 L0 7 Z" fill="none" stroke="rgba(26,58,82,0.08)" />
            </pattern>
            <radialGradient id="heat-glow">
              <stop offset="0%" stopColor="rgba(197,51,58,0.35)" />
              <stop offset="100%" stopColor="rgba(197,51,58,0)" />
            </radialGradient>
            <linearGradient id="silhouette-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(244,237,228,0.95)" />
              <stop offset="100%" stopColor="rgba(232,228,217,0.85)" />
            </linearGradient>
          </defs>

          {/* fondo de rombos andinos */}
          <rect width={W} height={H} fill="url(#rhombi-bg)" />

          {/* Silueta de Ecuador
              - Si cargo el GeoJSON WGS84, dibujamos la silueta real
              - Si fallo el fetch, fallback al polígono dibujado a mano */}
          {provincePaths.length > 0 ? (
            <g>
              {provincePaths.map((p) => (
                <path
                  key={p.key}
                  d={p.d}
                  fill="url(#silhouette-fill)"
                  stroke="var(--condor-wing)"
                  strokeWidth="1.5"
                  opacity="0.95"
                  strokeLinejoin="round"
                >
                  <title>{p.name}</title>
                </path>
              ))}
            </g>
          ) : (
            (() => {
              const pts = ECUADOR_BOUNDARY.map(([lat, lng]) => project(lat, lng));
              const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") + " Z";
              return (
                <path d={d} fill="url(#silhouette-fill)" stroke="var(--condor-wing)" strokeWidth="1.5" opacity="0.92" strokeLinejoin="round" />
              );
            })()
          )}

          {/* línea ecuatorial */}
          {(() => {
            const [, y0] = project(0, BBOX.lngMin);
            const [, y1] = project(0, BBOX.lngMax);
            return (
              <g>
                <line x1={20} y1={y0} x2={W - 20} y2={y1}
                      stroke="var(--andes-orange)" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.55" />
                <text x={W - 22} y={y0 - 4} fontSize="9" fill="var(--andes-orange)" textAnchor="end" fontWeight="600">
                  ecuador
                </text>
              </g>
            );
          })()}

          {/* cordillera de los Andes (linea aproximada vertical) */}
          {(() => {
            const [x0, y0] = project(1.5, -78.5);
            const [x1, y1] = project(-4.5, -79.0);
            return (
              <path
                d={`M ${x0} ${y0} Q ${(x0 + x1) / 2 + 6} ${(y0 + y1) / 2} ${x1} ${y1}`}
                fill="none" stroke="var(--condor-wing)" strokeWidth="1.2"
                strokeDasharray="2 4" opacity="0.25"
              />
            );
          })()}

          {/* halos de calor */}
          {enriched.map(d => (
            <circle key={`halo-${d.ciudad}`} cx={d.x} cy={d.y} r={radius(d) * 2.2}
                    fill="url(#heat-glow)" opacity="0.85" />
          ))}

          {/* ciudades */}
          {enriched.map(d => {
            const r = radius(d);
            const c = color(d);
            const isHover = hover === d.ciudad;
            return (
              <g key={d.ciudad}
                 onMouseEnter={() => setHover(d.ciudad)}
                 onMouseLeave={() => setHover(null)}
                 style={{ cursor: 'pointer' }}>
                {isHover && (
                  <circle cx={d.x} cy={d.y} r={r + 5}
                          fill="none" stroke={c} strokeWidth="1.5"
                          style={{ transformOrigin: `${d.x}px ${d.y}px`, animation: 'sonar-out 1.4s ease-out infinite' }} />
                )}
                <circle cx={d.x} cy={d.y} r={r}
                        fill={c} stroke="white" strokeWidth="2" />
                <text x={d.x} y={d.y + 3} textAnchor="middle"
                      fill="white" fontSize={Math.max(8, r * 0.55)} fontWeight="700">
                  {d.n_siniestros >= 1000 ? Math.round(d.n_siniestros / 100) / 10 + 'k' : d.n_siniestros}
                </text>
                <text x={d.x} y={d.y + r + 12} textAnchor="middle"
                      fill="var(--condor-wing)" fontSize={isHover ? 11 : 10} fontWeight={isHover ? 700 : 500}>
                  {d.ciudad}
                </text>
              </g>
            );
          })}

          {/* tooltip al hover */}
          {hover && (() => {
            const d = enriched.find(r => r.ciudad === hover);
            if (!d) return null;
            const tx = Math.min(W - 130, Math.max(10, d.x + 14));
            const ty = Math.max(20, d.y - 30);
            return (
              <g pointerEvents="none">
                <rect x={tx} y={ty} width="130" height="48" rx="6"
                      fill="var(--condor-wing)" stroke="var(--andes-orange)" strokeWidth="1" />
                <text x={tx + 8} y={ty + 14} fontSize="10" fill="var(--marfil)" fontWeight="700">{d.ciudad}</text>
                <text x={tx + 8} y={ty + 28} fontSize="9" fill="var(--marfil)" opacity="0.85">
                  {d.n_siniestros?.toLocaleString('en-US')} siniestros
                </text>
                {d.tasa_fraude != null && (
                  <text x={tx + 8} y={ty + 40} fontSize="9" fill="var(--marfil)" opacity="0.85">
                    Tasa alertas: {(d.tasa_fraude * 100).toFixed(1)}%
                  </text>
                )}
              </g>
            );
          })()}
        </svg>

        {showLegend && (
          <div style={{ fontSize: 11, color: 'var(--condor-wing)' }}>
            <div style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Leyenda
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, marginBottom: 4 }}>Tamaño del círculo</div>
              <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>= # de siniestros</div>
            </div>

            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, marginBottom: 4 }}>
                Color = {metric === 'tasa' ? 'tasa de alertas' : metric === 'monto' ? 'monto promedio' : 'volumen'}
              </div>
              {[
                ['#C5333A', 'Alta'],
                ['#E87A4F', 'Media-alta'],
                ['#D4A574', 'Media'],
                ['#4A7C59', 'Baja'],
              ].map(([c, lbl]) => (
                <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: c as string, border: '1.5px solid white', boxShadow: '0 0 0 1px var(--line)' }} />
                  <span style={{ fontSize: 10.5 }}>{lbl}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--ink-mute)' }}>
              <span style={{ color: 'var(--andes-orange)', fontWeight: 600 }}>—</span> línea ecuatorial · <strong>{enriched.length}</strong> ciudades mostradas
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
