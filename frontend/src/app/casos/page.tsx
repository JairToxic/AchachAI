'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtUsd, type Casos } from '@/lib/api';

const PAGE_SIZE = 25;

export default function CasosPage() {
  const [casos, setCasos] = useState<Casos | null>(null);
  const [page, setPage] = useState(0);
  const [ciudad, setCiudad] = useState('');
  const [cobertura, setCobertura] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .casos({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        ciudad: ciudad || undefined,
        cobertura: cobertura || undefined,
      })
      .then(setCasos)
      .finally(() => setLoading(false));
  }, [page, ciudad, cobertura]);

  const totalPages = casos ? Math.ceil(casos.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Bandeja de siniestros</h1>
        <p className="text-sm text-gray-500">
          {casos ? `${casos.total.toLocaleString()} casos totales` : 'cargando…'}
        </p>
      </div>

      <div className="flex gap-3 items-center">
        <input
          placeholder="Filtrar por ciudad…"
          value={ciudad}
          onChange={(e) => { setCiudad(e.target.value); setPage(0); }}
          className="px-3 py-1.5 border rounded-md text-sm bg-white"
        />
        <select
          value={cobertura}
          onChange={(e) => { setCobertura(e.target.value); setPage(0); }}
          className="px-3 py-1.5 border rounded-md text-sm bg-white"
        >
          <option value="">Todas las coberturas</option>
          <option value="Choque">Choque</option>
          <option value="Robo">Robo</option>
          <option value="Responsabilidad Civil">Responsabilidad Civil</option>
          <option value="Da">Daño</option>
          <option value="P">Pérdida Total</option>
        </select>
        {loading && <span className="text-xs text-gray-500">cargando…</span>}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="p-3">ID</th>
              <th>Fecha</th>
              <th>Cobertura</th>
              <th>Estado</th>
              <th>Ciudad</th>
              <th className="text-right">Reclamado</th>
              <th className="text-right">Pagado</th>
              <th>Docs OK</th>
              <th>Fraude*</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {casos?.items.map((s) => (
              <tr key={s.id_siniestro} className="border-t hover:bg-blue-50/30">
                <td className="p-3 font-mono text-xs">
                  {s.caso_inyectado && (
                    <span className="bg-orange-100 text-orange-700 px-1 rounded text-[10px] mr-1">INY</span>
                  )}
                  {s.id_siniestro}
                </td>
                <td className="text-xs">{s.fecha_ocurrencia}</td>
                <td>{s.cobertura}</td>
                <td><span className="text-xs">{s.estado}</span></td>
                <td>{s.ciudad_evento}</td>
                <td className="text-right">{fmtUsd(s.monto_reclamado_usd)}</td>
                <td className="text-right text-gray-500">{fmtUsd(s.monto_pagado_usd)}</td>
                <td>{s.documentos_completos ? '✓' : <span className="text-red-600">✗</span>}</td>
                <td>{s.etiqueta_fraude_simulada === 1 ? <span className="text-red-600 font-medium">SI</span> : '-'}</td>
                <td>
                  <Link
                    href={`/casos/${s.id_siniestro}`}
                    className="text-blue-600 hover:underline text-xs"
                  >
                    Detalle →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500">
          Pagina {page + 1} de {totalPages.toLocaleString()}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            ← Anterior
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= totalPages}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        * <em>etiqueta_fraude_simulada</em> es ground truth sintetico, no resultado del modelo.
        El score real del motor de reglas + ML se calcula al abrir el detalle.
      </p>
    </div>
  );
}
