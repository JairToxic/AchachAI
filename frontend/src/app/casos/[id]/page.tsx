'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, fmtUsd, nivelColor, type DetalleCaso } from '@/lib/api';

export default function DetalleCasoPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<DetalleCaso | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    api.caso(params.id).then(setData).catch((e) => setErr(String(e)));
  }, [params?.id]);

  if (err) return <div className="p-6 bg-red-50 text-red-800 rounded">Error: {err}</div>;
  if (!data) return <div className="text-gray-500">Calculando score…</div>;

  const s = data.siniestro;
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <Link href="/casos" className="text-xs text-blue-600 hover:underline">← Bandeja</Link>
          <h1 className="text-2xl font-bold mt-1">{s.id_siniestro}</h1>
          <p className="text-sm text-gray-500">
            {s.cobertura} · {s.ciudad_evento} · {s.fecha_ocurrencia}
          </p>
        </div>
        <div className="text-right">
          <div className="text-5xl font-bold">{data.score}<span className="text-2xl text-gray-400">/100</span></div>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${nivelColor(data.nivel)}`}>
            Nivel {data.nivel}
          </span>
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
        <strong>Explicación del agente:</strong> {data.explicacion}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <InfoCard title="Siniestro">
          <Row k="ID póliza" v={s.id_poliza} />
          <Row k="Cobertura" v={s.cobertura} />
          <Row k="Estado" v={s.estado} />
          <Row k="Fecha ocurrencia" v={s.fecha_ocurrencia} />
          <Row k="Fecha reporte" v={s.fecha_reporte} />
          <Row k="Días entre" v={String(s.dias_entre_ocurrencia_reporte)} />
          <Row k="Monto reclamado" v={fmtUsd(s.monto_reclamado_usd)} />
          <Row k="Monto estimado" v={fmtUsd(s.monto_estimado_usd)} />
          <Row k="Monto pagado" v={fmtUsd(s.monto_pagado_usd)} />
        </InfoCard>

        <InfoCard title="Actores">
          <Row k="Asegurado" v={data.asegurado.id} />
          <Row k="Segmento" v={data.asegurado.segmento} />
          <Row k="Score cliente" v={String(data.asegurado.score)} />
          <Row k="Reclamos 12m" v={String(data.asegurado.reclamos_12m)} />
          <Row k="Vehículo" v={`${data.vehiculo.marca} ${data.vehiculo.modelo} ${data.vehiculo.anio}`} />
          <Row k="Proveedor" v={data.proveedor.nombre} />
          <Row k="Tipo proveedor" v={data.proveedor.tipo} />
          <Row k="Lista restrictiva"
               v={data.proveedor.lista_restrictiva
                   ? <span className="text-red-600 font-bold">SI ⚠️</span>
                   : 'no'} />
          <Row k="Documentos cargados" v={String(data.n_documentos)} />
        </InfoCard>
      </div>

      {data.reglas_criticas.length > 0 && (
        <div className="bg-white border-2 border-red-300 rounded-lg p-5">
          <h3 className="font-bold text-red-700 mb-3">⚠️ Reglas críticas activadas ({data.reglas_criticas.length})</h3>
          <div className="space-y-2">
            {data.reglas_criticas.map((r) => (
              <div key={r.codigo} className="flex items-start gap-3 p-3 bg-red-50 rounded">
                <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-mono">{r.codigo}</span>
                <div className="flex-1">
                  <div className="font-medium">{r.nombre}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{r.evidencia}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs border ${nivelColor(r.clasificacion)}`}>
                  {r.clasificacion}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.senales_activadas.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="font-semibold mb-3">
            Señales puntuadas activadas ({data.senales_activadas.length}) ·
            {' '}<span className="text-gray-500">total {data.senales_activadas.reduce((a, b) => a + b.puntos, 0)} pts</span>
          </h3>
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
              <tr><th className="py-1">#</th><th>Nombre</th><th>Evidencia</th><th className="text-right">Pts</th></tr>
            </thead>
            <tbody>
              {data.senales_activadas.sort((a, b) => b.puntos - a.puntos).map((s) => (
                <tr key={s.id} className="border-b last:border-b-0">
                  <td className="py-2 text-xs">{s.id}</td>
                  <td>{s.nombre}</td>
                  <td className="text-xs text-gray-600">{s.evidencia}</td>
                  <td className="text-right font-bold">{s.puntos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="text-xs text-gray-500 uppercase mb-1">Descripción del reclamo</div>
        <p className="text-sm italic">{data.descripcion}</p>
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1 text-sm border-b border-gray-50 last:border-b-0">
      <span className="text-gray-500">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}
