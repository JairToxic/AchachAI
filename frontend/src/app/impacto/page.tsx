'use client';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Simulacion = {
  cartera: { n_siniestros_anuales: number; n_fraudes_estimados: number; monto_total_fraudes_usd: number };
  escenario_actual: { recuperado_anual_usd: number; perdido_usd: number };
  escenario_achachai: { recuperado_anual_usd: number; perdido_usd: number };
  ahorro: {
    delta_recuperacion_usd: number;
    costo_total_sistema_usd: number;
    beneficio_neto_anual_usd: number;
    roi_pct: number;
    payback_meses: number;
  };
  mensaje_ejecutivo: string;
};

type Red = {
  nodes: { id: string; label: string; type: string; n: number; restrictiva?: boolean }[];
  edges: { source: string; target: string; weight: number }[];
  stats: { n_nodes: number; n_edges: number };
};

export default function ImpactoPage() {
  const [tab, setTab] = useState<'ahorro' | 'red' | 'exportar'>('ahorro');
  const [sim, setSim] = useState<Simulacion | null>(null);
  const [tasaA, setTasaA] = useState(0.30);
  const [tasaB, setTasaB] = useState(0.70);
  const [red, setRed] = useState<Red | null>(null);
  const [exportando, setExportando] = useState(false);
  const [nivelExport, setNivelExport] = useState<'ROJO' | 'AMARILLO' | 'VERDE'>('ROJO');

  useEffect(() => {
    fetch(`${API}/simulacion-ahorro?tasa_deteccion_actual=${tasaA}&tasa_deteccion_achachai=${tasaB}`)
      .then(r => r.json()).then(setSim);
  }, [tasaA, tasaB]);

  useEffect(() => {
    if (tab === 'red' && !red) {
      fetch(`${API}/red-relaciones?min_siniestros=5`).then(r => r.json()).then(setRed);
    }
  }, [tab, red]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Impacto y Auditoría</h1>
        <p className="text-sm text-gray-500">
          Simulación de ahorro · Red de relaciones · Exportación auditoría
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { id: 'ahorro', label: '💰 Simulación de Ahorro' },
          { id: 'red', label: '🕸️ Red de Relaciones' },
          { id: 'exportar', label: '📥 Exportar Auditoría' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* === TAB AHORRO === */}
      {tab === 'ahorro' && (
        <div className="space-y-6">
          <div className="bg-white border rounded-lg p-6">
            <h3 className="font-semibold mb-4">Ajustá los supuestos</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm mb-1">
                  Detección actual (manual): <strong>{(tasaA * 100).toFixed(0)}%</strong>
                </label>
                <input type="range" min="0.1" max="0.6" step="0.05" value={tasaA}
                  onChange={(e) => setTasaA(parseFloat(e.target.value))}
                  className="w-full" />
              </div>
              <div>
                <label className="block text-sm mb-1">
                  Detección con AchachAI: <strong>{(tasaB * 100).toFixed(0)}%</strong>
                </label>
                <input type="range" min="0.4" max="0.95" step="0.05" value={tasaB}
                  onChange={(e) => setTasaB(parseFloat(e.target.value))}
                  className="w-full" />
              </div>
            </div>
          </div>

          {sim && (
            <>
              {/* Hero del ahorro */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-300 rounded-lg p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs text-green-700 uppercase tracking-wide">Beneficio neto anual</div>
                    <div className="text-5xl font-bold text-green-700 mt-2">
                      ${(sim.ahorro.beneficio_neto_anual_usd / 1000).toFixed(0)}K
                    </div>
                    <div className="text-sm text-green-700 mt-1">
                      USD recuperados que hoy se pierden por fraude no detectado
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-green-700 uppercase tracking-wide">ROI</div>
                    <div className="text-5xl font-bold text-green-700 mt-2">{sim.ahorro.roi_pct}%</div>
                    <div className="text-sm text-green-700 mt-1">
                      Payback en {sim.ahorro.payback_meses} meses
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-white/60 rounded text-sm">
                  <strong>Mensaje al directorio:</strong> {sim.mensaje_ejecutivo}
                </div>
              </div>

              {/* Comparativa */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border-l-4 border-gray-400 p-5 rounded-lg">
                  <div className="text-xs text-gray-500 uppercase">Hoy (manual)</div>
                  <div className="text-2xl font-bold mt-1">${(sim.escenario_actual.recuperado_anual_usd / 1000).toFixed(0)}K</div>
                  <div className="text-sm text-gray-500">recuperados de fraude</div>
                  <div className="mt-3 text-xs text-red-600">
                    Pérdida: ${(sim.escenario_actual.perdido_usd / 1000).toFixed(0)}K
                  </div>
                </div>
                <div className="bg-white border-l-4 border-blue-500 p-5 rounded-lg">
                  <div className="text-xs text-blue-700 uppercase">Con AchachAI</div>
                  <div className="text-2xl font-bold text-blue-700 mt-1">${(sim.escenario_achachai.recuperado_anual_usd / 1000).toFixed(0)}K</div>
                  <div className="text-sm text-blue-700">recuperados de fraude</div>
                  <div className="mt-3 text-xs text-gray-500">
                    Pérdida: ${(sim.escenario_achachai.perdido_usd / 1000).toFixed(0)}K
                  </div>
                </div>
              </div>

              {/* Cartera */}
              <div className="bg-white border rounded-lg p-5">
                <h4 className="font-semibold mb-3 text-sm">Base de cálculo</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">Siniestros anuales</div>
                    <div className="text-xl font-bold">{sim.cartera.n_siniestros_anuales.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Fraudes estimados</div>
                    <div className="text-xl font-bold">{sim.cartera.n_fraudes_estimados.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Monto total en juego</div>
                    <div className="text-xl font-bold">${(sim.cartera.monto_total_fraudes_usd / 1e6).toFixed(1)}M</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* === TAB RED === */}
      {tab === 'red' && (
        <div className="space-y-4">
          {red ? (
            <>
              <div className="bg-white border rounded-lg p-5">
                <h3 className="font-semibold mb-2">Red de relaciones asegurados ↔ proveedores</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Detecta clusters donde un mismo proveedor concentra siniestros de muchos asegurados —
                  patrón típico de redes de fraude organizado.
                </p>
                <div className="text-sm text-gray-600">
                  <strong>{red.stats.n_nodes}</strong> nodos · <strong>{red.stats.n_edges}</strong> aristas
                </div>
              </div>

              {/* Visualización simple SVG */}
              <div className="bg-white border rounded-lg p-5 overflow-auto" style={{ maxHeight: 600 }}>
                <h4 className="font-semibold mb-3 text-sm">Top proveedores por concentración</h4>
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-500 border-b">
                    <tr>
                      <th className="py-2">Nodo</th>
                      <th>Tipo</th>
                      <th className="text-right">Siniestros conectados</th>
                      <th>Lista</th>
                    </tr>
                  </thead>
                  <tbody>
                    {red.nodes.sort((a, b) => b.n - a.n).slice(0, 25).map(n => (
                      <tr key={n.id} className={`border-b ${n.restrictiva ? 'bg-red-50' : ''}`}>
                        <td className="py-2 font-mono text-xs">{n.label}</td>
                        <td>{n.type === 'proveedor' ? '🏢 Proveedor' : '👤 Asegurado'}</td>
                        <td className="text-right font-bold">{n.n}</td>
                        <td>{n.restrictiva && <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded">RESTRICTIVA</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {red.edges.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold mb-3 text-sm">Top conexiones (asegurado ↔ proveedor)</h4>
                    <table className="w-full text-sm">
                      <thead className="text-left text-gray-500 border-b">
                        <tr><th className="py-2">Asegurado</th><th>Proveedor</th><th className="text-right">Siniestros compartidos</th></tr>
                      </thead>
                      <tbody>
                        {red.edges.slice(0, 15).map((e, i) => (
                          <tr key={i} className="border-b">
                            <td className="py-2 font-mono text-xs">{e.source}</td>
                            <td className="font-mono text-xs">{e.target}</td>
                            <td className="text-right font-bold">{e.weight}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 py-8">Cargando red de relaciones...</div>
          )}
        </div>
      )}

      {/* === TAB EXPORTAR === */}
      {tab === 'exportar' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-6">
            <h3 className="font-semibold mb-2">Exportar reporte de auditoría</h3>
            <p className="text-sm text-gray-500 mb-4">
              Genera CSV con todos los casos del nivel seleccionado, score, reglas activadas y explicación —
              listo para el comité antifraude o auditoría interna.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nivel a exportar</label>
                <select
                  value={nivelExport}
                  onChange={(e) => setNivelExport(e.target.value as any)}
                  className="px-3 py-2 border rounded-md bg-white"
                >
                  <option value="ROJO">🔴 ROJO — casos críticos</option>
                  <option value="AMARILLO">🟡 AMARILLO — requieren revisión documental</option>
                  <option value="VERDE">🟢 VERDE — flujo normal</option>
                </select>
              </div>

              <a
                href={`${API}/exportar-reporte.csv?nivel=${nivelExport}&limit=100`}
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
                onClick={() => { setExportando(true); setTimeout(() => setExportando(false), 30000); }}
              >
                {exportando ? 'Generando CSV...' : `⬇ Descargar reporte ${nivelExport} (CSV)`}
              </a>

              <p className="text-xs text-gray-500 mt-2">
                El reporte evalúa hasta 3.000 casos del dataset y devuelve los primeros 100 que coincidan con el nivel.
                Puede tardar 30-60 segundos.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
            <strong>💡 Casos de uso del reporte:</strong>
            <ul className="mt-2 ml-5 list-disc space-y-1">
              <li><strong>Comité antifraude semanal:</strong> ROJO con limit 50</li>
              <li><strong>Auditoría regulatoria SBS:</strong> ROJO+AMARILLO con limit 500</li>
              <li><strong>Reporte directorio mensual:</strong> agrupado por proveedor recurrente</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
