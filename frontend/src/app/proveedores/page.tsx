'use client';
import { useEffect, useState } from 'react';
import { api, fmtUsd, type Proveedor } from '@/lib/api';

export default function ProveedoresPage() {
  const [data, setData] = useState<Proveedor[] | null>(null);
  const [soloRestrictivos, setSoloRestrictivos] = useState(false);

  useEffect(() => {
    api.proveedores(30).then((r) => {
      let list = r.top;
      if (soloRestrictivos) list = list.filter((p) => p.lista_restrictiva);
      setData(list);
    });
  }, [soloRestrictivos]);

  if (!data) return <div className="text-gray-500">cargando…</div>;

  const totalSiniestros = data.reduce((a, b) => a + b.n_siniestros, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold">Ranking de proveedores</h1>
          <p className="text-sm text-gray-500">
            {data.length} proveedores · {totalSiniestros.toLocaleString()} siniestros asociados
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={soloRestrictivos}
            onChange={(e) => setSoloRestrictivos(e.target.checked)}
          />
          Solo lista restrictiva
        </label>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="p-3">#</th>
              <th>ID</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Ciudad</th>
              <th className="text-right">Siniestros</th>
              <th className="text-right">Monto promedio</th>
              <th className="text-right">Fraudes*</th>
              <th>Lista</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p, i) => (
              <tr key={p.id_proveedor} className={`border-t ${p.lista_restrictiva ? 'bg-red-50/60' : 'hover:bg-gray-50'}`}>
                <td className="p-3 text-gray-400">{i + 1}</td>
                <td className="font-mono text-xs">{p.id_proveedor}</td>
                <td className="font-medium">{p.nombre}</td>
                <td>{p.tipo}</td>
                <td>{p.ciudad}</td>
                <td className="text-right font-bold">{p.n_siniestros}</td>
                <td className="text-right">{fmtUsd(p.monto_promedio)}</td>
                <td className="text-right">
                  {p.n_fraudes_simulados > 0 ? (
                    <span className="text-red-600 font-medium">{p.n_fraudes_simulados}</span>
                  ) : '-'}
                </td>
                <td>
                  {p.lista_restrictiva && (
                    <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded">RESTRICTIVA</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        * Fraudes simulados de la etiqueta sintética (ground truth). Cualquier siniestro asociado a un
        proveedor con lista_restrictiva = true activa la regla RF-03 y se marca como rojo automáticamente.
      </p>
    </div>
  );
}
