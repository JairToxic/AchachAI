'use client';
import { useState } from 'react';
import { nivelColor } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type AnalysisResult = {
  tipo_documento: string;
  extracted_fields: Record<string, any>;
  inconsistencias: { tipo: string; severidad: string; evidencia: string }[];
  nivel_riesgo_doc: string;
  score_doc: number;
  explicacion: string;
  raw_vision_response?: string;
};

export default function DocumentosPage() {
  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState<'factura' | 'imagen_dano' | 'parte_policial' | 'denuncia'>('factura');
  const [fechaOcurrencia, setFechaOcurrencia] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function analyze() {
    if (!file) return;
    setErr(null); setResult(null); setLoading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('tipo', tipo);
    if (fechaOcurrencia) form.append('fecha_ocurrencia', fechaOcurrencia);
    if (descripcion) form.append('descripcion_siniestro', descripcion);
    try {
      const r = await fetch(`${API}/analyze-document`, { method: 'POST', body: form });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      setResult(await r.json());
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Análisis de documentos</h1>
        <p className="text-sm text-gray-500">
          Azure Document Intelligence + GPT-4o Vision · facturas, partes policiales, fotos
        </p>
      </div>

      {/* Upload form */}
      <div className="bg-white border rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tipo de documento</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as any)}
            className="w-full px-3 py-2 border rounded-md bg-white"
          >
            <option value="factura">📄 Factura (Azure DI — extracción estructurada)</option>
            <option value="imagen_dano">🚗 Foto del daño (GPT-4o Vision)</option>
            <option value="parte_policial">👮 Parte policial (Azure DI OCR + LLM)</option>
            <option value="denuncia">📝 Denuncia (Azure DI OCR + LLM)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Archivo (PDF, JPG, PNG)</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm border rounded-md p-2 bg-white"
          />
          {file && (
            <p className="text-xs text-gray-500 mt-1">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </p>
          )}
        </div>

        {tipo === 'factura' && (
          <div>
            <label className="block text-sm font-medium mb-1">Fecha del siniestro (para validar)</label>
            <input
              type="date"
              value={fechaOcurrencia}
              onChange={(e) => setFechaOcurrencia(e.target.value)}
              className="px-3 py-2 border rounded-md bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              Si la factura tiene fecha anterior, se detecta como posible adulteración (RF-02).
            </p>
          </div>
        )}

        {tipo === 'imagen_dano' && (
          <div>
            <label className="block text-sm font-medium mb-1">Descripción del siniestro (relato del asegurado)</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Ej: 'Mi vehículo fue impactado por la parte trasera mientras estaba detenido en un semáforo...'"
              className="w-full px-3 py-2 border rounded-md bg-white text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              GPT-4o Vision compara la foto con esta narrativa para detectar incoherencias.
            </p>
          </div>
        )}

        <button
          onClick={analyze}
          disabled={!file || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium disabled:opacity-40"
        >
          {loading ? 'Analizando con Azure AI...' : 'Analizar documento'}
        </button>
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </div>

      {/* Resultados */}
      {result && (
        <div className="space-y-4">
          {/* Score banner */}
          <div className={`p-5 rounded-lg border-2 ${nivelColor(result.nivel_riesgo_doc)}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs uppercase tracking-wide opacity-70">Nivel de riesgo del documento</div>
                <div className="text-3xl font-bold mt-1">{result.nivel_riesgo_doc}</div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide opacity-70">Score</div>
                <div className="text-3xl font-bold">{result.score_doc}<span className="text-lg opacity-50">/100</span></div>
              </div>
            </div>
            <p className="mt-3 text-sm">{result.explicacion}</p>
          </div>

          {/* Inconsistencias */}
          {result.inconsistencias.length > 0 && (
            <div className="bg-white border-2 border-red-300 rounded-lg p-5">
              <h3 className="font-bold text-red-700 mb-3">⚠️ Inconsistencias detectadas ({result.inconsistencias.length})</h3>
              <div className="space-y-2">
                {result.inconsistencias.map((inc, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-red-50 rounded">
                    <span className={`text-xs font-mono px-2 py-1 rounded ${
                      inc.severidad === 'CRITICA' || inc.severidad === 'ALTA'
                        ? 'bg-red-600 text-white'
                        : inc.severidad === 'MEDIA'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-400 text-white'
                    }`}>
                      {inc.severidad}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{inc.tipo}</div>
                      <div className="text-xs text-gray-700 mt-0.5">{inc.evidencia}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Campos extraídos */}
          {Object.keys(result.extracted_fields).length > 0 && (
            <div className="bg-white border rounded-lg p-5">
              <h3 className="font-semibold mb-3">Campos extraídos por Azure AI</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(result.extracted_fields).map(([k, v]) => (
                  <div key={k} className="flex border-b border-gray-100 py-1.5">
                    <span className="text-gray-500 font-mono text-xs w-1/3">{k}</span>
                    <span className="flex-1 font-medium text-xs break-all">
                      {typeof v === 'object' ? JSON.stringify(v) : String(v).slice(0, 200)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.raw_vision_response && (
            <details className="bg-gray-50 border rounded-lg p-4 text-xs">
              <summary className="cursor-pointer font-semibold">Respuesta cruda de GPT-4o Vision</summary>
              <pre className="mt-2 whitespace-pre-wrap font-mono">{result.raw_vision_response}</pre>
            </details>
          )}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <strong>💡 Cómo se reduce falsos positivos:</strong>
        <p className="mt-1">
          El score del modelo XGBoost puede dudar (ej: robo el día 1 de póliza = 80% prob fraude).
          Al analizar la <strong>denuncia policial</strong> con Azure DI y la <strong>foto del daño</strong> con
          GPT-4o Vision, podemos confirmar si los documentos respaldan la historia. Si los documentos son
          coherentes, el caso pasa de ROJO a VERDE. Si las facturas tienen fecha previa al evento,
          se confirma sospecha de fraude (RF-02).
        </p>
      </div>
    </div>
  );
}
