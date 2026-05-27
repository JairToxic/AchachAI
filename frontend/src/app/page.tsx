'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtUsd, fmtPct, nivelColor, type KPIs, type TopRiesgo } from '@/lib/api';

export default function Dashboard() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [top, setTop] = useState<TopRiesgo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loadingTop, setLoadingTop] = useState(true);

  useEffect(() => {
    api.kpis().then(setKpis).catch((e) => setErr(String(e)));
    api.topRiesgo(8).then(setTop).catch((e) => setErr(String(e))).finally(() => setLoadingTop(false));
  }, []);

  if (err) {
    return (
      <div className="p-6 rounded-lg bg-red-50 border border-red-200 text-red-800">
        Error conectando al backend: {err}
        <div className="mt-2 text-sm">Verifica que FastAPI este corriendo en http://localhost:8000</div>
      </div>
    );
  }
  if (!kpis) return <Skeleton />;

  const t = kpis.totales;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard antifraude</h1>
        <p className="text-sm text-gray-500">
          Reto Aseguradora del Sur · vista consolidada de cartera
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Siniestros totales" value={t.siniestros.toLocaleString()} />
        <KpiCard
          label="Posibles fraudes"
          value={`${t.fraudes_simulados.toLocaleString()} (${fmtPct(t.tasa_fraude_simulada)})`}
          tone="red"
        />
        <KpiCard label="Monto reclamado" value={fmtUsd(t.monto_reclamado_total_usd)} />
        <KpiCard
          label="Monto en riesgo"
          value={fmtUsd(t.monto_reclamado_fraudes_usd)}
          tone="red"
          sub={`${fmtPct(t.monto_reclamado_fraudes_usd / t.monto_reclamado_total_usd)} del total`}
        />
        <KpiCard label="Proveedores lista restrictiva" value={t.proveedores_lista_restrictiva.toString()} tone="yellow" />
        <KpiCard label="Documentos cargados" value={t.documentos_totales.toLocaleString()} />
        <KpiCard
          label="Docs inconsistentes"
          value={t.documentos_inconsistentes.toLocaleString()}
          tone="red"
          sub={fmtPct(t.documentos_inconsistentes / t.documentos_totales) + ' del total'}
        />
        <KpiCard label="LLM agente" value="gpt-5-mini" sub="Azure AI Foundry" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Distribucion por cobertura">
          <BarList items={kpis.distribucion_cobertura.map((c) => ({ label: c.cobertura, value: c.n }))} />
        </Card>
        <Card title="Distribucion por estado del siniestro">
          <BarList items={kpis.distribucion_estado.map((e) => ({ label: e.estado, value: e.n }))} />
        </Card>
      </div>

      <Card title="Top 8 siniestros con mayor riesgo" right={
        <Link href="/casos" className="text-sm text-blue-600 hover:underline">Ver todos →</Link>
      }>
        {loadingTop ? (
          <div className="text-sm text-gray-500">Evaluando reglas + senales sobre la cartera…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="py-2">ID</th>
                <th>Score</th>
                <th>Nivel</th>
                <th>Cobertura</th>
                <th>Reglas</th>
                <th className="text-right">Monto</th>
                <th>Ciudad</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {top?.top.map((row) => (
                <tr key={row.id_siniestro} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="py-2 font-mono text-xs">{row.id_siniestro}</td>
                  <td className="font-bold">{row.score}</td>
                  <td>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs border ${nivelColor(row.nivel)}`}>
                      {row.nivel}
                    </span>
                  </td>
                  <td>{row.cobertura}</td>
                  <td className="text-xs">{row.reglas_disparadas.join(', ') || '—'}</td>
                  <td className="text-right">{fmtUsd(row.monto_reclamado_usd)}</td>
                  <td>{row.ciudad}</td>
                  <td>
                    <Link
                      href={`/casos/${row.id_siniestro}`}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'red' | 'yellow' | 'green' }) {
  const toneClass = tone === 'red' ? 'border-red-200 bg-red-50'
                  : tone === 'yellow' ? 'border-yellow-200 bg-yellow-50'
                  : tone === 'green' ? 'border-green-200 bg-green-50'
                  : 'bg-white border-gray-200';
  return (
    <div className={`p-4 rounded-lg border ${toneClass}`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((i) => i.value));
  return (
    <div className="space-y-1.5">
      {items.map((i) => (
        <div key={i.label} className="text-sm">
          <div className="flex justify-between mb-0.5">
            <span>{i.label}</span>
            <span className="text-gray-500">{i.value.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
