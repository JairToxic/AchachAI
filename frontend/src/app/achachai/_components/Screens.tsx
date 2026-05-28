'use client';
// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Condor, VueloDelCondor } from './Condor';

const useSc = useState;
const useScE = useEffect;
const useScR = useRef;

/* ============================================================
   KANBAN — Bandeja de casos (CU-03)
   ============================================================ */

export const KANBAN_DATA = {
  rojo: [
    { id: "SIN-100029", score: 87, monto: "$8.450", ciudad: "Quito Norte", cobertura: "DM total", reglas: ["RF-01", "RF-04"], prov: "PRV-NEW0019" },
    { id: "SIN-100456", score: 82, monto: "$11.200", ciudad: "Cumbayá", cobertura: "DM parcial", reglas: ["RF-03"], prov: "PRV-NEW0019" },
    { id: "SIN-100789", score: 78, monto: "$6.900", ciudad: "Guayaquil C.", cobertura: "RC", reglas: ["RF-02", "RF-05"], prov: "PRV-0042" },
    { id: "SIN-101102", score: 73, monto: "$4.300", ciudad: "Cuenca", cobertura: "DM total", reglas: ["RF-06"], prov: "PRV-0007" },
  ],
  amarillo: [
    { id: "SIN-101205", score: 58, monto: "$3.100", ciudad: "Quito Sur", cobertura: "DM parcial", reglas: ["S-09", "S-12"], prov: "PRV-0019" },
    { id: "SIN-101311", score: 52, monto: "$2.480", ciudad: "Ambato", cobertura: "RC", reglas: ["S-04"], prov: "PRV-0088" },
    { id: "SIN-101420", score: 47, monto: "$5.760", ciudad: "Guayaquil N.", cobertura: "DM total", reglas: ["S-11"], prov: "PRV-0103" },
    { id: "SIN-101501", score: 41, monto: "$1.890", ciudad: "Manta", cobertura: "RC", reglas: ["S-02"], prov: "PRV-0044" },
  ],
  verde: [
    { id: "SIN-101620", score: 22, monto: "$1.240", ciudad: "Loja", cobertura: "DM parcial", reglas: [], prov: "PRV-0011" },
    { id: "SIN-101725", score: 18, monto: "$890", ciudad: "Quito Norte", cobertura: "RC", reglas: [], prov: "PRV-0033" },
    { id: "SIN-101830", score: 14, monto: "$2.100", ciudad: "Cumbayá", cobertura: "DM total", reglas: [], prov: "PRV-0011" },
  ],
};

export function KanbanScreen({ onInvestigate }) {
  // Iniciamos VACIO para no mostrar datos hardcoded mientras el backend responde.
  const [liveData, setLiveData] = useSc({ rojo: [], amarillo: [], verde: [] });
  const [loading, setLoading] = useSc(true);
  const [loadErr, setLoadErr] = useSc(null);
  const [sucursales, setSucursales] = useSc<any[]>([]);
  const [filtroSucursal, setFiltroSucursal] = useSc<string>("");  // "" = todas
  const API = (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL) || "http://localhost:8000";

  // Cargar lista de sucursales una vez
  useScE(() => {
    fetch(`${API}/sucursales/ranking?top_n=30`)
      .then(r => r.ok ? r.json() : { top: [] })
      .then(d => setSucursales(d.top || []))
      .catch(() => setSucursales([]));
  }, []);

  useScE(() => {
    setLoading(true);
    setLoadErr(null);
    fetch(`${API}/top-riesgo?limit=40`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        const buckets = { rojo: [], amarillo: [], verde: [] };
        for (const c of data.top || []) {
          // Filtro de sucursal en cliente (el backend evalua todo y filtramos arriba).
          // Nota: el endpoint /top-riesgo NO devuelve sucursal; usamos ciudad como proxy
          // que comparte nombre con la sucursal en la mayoria de casos.
          if (filtroSucursal && c.ciudad && !c.ciudad.toLowerCase().includes(filtroSucursal.toLowerCase())) {
            continue;
          }
          const key = c.nivel === "ROJO" ? "rojo" : c.nivel === "AMARILLO" ? "amarillo" : "verde";
          if (buckets[key].length < 8) {
            buckets[key].push({
              id: c.id_siniestro,
              score: c.score,
              monto: `$${(c.monto_reclamado_usd || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
              ciudad: c.ciudad || "—",
              cobertura: c.cobertura,
              reglas: c.reglas_disparadas || [],
              prov: c.id_proveedor || "—",
            });
          }
        }
        if (buckets.verde.length === 0 && !filtroSucursal) {
          return fetch(`${API}/casos?limit=3`).then(r => r.json()).then(d => {
            buckets.verde = (d.items || []).slice(0, 3).map(s => ({
              id: s.id_siniestro, score: 18,
              monto: `$${(s.monto_reclamado_usd || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
              ciudad: s.ciudad_evento, cobertura: s.cobertura, reglas: [], prov: "—",
            }));
            setLiveData(buckets);
            setLoading(false);
          });
        }
        setLiveData(buckets);
        setLoading(false);
      })
      .catch(e => {
        setLoadErr(String(e.message || e));
        setLoading(false);
      });
  }, [filtroSucursal]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--marfil)" }}>
      {/* header */}
      <div style={{ padding: "20px 32px 16px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Condor size={28} mood={loadErr ? "alert" : "speak"} tone={loadErr ? "red" : "orange"} />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 22 }}>
              Bandeja priorizada
              {loading && <span style={{ fontSize: 11, color: "var(--andes-orange)", marginLeft: 8 }}>● el cóndor está evaluando los 15K siniestros…</span>}
              {loadErr && <span style={{ fontSize: 11, color: "var(--guayaba-red)", marginLeft: 8 }}>⚠ backend caído ({loadErr})</span>}
            </h2>
            <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              {liveData.rojo[0] ? (
                <>El cóndor te recomienda empezar por <span className="mono" style={{ color: "var(--guayaba-red)", fontWeight: 600 }}>{liveData.rojo[0].id}</span> · score {liveData.rojo[0].score}</>
              ) : loading ? (
                "Sobrevolando el dataset, esto puede tardar 20-40s la primera vez…"
              ) : loadErr ? (
                <>No se pudo cargar la bandeja. Verifica que <span className="mono">uvicorn</span> esté en {API}.</>
              ) : (
                "Sin casos para mostrar."
              )}
            </div>
          </div>
          {/* filtros */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select
              className="chip outline"
              style={{ padding: "6px 10px", border: "1px solid var(--line-strong)" }}
              value={filtroSucursal}
              onChange={(e) => setFiltroSucursal(e.target.value)}
            >
              <option value="">Todas las sucursales ({sucursales.length})</option>
              {sucursales.map((s: any) => (
                <option key={s.sucursal} value={s.sucursal}>
                  {s.sucursal} ({s.n_siniestros})
                </option>
              ))}
            </select>
            {filtroSucursal && (
              <button
                className="chip outline"
                style={{ fontSize: 11, cursor: "pointer" }}
                onClick={() => setFiltroSucursal("")}
              >
                ✕ limpiar
              </button>
            )}
            <a
              className="btn ghost"
              style={{ fontSize: 12, textDecoration: "none" }}
              href={`${API}/exportar-reporte.csv?nivel=ROJO&limit=100`}
            >
              ⬇ Exportar bandeja
            </a>
          </div>
        </div>
      </div>

      {/* columns */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, padding: 20, overflow: "auto" }}>
        <KanbanColumn
          title="🔴 Descenso"
          subtitle="Revisión inmediata"
          tone="red"
          items={liveData.rojo}
          onInvestigate={onInvestigate}
        />
        <KanbanColumn
          title="🟡 Observación"
          subtitle="Requiere revisión"
          tone="amber"
          items={liveData.amarillo}
          onInvestigate={onInvestigate}
        />
        <KanbanColumn
          title="🟢 Vuelo alto"
          subtitle="Pasar a trámite normal"
          tone="green"
          items={liveData.verde}
          onInvestigate={onInvestigate}
        />
      </div>
    </div>
  );
}

function KanbanColumn({ title, subtitle, tone, items, onInvestigate }) {
  const accent = { red: "var(--guayaba-red)", amber: "var(--andes-ocher)", green: "var(--paramo-green)" }[tone];
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{
        padding: "10px 14px", background: "white", borderRadius: "12px 12px 0 0",
        border: "1px solid var(--line)", borderBottom: `3px solid ${accent}`,
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: accent }}>{title}</div>
          <div style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>{subtitle}</div>
        </div>
        <span className="chip" style={{ fontSize: 11 }}>{items.length}</span>
      </div>
      <div style={{
        flex: 1, padding: 10, overflow: "auto",
        background: "var(--marfil-paper)",
        borderRadius: "0 0 12px 12px",
        border: "1px solid var(--line)", borderTop: 0,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {items.map(it => <CaseCard key={it.id} c={it} onInvestigate={onInvestigate} />)}
      </div>
    </div>
  );
}

function CaseCard({ c, onInvestigate }) {
  return (
    <div className="card" style={{ padding: 12, cursor: "grab", display: "flex", gap: 10 }}>
      <VueloDelCondor score={c.score} variant="sm" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--mountain-blue)" }}>{c.id}</span>
          <span className="tabular mono" style={{ fontSize: 11, fontWeight: 600 }}>{c.monto}</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 2 }}>
          {c.ciudad} · {c.cobertura}
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
          {c.reglas.map(r => <span key={r} className="chip red" style={{ fontSize: 9, padding: "1px 6px" }}>{r}</span>)}
          <span className="chip mono" style={{ fontSize: 9, padding: "1px 6px" }}>{c.prov}</span>
        </div>
        {c.score >= 70 && (
          <button onClick={() => onInvestigate && onInvestigate(c.id)} className="chip outline"
            style={{ marginTop: 8, fontSize: 10, cursor: "pointer", background: "white" }}>
            🦅 Investigar profundo
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   DOCUMENTS — CU-01 + Scanner
   ============================================================ */
export function DocumentsScreen({ onInvestigate }: any = {}) {
  const [scanning, setScanning] = useSc(false);
  const [done, setDone] = useSc(false);
  const [result, setResult] = useSc<any>(null);
  const [error, setError] = useSc<any>(null);
  const [fileName, setFileName] = useSc("");
  const [tipoSel, setTipoSel] = useSc<string>("auto");
  const [vincularSin, setVincularSin] = useSc<string>("");
  const [casoCtx, setCasoCtx] = useSc<any>(null);
  const fileInputRef = useScR<any>(null);
  const API = (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL) || "http://localhost:8000";

  function trigger() {
    if (fileInputRef.current) fileInputRef.current.click();
  }

  // Si el usuario ingresa un id_siniestro, traemos su contexto (fecha + descripcion)
  // para enriquecer el analisis (necesario para factura y vision)
  useScE(() => {
    if (!vincularSin || vincularSin.length < 5) { setCasoCtx(null); return; }
    let cancelled = false;
    fetch(`${API}/casos/${encodeURIComponent(vincularSin)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) setCasoCtx(d); })
      .catch(() => { if (!cancelled) setCasoCtx(null); });
    return () => { cancelled = true; };
  }, [vincularSin]);

  async function handleUpload(e: any) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setScanning(true); setDone(false); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Tipo: usar el seleccionado o auto-detectar
      let tipo = tipoSel;
      if (tipo === "auto") {
        tipo = /factura/i.test(file.name) ? "factura"
             : /foto|imag|jpg|jpeg|png/i.test(file.name) ? "imagen_dano"
             : /policial|parte|denun/i.test(file.name) ? "parte_policial"
             : "factura";
      }
      fd.append("tipo", tipo);

      // Vinculacion al siniestro: si la hay, el backend persiste el documento
      if (vincularSin && casoCtx?.siniestro) {
        fd.append("id_siniestro", casoCtx.siniestro.id_siniestro);
        fd.append("analista_id", "ana.yanez");
      }

      // Contexto del siniestro
      const fechaCtx = casoCtx?.siniestro?.fecha_ocurrencia
        ? String(casoCtx.siniestro.fecha_ocurrencia).slice(0, 10)
        : "2024-08-15";
      fd.append("fecha_ocurrencia", fechaCtx);

      if (tipo === "imagen_dano") {
        const desc = casoCtx?.descripcion || "Daño en vehículo";
        fd.append("descripcion_siniestro", desc);
      } else if (casoCtx?.descripcion) {
        fd.append("descripcion_siniestro", casoCtx.descripcion);
      }

      const resp = await fetch(`${API}/analyze-document`, { method: "POST", body: fd });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setResult({ ...data, _vinculado_a: vincularSin || null });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScanning(false);
      setDone(true);
    }
  }

  return (
    <div style={{ height: "100%", overflow: "auto", background: "var(--marfil)", padding: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <Condor size={32} mood="alert" tone="orange" />
        <div>
          <h2 style={{ fontSize: 22 }}>El cóndor escanea</h2>
          <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
            Soltá facturas, partes policiales o fotos. Azure Document Intelligence + GPT-4o Vision analizan en segundos.
          </div>
        </div>
      </div>

      {/* Selector de vinculacion al siniestro */}
      <div className="card" style={{ padding: 14, marginBottom: 14, display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 10, alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 10.5, color: "var(--ink-mute)", letterSpacing: ".04em", marginBottom: 4, textTransform: "uppercase" }}>
            Vincular a siniestro (opcional, pero recomendado)
          </div>
          <input
            value={vincularSin}
            onChange={(e) => setVincularSin(e.target.value)}
            placeholder="ej. SIN-100029 — sin esto el análisis no cruza fechas ni narrativa"
            style={{
              width: "100%", padding: "8px 12px", fontSize: 12, border: "1px solid var(--line-strong)",
              borderRadius: 6, boxSizing: "border-box", background: "white",
            }}
          />
          {casoCtx && casoCtx.siniestro && (
            <div style={{ fontSize: 10.5, color: "var(--paramo-green)", marginTop: 4 }}>
              ✓ {casoCtx.siniestro.id_siniestro} · {casoCtx.siniestro.cobertura} · {String(casoCtx.siniestro.fecha_ocurrencia).slice(0,10)} · {casoCtx.siniestro.ciudad_evento}
            </div>
          )}
          {vincularSin && !casoCtx && vincularSin.length >= 5 && (
            <div style={{ fontSize: 10.5, color: "var(--guayaba-red)", marginTop: 4 }}>
              ✗ No encontré ese siniestro. Verificá el ID.
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: "var(--ink-mute)", letterSpacing: ".04em", marginBottom: 4, textTransform: "uppercase" }}>
            Tipo de documento
          </div>
          <select
            value={tipoSel}
            onChange={(e) => setTipoSel(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", fontSize: 12, border: "1px solid var(--line-strong)", borderRadius: 6, background: "white" }}
          >
            <option value="auto">Auto-detectar por nombre</option>
            <option value="factura">Factura (Azure DI prebuilt-invoice)</option>
            <option value="imagen_dano">Foto del daño (GPT-4o Vision)</option>
            <option value="parte_policial">Parte policial (OCR + LLM)</option>
            <option value="denuncia">Denuncia (OCR + LLM)</option>
            <option value="documento">Otro documento</option>
          </select>
        </div>
        <div>
          {casoCtx?.siniestro && onInvestigate && (
            <button
              className="btn ghost"
              onClick={() => onInvestigate(casoCtx.siniestro.id_siniestro)}
              style={{ width: "100%", fontSize: 11 }}
            >
              🦅 Ver caso en Modo Investigación →
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18 }}>
        {/* drop zone */}
        <div className="card" style={{ padding: 0, overflow: "hidden", minHeight: 360 }}>
          <div onClick={trigger} style={{
            position: "relative", padding: 40, minHeight: 360, cursor: "pointer",
            background: "linear-gradient(180deg, var(--marfil-paper), white)",
            border: "2px dashed var(--line-strong)", margin: 14, borderRadius: 14,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
            overflow: "hidden",
          }}>
            {/* condor planning */}
            <div style={{ animation: scanning ? "dive 1s infinite" : "glide 4s infinite ease-in-out" }}>
              <Condor size={64} mood="still" tone="wing" />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontFamily: "var(--serif)", color: "var(--condor-wing)" }}>
                Soltá aquí facturas, partes policiales, fotos o videos
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>
                PDF · JPG · PNG · MP4 (preview) · hasta 25 MB
              </div>
            </div>
            <button className="btn warm" onClick={(e) => { e.stopPropagation(); trigger(); }}>Subir documento</button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              style={{ display: "none" }}
              onChange={handleUpload}
            />

            {scanning && (
              <>
                <div style={{
                  position: "absolute", left: 0, right: 0, height: 30,
                  background: "linear-gradient(180deg, transparent, rgba(232,122,79,0.55), transparent)",
                  animation: "scan-beam 2s linear infinite",
                  pointerEvents: "none",
                }}/>
                <div style={{
                  position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center",
                  fontSize: 11, color: "var(--andes-orange)", fontWeight: 600,
                }}>
                  Azure Document Intelligence → GPT-4o Vision → embeddings…
                </div>
              </>
            )}
          </div>
        </div>

        {/* result */}
        <div className="card" style={{ padding: 20, minHeight: 360 }}>
          {!done && !scanning && (
            <div style={{ color: "var(--ink-mute)", textAlign: "center", paddingTop: 80, fontSize: 13 }}>
              El resultado del escaneo aparecerá aquí.
              <div style={{ marginTop: 14 }}>
                <Condor size={36} mood="idle" tone="wing" />
              </div>
            </div>
          )}
          {scanning && (
            <div style={{ paddingTop: 40, textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 14 }}>
                <Condor size={11} tone="orange" mood="still"/> el cóndor está leyendo…
              </div>
              <ScanProgress />
            </div>
          )}
          {done && error && (
            <div className="fade-up" style={{ padding: 14, background: "rgba(197,51,58,0.08)", borderRadius: 10, color: "var(--guayaba-red)", fontSize: 12 }}>
              <strong>Error al analizar:</strong> {error}
            </div>
          )}
          {done && result && !error && (
            <div className="fade-up">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10.5, letterSpacing: ".12em", color: "var(--ink-mute)" }}>
                    {result.tipo_documento === "factura" ? "FACTURA · invoice-prebuilt" : result.tipo_documento.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{fileName}</div>
                </div>
                <VueloDelCondor score={result.score_doc || 0} variant="sm" />
              </div>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <tbody>
                  {Object.entries(result.extracted_fields || {}).slice(0, 8).map(([k, v], i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "8px 4px", color: "var(--ink-mute)", fontSize: 11 }}>{k}</td>
                      <td className="mono" style={{ padding: "8px 4px", fontSize: 11.5, color: "var(--condor-wing)" }}>
                        {typeof v === "object" ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 60)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.inconsistencias && result.inconsistencias.length > 0 && (
                <div style={{ marginTop: 14, padding: 12, background: "rgba(197,51,58,0.08)", borderRadius: 10, borderLeft: "3px solid var(--guayaba-red)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--guayaba-red)", marginBottom: 6 }}>
                    ⚠️ {result.inconsistencias.length} inconsistencia(s) detectada(s)
                  </div>
                  {result.inconsistencias.slice(0, 3).map((inc, i) => (
                    <div key={i} style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>
                      <strong style={{ color: "var(--guayaba-red)" }}>[{inc.severidad}]</strong> {inc.evidencia}
                    </div>
                  ))}
                </div>
              )}
              <div style={{
                marginTop: 14, padding: 12, background: "rgba(232,122,79,0.08)", borderRadius: 10,
                fontSize: 12, color: "var(--condor-wing)", borderLeft: "3px solid var(--andes-orange)",
              }}>
                <Condor size={14} tone="orange" mood="still" /> <strong>El cóndor opina:</strong> "{result.explicacion || 'Analizado.'}"
              </div>
            </div>
          )}
        </div>
      </div>

      {/* historical */}
      <div style={{ marginTop: 22 }}>
        <div className="diamond-divider" style={{ marginBottom: 10 }}>Documentos analizados hoy</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { type: "Factura", id: "FAC-0813", score: 81, tone: "red" },
            { type: "Parte policial", id: "EXP-002915", score: 64, tone: "amber" },
            { type: "Foto daño", id: "IMG-44210", score: 78, tone: "red" },
            { type: "Certificado", id: "CRT-1001", score: 12, tone: "green" },
          ].map((d, i) => (
            <div key={i} className="card" style={{ padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
              <VueloDelCondor score={d.score} variant="sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 500 }}>{d.type}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>{d.id}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScanProgress() {
  const items = [
    "Azure Document Intelligence — OCR",
    "Extracción de 13 campos estructurados",
    "GPT-4o Vision — análisis visual",
    "Embeddings — buscando duplicados",
    "Síntesis del cóndor",
  ];
  const [i, setI] = useSc(0);
  useScE(() => {
    const t = setInterval(() => setI(x => Math.min(x + 1, items.length - 1)), 600);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display: "grid", gap: 6, maxWidth: 280, margin: "0 auto" }}>
      {items.slice(0, i + 1).map((it, k) => (
        <div key={k} className="fade-up" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11.5 }}>
          {k === i ? (
            <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid var(--andes-orange)", borderTopColor: "transparent", animation: "spin-slow 0.8s linear infinite" }}/>
          ) : (
            <span style={{ color: "var(--paramo-green)" }}>✓</span>
          )}
          {it}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   TEJIDO DEL FRAUDE — Andean loom network with discovery animation
   The cóndor flies over the canvas, scans it, and reveals the pattern
   in 5 phases. The user can replay it any time.
   ============================================================ */

export const TEJIDO_PROVIDERS = [
  { id: "PRV-NEW0019", x: 360, y: 220, r: 26, hot: true,  label: "Auto Servicio Andes" },
  { id: "PRV-0007",    x: 720, y: 290, r: 22, hot: true,  label: "Taller Cumbayá" },
  { id: "PRV-0042",    x: 240, y: 430, r: 20, hot: true,  label: "Clínica San Rafael" },
  { id: "PRV-0019",    x: 820, y: 460, r: 18, hot: false, label: "Multipartes Guayas" },
  { id: "PRV-0103",    x: 540, y: 480, r: 16, hot: false, label: "Repuestos del Valle" },
  { id: "PRV-0011",    x: 940, y: 170, r: 14, hot: false, label: "Carrocerías Norte" },
];

export const TEJIDO_INSUREDS = (() => {
  const arr = [];
  TEJIDO_PROVIDERS.forEach((p, pi) => {
    const count = p.hot ? 8 : 5;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + pi * 0.6;
      const dist = 88 + (i % 3) * 26;
      arr.push({
        x: p.x + Math.cos(angle) * dist,
        y: p.y + Math.sin(angle) * dist,
        prv: p.id,
        hot: p.hot,
        delay: i * 80 + (p.hot ? 0 : 200),
      });
    }
  });
  return arr;
})();

// path the cóndor flies along during scanning phase
export const CONDOR_FLIGHT_PATH = "M 60 80 Q 280 40 540 160 T 1020 240 Q 700 360 360 220 Q 220 380 240 430";

export const TEJIDO_PHASES = [
  { id: 0, label: "Listo para investigar" },
  { id: 1, label: "Escaneando red…" },
  { id: 2, label: "Conectando hilos…" },
  { id: 3, label: "Detectando concentración…" },
  { id: 4, label: "Cruzando proveedores…" },
  { id: 5, label: "Patrón detectado ✓" },
];

export function TejidoScreen({ onInvestigate, onVerAsegurado }: any = {}) {
  const API = (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL) || "http://localhost:8000";
  const [red, setRed] = useSc<any>(null);
  const [loading, setLoading] = useSc(true);
  const [minSiniestros, setMinSiniestros] = useSc(5);
  const [selProv, setSelProv] = useSc<string | null>(null);

  useScE(() => {
    setLoading(true);
    fetch(`${API}/red-relaciones?min_siniestros=${minSiniestros}`)
      .then(r => r.json())
      .then(d => { setRed(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [minSiniestros]);

  // Indexamos
  const providers = (red?.nodes || []).filter((n: any) => n.type === "proveedor");
  const insureds = (red?.nodes || []).filter((n: any) => n.type === "asegurado");
  const edges = red?.edges || [];

  // Por proveedor: lista de asegurados conectados (recurrentes) y total de casos
  const provClusters = providers.map((p: any) => {
    const conn = edges.filter((e: any) => e.target === p.id);
    const totalEdges = conn.reduce((a: number, e: any) => a + (e.weight || 1), 0);
    return {
      ...p,
      n_asegurados_conectados: conn.length,       // recurrentes del filtro
      n_asegurados_total: p.n_asegurados_total || 0, // total distintos sin filtro
      n_casos_compartidos: totalEdges,
      asegurados: conn.map((e: any) => e.source),
    };
  })
  // Orden: primero los con asegurados recurrentes (interesantes), luego por # casos
  .sort((a: any, b: any) => {
    if (b.n_asegurados_conectados !== a.n_asegurados_conectados) {
      return b.n_asegurados_conectados - a.n_asegurados_conectados;
    }
    return b.n - a.n;
  });

  const topCluster = provClusters[0];
  const clusterSeleccionado = selProv ? provClusters.find((p: any) => p.id === selProv) : null;
  const asegInSel = new Set(clusterSeleccionado?.asegurados || []);

  return (
    <div style={{ height: "100%", overflow: "auto", background: "var(--marfil)" }}>
      {/* HEADER */}
      <div style={{
        padding: "20px 32px", borderBottom: "1px solid var(--line)",
        background: "linear-gradient(180deg, rgba(232,122,79,0.06), transparent)",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <Condor size={32} mood="speak" tone="wing" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, letterSpacing: ".18em", color: "var(--andes-orange)", fontWeight: 700, textTransform: "uppercase" }}>
            🕸 Red de relaciones · cruzando asegurados con proveedores
          </div>
          <h2 style={{ fontSize: 22, marginTop: 2 }}>¿Quién comparte taller con quién?</h2>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>Densidad del grafo</div>
          <select
            value={minSiniestros}
            onChange={(e) => setMinSiniestros(+e.target.value)}
            style={{ padding: "6px 10px", border: "1px solid var(--line-strong)", borderRadius: 6, marginTop: 4 }}
            title="Umbral mínimo de siniestros que debe tener un proveedor para aparecer. Los asegurados usan un umbral más bajo automáticamente."
          >
            <option value={3}>Todas las relaciones (proveedor ≥3)</option>
            <option value={5}>Activos (proveedor ≥5)</option>
            <option value={10}>Importantes (proveedor ≥10)</option>
            <option value={20}>Solo grandes (proveedor ≥20)</option>
          </select>
          {red?.stats && (
            <div style={{ fontSize: 9.5, color: "var(--ink-mute)", marginTop: 4 }}>
              prov ≥{red.stats.min_prov_aplicado} · aseg ≥{red.stats.min_aseg_aplicado} · pares ≥{red.stats.min_par_aplicado}
            </div>
          )}
        </div>
      </div>

      {/* EXPLAINER — para qué sirve */}
      <div style={{ padding: "16px 32px 0" }}>
        <div className="card" style={{ padding: 16, background: "linear-gradient(180deg, white, var(--marfil-paper))", borderLeft: "3px solid var(--andes-orange)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--andes-orange)" }}>
            ¿Para qué sirve esta pantalla?
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, fontSize: 12, lineHeight: 1.55, color: "var(--ink-soft)" }}>
            <div>
              <div style={{ fontSize: 20, marginBottom: 4 }}>🎯</div>
              <strong>El problema:</strong> Un siniestro suelto puede parecer normal. Pero si 5 asegurados distintos pasan todos por el mismo taller chiquito en Quito, eso huele a coordinación.
            </div>
            <div>
              <div style={{ fontSize: 20, marginBottom: 4 }}>🕸</div>
              <strong>Qué hace el cóndor:</strong> cruza todos los siniestros contra todos los proveedores y dibuja las conexiones. Cuanto más asegurados conecta UN proveedor, más sospechoso.
            </div>
            <div>
              <div style={{ fontSize: 20, marginBottom: 4 }}>✋</div>
              <strong>Qué hacés vos:</strong> click en un proveedor del grafo o de la lista → ves a quiénes conecta → investigás los casos uno por uno y decidís si es coincidencia o red organizada.
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ padding: "16px 32px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <MiniKpi label="Proveedores en el grafo" value={providers.length || (loading ? "…" : 0)} />
        <MiniKpi label="Asegurados conectados" value={insureds.length || (loading ? "…" : 0)} />
        <MiniKpi label="Relaciones detectadas" value={edges.length || (loading ? "…" : 0)} tone="orange" />
        <MiniKpi label="Cluster más grande"
                 value={topCluster ? `${topCluster.n_asegurados_conectados} aseg.` : "…"}
                 tone="red" />
      </div>

      {/* CUERPO: grafo + lista */}
      <div style={{ padding: "0 32px 32px", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
        {/* Grafo bipartito interactivo */}
        <div className="card" style={{ padding: 0, overflow: "hidden", minHeight: 520 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              <strong>Grafo bipartito:</strong> asegurados (izquierda, azul) ←→ proveedores (derecha, rojo si lista restrictiva)
            </span>
            {selProv && (
              <button className="chip outline" style={{ marginLeft: "auto", fontSize: 10, cursor: "pointer" }} onClick={() => setSelProv(null)}>
                ✕ deseleccionar
              </button>
            )}
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <Condor size={48} mood="think" tone="orange" />
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-mute)" }}>Tejiendo la red…</div>
            </div>
          ) : (
            <BipartiteGraph
              providers={provClusters}
              insureds={insureds}
              edges={edges}
              selProv={selProv}
              asegInSel={asegInSel}
              onSelectProv={setSelProv}
              onVerAsegurado={onVerAsegurado}
            />
          )}
        </div>

        {/* Lista de clusters accionable */}
        <div className="card" style={{ padding: 18, minHeight: 520, overflow: "auto" }}>
          <div className="diamond-divider" style={{ marginBottom: 12 }}>
            Clusters detectados · ordenados por # asegurados conectados
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginBottom: 10 }}>
            Cada fila = un proveedor. Si conecta a varios asegurados distintos, ese es el patrón a investigar.
          </div>

          {provClusters.length === 0 && !loading && (
            <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              Ningún proveedor cumple el umbral mínimo de {minSiniestros} siniestros.
            </div>
          )}

          <div style={{ display: "grid", gap: 8 }}>
            {provClusters.slice(0, 12).map((p: any) => {
              const sospechoso = p.restrictiva || p.n_asegurados_conectados >= 8;
              const isSel = selProv === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelProv(isSel ? null : p.id)}
                  style={{
                    padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    background: isSel ? "rgba(232,122,79,0.10)"
                              : sospechoso ? "rgba(197,51,58,0.05)" : "white",
                    border: `1px solid ${isSel ? "var(--andes-orange)"
                                        : sospechoso ? "rgba(197,51,58,0.25)" : "var(--line)"}`,
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--mountain-blue)" }}>{p.id}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.label}</span>
                    {p.restrictiva && <span className="chip red mono" style={{ fontSize: 8.5 }}>⚠ lista restrictiva</span>}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, fontSize: 10.5 }}>
                    <div title="Asegurados RECURRENTES (con varios siniestros) conectados a este proveedor en el filtro actual">
                      <div style={{ color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: ".05em", fontSize: 9 }}>
                        aseg. recurrentes
                      </div>
                      <div className="tabular" style={{ fontWeight: 600, color: sospechoso ? "var(--guayaba-red)" : "var(--condor-wing)" }}>
                        {p.n_asegurados_conectados}
                        <span style={{ fontSize: 9, color: "var(--ink-mute)", marginLeft: 3, fontWeight: 400 }}>
                          / {p.n_asegurados_total} total
                        </span>
                      </div>
                    </div>
                    <div title="Total de siniestros del proveedor (todos)">
                      <div style={{ color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: ".05em", fontSize: 9 }}>casos totales</div>
                      <div className="tabular" style={{ fontWeight: 600 }}>{p.n}</div>
                    </div>
                    <div title="Suma de pares (aseg recurrente, proveedor) en el grafo">
                      <div style={{ color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: ".05em", fontSize: 9 }}>conexiones grafo</div>
                      <div className="tabular" style={{ fontWeight: 600 }}>{p.n_casos_compartidos}</div>
                    </div>
                  </div>
                  {p.n_asegurados_conectados === 0 && p.n_asegurados_total > 0 && (
                    <div style={{ marginTop: 4, fontSize: 9.5, color: "var(--ink-mute)", fontStyle: "italic" }}>
                      Sus {p.n_asegurados_total} asegurados son de baja frecuencia — el filtro de recurrentes los excluye.
                    </div>
                  )}
                  {isSel && (
                    <div style={{ marginTop: 8, fontSize: 10.5, color: "var(--ink-soft)" }}>
                      Asegurados conectados: {p.asegurados.slice(0, 5).map((a: string) => (
                        <span key={a} className="mono"
                              style={{ marginRight: 6, color: "var(--mountain-blue)", cursor: onVerAsegurado ? "pointer" : "default", textDecoration: onVerAsegurado ? "underline" : "none" }}
                              onClick={(e) => { e.stopPropagation(); onVerAsegurado && onVerAsegurado(a); }}>
                          {a}
                        </span>
                      ))}
                      {p.asegurados.length > 5 && ` +${p.asegurados.length - 5} más`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sugerencia del cóndor */}
          {topCluster && (
            <>
              <div className="diamond-divider" style={{ margin: "18px 0 10px" }}>El cóndor te sugiere</div>
              <div style={{
                padding: 12, background: "rgba(232,122,79,0.08)", borderRadius: 10,
                fontSize: 12, lineHeight: 1.55, borderLeft: "3px solid var(--andes-orange)",
              }}>
                El cluster más grande es <strong className="mono">{topCluster.id}</strong> (<em>{topCluster.label}</em>)
                que conecta a <strong>{topCluster.n_asegurados_conectados}</strong> asegurados distintos.
                {topCluster.restrictiva
                  ? " Ya está en lista restrictiva — frenar los pagos pendientes."
                  : ` Aún no está en lista restrictiva. Te recomiendo abrir investigación cruzada.`}
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="btn warm" style={{ fontSize: 10.5, padding: "5px 10px" }}
                          onClick={() => setSelProv(topCluster.id)}>
                    Ver sus conexiones en el grafo →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Grafo bipartito real ----------------
   Layout simple, no fuerza fisica. Insureds a la izquierda en columna,
   proveedores a la derecha. Edges como lineas curvas. Clickeable.
*/
function BipartiteGraph({ providers, insureds, edges, selProv, asegInSel, onSelectProv, onVerAsegurado }: any) {
  // Limitamos para no saturar — y FILTRAMOS proveedores SIN conexiones
  // (no aportan visualmente al grafo bipartito)
  const maxInsureds = 40;
  const maxProviders = 15;
  const aseg = insureds.slice(0, maxInsureds);
  const provs = providers
    .filter((p: any) => p.n_asegurados_conectados > 0)
    .slice(0, maxProviders);

  const W = 900;
  const H = Math.max(520, Math.max(aseg.length, provs.length) * 22 + 80);
  const leftX = 110;
  const rightX = W - 140;

  // Posiciones
  const asegPos = new Map<string, { x: number; y: number }>();
  aseg.forEach((a: any, i: number) => {
    asegPos.set(a.id, { x: leftX, y: 40 + (i + 0.5) * ((H - 80) / aseg.length) });
  });
  const provPos = new Map<string, { x: number; y: number; r: number }>();
  provs.forEach((p: any, i: number) => {
    const r = 8 + Math.min(p.n_asegurados_conectados || 1, 14);
    provPos.set(p.id, { x: rightX, y: 40 + (i + 0.5) * ((H - 80) / provs.length), r });
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", display: "block" }}>
      <defs>
        <pattern id="loom-bg" width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M11 0 L22 11 L11 22 L0 11 Z" fill="none" stroke="rgba(26,58,82,0.05)" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#loom-bg)" />

      {/* Header de columnas */}
      <text x={leftX} y={20} fontSize="11" fill="var(--mountain-blue)" fontWeight="700" textAnchor="middle">
        ASEGURADOS ({aseg.length})
      </text>
      <text x={rightX} y={20} fontSize="11" fill="var(--guayaba-red)" fontWeight="700" textAnchor="middle">
        PROVEEDORES ({provs.length})
      </text>

      {/* Edges */}
      {edges.map((e: any, i: number) => {
        const a = asegPos.get(e.source);
        const p = provPos.get(e.target);
        if (!a || !p) return null;
        const sel = selProv ? (e.target === selProv) : null;
        const dim = sel === false;
        const hi = sel === true;
        const ctrlX = (a.x + p.x) / 2;
        return (
          <path
            key={i}
            d={`M ${a.x} ${a.y} Q ${ctrlX} ${(a.y + p.y) / 2} ${p.x} ${p.y}`}
            stroke={hi ? "var(--guayaba-red)" : "var(--mountain-blue)"}
            strokeWidth={hi ? 1.6 : 0.7}
            fill="none"
            opacity={dim ? 0.05 : hi ? 0.85 : 0.30}
          />
        );
      })}

      {/* Asegurados (left col) */}
      {aseg.map((a: any) => {
        const pos = asegPos.get(a.id)!;
        const sel = asegInSel?.has(a.id);
        return (
          <g key={a.id}
             style={{ cursor: onVerAsegurado ? "pointer" : "default" }}
             onClick={() => onVerAsegurado && onVerAsegurado(a.id)}>
            <circle cx={pos.x} cy={pos.y} r={sel ? 6 : 4}
                    fill={sel ? "var(--guayaba-red)" : "var(--mountain-blue)"}
                    stroke="white" strokeWidth="1.5" />
            <text x={pos.x - 12} y={pos.y + 4} fontSize="9" textAnchor="end"
                  fill={sel ? "var(--guayaba-red)" : "var(--ink-mute)"} fontWeight={sel ? 700 : 400}>
              {a.id}
            </text>
          </g>
        );
      })}

      {/* Proveedores (right col) */}
      {provs.map((p: any) => {
        const pos = provPos.get(p.id)!;
        const sel = selProv === p.id;
        const hot = p.restrictiva || p.n_asegurados_conectados >= 8;
        return (
          <g key={p.id}
             style={{ cursor: "pointer" }}
             onClick={() => onSelectProv(sel ? null : p.id)}>
            {sel && (
              <circle cx={pos.x} cy={pos.y} r={pos.r + 6}
                      fill="none" stroke="var(--andes-orange)" strokeWidth="2"
                      style={{ animation: "sonar-out 1.8s ease-out infinite" }} />
            )}
            <circle cx={pos.x} cy={pos.y} r={pos.r}
                    fill={hot ? "var(--guayaba-red)" : "var(--mountain-blue-deep)"}
                    stroke="white" strokeWidth="2" />
            <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="white"
                  fontSize="8" fontWeight="700">
              {p.n_asegurados_conectados}
            </text>
            <text x={pos.x + pos.r + 8} y={pos.y - 3} fontSize="10"
                  fill="var(--condor-wing)" fontWeight={sel ? 700 : 500}>
              {p.id}
            </text>
            <text x={pos.x + pos.r + 8} y={pos.y + 8} fontSize="9" fill="var(--ink-mute)">
              {(p.label || "").slice(0, 22)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function TejidoCanvas({ phase }) {
  return (
    <svg viewBox="0 0 1100 600" style={{ width: "100%", height: "100%" }}>
      <defs>
        <pattern id="loom" width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M11 0 L22 11 L11 22 L0 11 Z" fill="none" stroke="rgba(26,58,82,0.06)" />
        </pattern>
        <radialGradient id="hot-glow">
          <stop offset="0%" stopColor="rgba(197,51,58,0.40)"/>
          <stop offset="100%" stopColor="rgba(197,51,58,0)"/>
        </radialGradient>
        <radialGradient id="scan-pulse">
          <stop offset="0%" stopColor="rgba(232,122,79,0.30)"/>
          <stop offset="100%" stopColor="rgba(232,122,79,0)"/>
        </radialGradient>
        {/* gradient stroke for cluster-connecting curve */}
        <linearGradient id="cluster-trace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C5333A"/>
          <stop offset="100%" stopColor="#E87A4F"/>
        </linearGradient>
      </defs>

      <rect width="1100" height="600" fill="url(#loom)" />

      {/* warp threads of the loom */}
      {[...Array(22)].map((_, i) => (
        <line key={i} x1={i * 50} y1="0" x2={i * 50} y2="600" stroke="rgba(232,122,79,0.04)" />
      ))}

      {/* invisible cóndor path (for animateMotion) */}
      <path id="flight" d={CONDOR_FLIGHT_PATH} fill="none" stroke="none"/>

      {/* PHASE 2+: edges */}
      {TEJIDO_INSUREDS.map((n, i) => {
        const p = TEJIDO_PROVIDERS.find(pp => pp.id === n.prv);
        const visible = phase >= 2;
        return (
          <line key={i} x1={n.x} y1={n.y} x2={p.x} y2={p.y}
            stroke={n.hot && phase >= 3 ? "rgba(197,51,58,0.55)" : n.hot ? "rgba(197,51,58,0.30)" : "rgba(44,95,141,0.20)"}
            strokeWidth={n.hot ? 0.9 : 0.6}
            style={{
              opacity: visible ? 1 : 0,
              transition: `opacity 0.6s ease ${n.delay}ms`,
            }}/>
        );
      })}

      {/* PHASE 3+: hot glow around suspicious providers */}
      {TEJIDO_PROVIDERS.filter(p => p.hot).map(p => (
        <circle key={p.id} cx={p.x} cy={p.y} r={p.r * 3.2} fill="url(#hot-glow)"
          style={{ opacity: phase >= 3 ? 1 : 0, transition: "opacity 0.8s ease" }}/>
      ))}

      {/* PHASE 4: trace connecting the 3 hot providers (cluster discovery) */}
      {phase >= 4 && (
        <g style={{ opacity: phase >= 4 ? 1 : 0 }}>
          <path
            d="M 360 220 Q 540 100 720 290 Q 480 460 240 430 Q 200 320 360 220 Z"
            fill="rgba(197,51,58,0.08)"
            stroke="url(#cluster-trace)"
            strokeWidth="2.5"
            strokeDasharray="600"
            strokeDashoffset="600"
            style={{ animation: "draw-line 1.4s ease-out forwards" }}/>
        </g>
      )}

      {/* insured nodes — appear in phase 2 */}
      {TEJIDO_INSUREDS.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.hot && phase >= 3 ? 4.5 : 3.5}
          fill={n.hot && phase >= 3 ? "var(--andes-ocher)" : phase >= 2 ? "var(--mountain-blue)" : "var(--line-strong)"}
          opacity={phase >= 2 ? 0.9 : 0.35}
          style={{ transition: `all 0.5s ease ${n.delay}ms` }}/>
      ))}

      {/* provider nodes — always visible, but turn red in phase 3 */}
      {TEJIDO_PROVIDERS.map(p => {
        const showRed = p.hot && phase >= 3;
        return (
          <g key={p.id} style={{ opacity: phase >= 1 ? 1 : 0.4, transition: "opacity 0.5s ease" }}>
            {showRed && (
              <circle cx={p.x} cy={p.y} r={p.r + 4}
                fill="none" stroke="var(--guayaba-red)" strokeWidth="1.5"
                style={{ transformOrigin: `${p.x}px ${p.y}px`, animation: "sonar-out 1.8s ease-out infinite" }}/>
            )}
            <circle cx={p.x} cy={p.y} r={p.r}
              fill={showRed ? "var(--guayaba-red)" : "var(--mountain-blue-deep)"}
              stroke="white" strokeWidth="2"
              style={{ transition: "fill 0.6s ease" }}/>
            <text x={p.x} y={p.y + 4} textAnchor="middle" fill="white" fontSize="9" fontWeight="700">
              {p.id.replace("PRV-", "")}
            </text>
            <text x={p.x} y={p.y + p.r + 14} textAnchor="middle" fill="var(--condor-wing)" fontSize="10"
              style={{ opacity: phase >= 2 ? 1 : 0.35, transition: "opacity 0.5s ease" }}>
              {p.label}
            </text>
          </g>
        );
      })}

      {/* PHASE 1: scanning cóndor flies along the path */}
      {phase === 1 && (
        <g>
          {/* scan pulse */}
          <circle cx="0" cy="0" r="80" fill="url(#scan-pulse)">
            <animateMotion dur="2.4s" repeatCount="1" path={CONDOR_FLIGHT_PATH} rotate="auto"/>
          </circle>
          {/* the cóndor itself, scaled up and flying */}
          <g>
            <animateMotion dur="2.4s" repeatCount="1" path={CONDOR_FLIGHT_PATH} rotate="auto"/>
            <g transform="translate(-30 -30) scale(0.75)">
              <Condor size={80} tone="wing" mood="think"/>
            </g>
          </g>
        </g>
      )}

      {/* PHASE 5: cóndor lands on the central hot provider + annotation */}
      {phase >= 5 && (
        <g className="fade-up">
          <g transform="translate(330 165)">
            <Condor size={60} tone="red" mood="alert" sonar={true}/>
          </g>
          <g transform="translate(720, 130)">
            <line x1="0" y1="0" x2="0" y2="50" stroke="var(--guayaba-red)" strokeDasharray="2 3" />
            <rect x="-110" y="-46" width="220" height="42" rx="8" fill="var(--guayaba-red)" />
            <text x="0" y="-28" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" letterSpacing="0.08em">PATRÓN DETECTADO</text>
            <text x="0" y="-12" textAnchor="middle" fill="white" fontSize="11" fontWeight="500">3 proveedores · 5 asegurados · $386K</text>
          </g>
          {/* labels on each hot provider */}
          {TEJIDO_PROVIDERS.filter(p => p.hot).map((p, i) => (
            <g key={p.id} transform={`translate(${p.x + p.r + 8}, ${p.y - 18})`}>
              <rect x="0" y="0" width="48" height="18" rx="9" fill="white" stroke="var(--guayaba-red)" strokeWidth="1.2"/>
              <text x="24" y="13" textAnchor="middle" fill="var(--guayaba-red)" fontSize="10" fontWeight="700">cluster</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

/* ============================================================
   REPORTS — CU-06
   ============================================================ */
export function ReportsScreen() {
  const API = (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL) || "http://localhost:8000";
  const [kpis, setKpis] = useSc<any>(null);
  const [topCasos, setTopCasos] = useSc<any[]>([]);
  const [resumen, setResumen] = useSc<any>(null);
  const [loadingResumen, setLoadingResumen] = useSc(false);
  // Tipo seleccionado para el PDF (ReportsScreen — placeholder var name conflict, removed)
  const [tipoSel, setTipoSel] = useSc<string>("ejecutivo");
  const [nivelSel, setNivelSel] = useSc<string>("ROJO");
  const [recientes, setRecientes] = useSc<any[]>([]);
  const [generandoPdf, setGenerandoPdf] = useSc(false);

  useScE(() => {
    Promise.all([
      fetch(`${API}/kpis`).then(r => r.json()).catch(() => null),
      fetch(`${API}/top-riesgo?limit=10&nivel=ROJO`).then(r => r.json()).catch(() => ({ top: [] })),
      fetch(`${API}/reportes/recientes?limit=8`).then(r => r.json()).catch(() => ({ items: [] })),
    ]).then(([k, tr, rec]) => {
      setKpis(k);
      setTopCasos(tr?.top || []);
      setRecientes(rec?.items || []);
    });
  }, []);

  function cargarRecientes() {
    fetch(`${API}/reportes/recientes?limit=8`).then(r => r.json()).then(d => setRecientes(d?.items || []));
  }

  async function generarResumen() {
    setLoadingResumen(true);
    try {
      const r = await fetch(`${API}/reportes/ejecutivo`);
      const d = await r.json();
      setResumen(d);
    } catch (e) {
      setResumen({ response: `Error: ${e}` });
    } finally {
      setLoadingResumen(false);
    }
  }

  function descargarPdf(tipo: string, nivel: string, autoprint: boolean = true) {
    setGenerandoPdf(true);
    const url = `${API}/reportes/pdf?tipo=${tipo}&nivel=${nivel}&limit=25&analista=ana.yanez${autoprint ? "&autoprint=1" : ""}`;
    window.open(url, "_blank");
    setTimeout(() => { setGenerandoPdf(false); cargarRecientes(); }, 1200);
  }

  const totalSin = kpis?.totales?.siniestros || 0;
  const monto = kpis?.totales?.monto_reclamado_total_usd || 0;
  const fraudes = kpis?.totales?.fraudes_simulados || 0;
  const docsInc = kpis?.totales?.documentos_inconsistentes || 0;

  const REPORT_TYPES = [
    {
      id: "ejecutivo", label: "Resumen Ejecutivo", icon: "📋",
      tone: "var(--andes-orange)",
      desc: "Briefing 1-página con síntesis GPT del cóndor, KPIs y top casos.",
      audiencia: "Gerencia · Directorio",
    },
    {
      id: "antifraude", label: "Comité Antifraude", icon: "🕵️",
      tone: "var(--guayaba-red)",
      desc: "Casos rojos con score, reglas, recomendaciones y firma digital.",
      audiencia: "Comité antifraude · Investigadores",
    },
    {
      id: "auditoria", label: "Auditoría Interna", icon: "📑",
      tone: "var(--paramo-green)",
      desc: "Trazabilidad completa con hash, fecha y analista responsable.",
      audiencia: "Auditoría · SBS · Compliance",
    },
    {
      id: "directorio", label: "Briefing Directorio", icon: "💼",
      tone: "var(--mountain-blue)",
      desc: "KPIs visuales para el board: ROI, exposición prevenida, cartera.",
      audiencia: "Directorio · Junta",
    },
  ];

  return (
    <div style={{ height: "100%", overflow: "auto", background: "var(--marfil)" }}>
      {/* === HERO === */}
      <div style={{
        position: "relative", overflow: "hidden",
        padding: "32px 32px 28px",
        background: "linear-gradient(135deg, #FAF6EE 0%, #F4EDE4 60%, rgba(232,122,79,0.08) 100%)",
        borderBottom: "1px solid var(--line)",
      }}>
        {/* cóndor flotando atrás */}
        <div aria-hidden style={{
          position: "absolute", right: 24, top: 12, fontSize: 140, opacity: 0.06,
          pointerEvents: "none", animation: "condor-float 9s ease-in-out infinite",
        }}>🦅</div>

        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
          <Condor size={42} mood="speak" tone="wing" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, letterSpacing: ".22em", color: "var(--andes-orange)", fontWeight: 700, textTransform: "uppercase" }}>
              Centro de reportes · firmados digitalmente
            </div>
            <h1 style={{ fontSize: 32, marginTop: 4, fontFamily: "var(--serif)", fontWeight: 500 }}>
              El cóndor también redacta y firma.
            </h1>
            <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 4, maxWidth: 720 }}>
              Genera reportes ejecutivos, de comité antifraude, de auditoría o de directorio.
              Cada uno con datos reales en vivo, síntesis GPT, hash de firma, y listo para guardar como PDF.
            </div>
          </div>
        </div>

        {/* Mini KPIs en fila */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 22 }}>
          {[
            { lbl: "Cartera vigilada", val: totalSin ? totalSin.toLocaleString("en-US") : "…", c: "var(--condor-wing)" },
            { lbl: "Alertas históricas", val: fraudes ? fraudes.toLocaleString("en-US") : "…", c: "var(--guayaba-red)" },
            { lbl: "Monto USD total", val: monto ? `$${Math.round(monto/1000).toLocaleString("en-US")}K` : "…", c: "var(--paramo-green)" },
            { lbl: "Docs inconsistentes", val: docsInc ? docsInc.toLocaleString("en-US") : "…", c: "var(--andes-orange)" },
          ].map((k, i) => (
            <div key={k.lbl} className="fade-up" style={{
              padding: "12px 14px", background: "white", borderRadius: 10,
              borderTop: `3px solid ${k.c}`, animationDelay: `${i * 80}ms`,
            }}>
              <div style={{ fontSize: 9.5, color: "var(--ink-mute)", letterSpacing: ".1em", textTransform: "uppercase" }}>{k.lbl}</div>
              <div className="serif tabular" style={{ fontSize: 24, fontWeight: 500, color: k.c, marginTop: 2 }}>{k.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* === 4 TIPOS DE REPORTE (cards animadas) === */}
      <div style={{ padding: "28px 32px 8px" }}>
        <div className="diamond-divider" style={{ marginBottom: 14 }}>Elegí el tipo de reporte</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {REPORT_TYPES.map((rt, i) => {
            const sel = tipoSel === rt.id;
            return (
              <div
                key={rt.id}
                onClick={() => setTipoSel(rt.id)}
                className="fade-up"
                style={{
                  position: "relative", padding: 18, borderRadius: 12, cursor: "pointer",
                  background: sel ? `linear-gradient(180deg, ${rt.tone}15, white)` : "white",
                  border: sel ? `2px solid ${rt.tone}` : `1px solid var(--line)`,
                  borderTop: sel ? `4px solid ${rt.tone}` : `3px solid ${rt.tone}`,
                  transform: sel ? "translateY(-3px)" : "none",
                  boxShadow: sel ? `0 8px 22px ${rt.tone}30` : "var(--shadow-sm)",
                  transition: "all 0.2s ease",
                  animationDelay: `${i * 70}ms`,
                }}
                onMouseEnter={(e) => {
                  if (sel) return;
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 16px ${rt.tone}25`;
                }}
                onMouseLeave={(e) => {
                  if (sel) return;
                  (e.currentTarget as HTMLElement).style.transform = "none";
                  (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
                }}
              >
                {sel && (
                  <span style={{
                    position: "absolute", top: -10, right: -10,
                    width: 24, height: 24, borderRadius: "50%",
                    background: rt.tone, color: "white",
                    display: "grid", placeItems: "center",
                    fontSize: 13, fontWeight: 700,
                    boxShadow: `0 2px 10px ${rt.tone}80`, border: "2px solid white",
                  }}>✓</span>
                )}
                <div style={{ fontSize: 28, marginBottom: 8 }}>{rt.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: sel ? rt.tone : "var(--condor-wing)" }}>
                  {rt.label}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6, lineHeight: 1.45 }}>
                  {rt.desc}
                </div>
                <div style={{ fontSize: 9.5, color: rt.tone, marginTop: 10, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase" }}>
                  → {rt.audiencia}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* === Filtros + Acción principal === */}
      <div style={{ padding: "16px 32px 8px" }}>
        <div style={{
          padding: 16, background: "white", borderRadius: 12,
          border: "1px solid var(--line)",
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Nivel de casos</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["ROJO","AMARILLO","VERDE"] as const).map(n => {
                const sel = nivelSel === n;
                const c = n === "ROJO" ? "var(--guayaba-red)" : n === "AMARILLO" ? "var(--andes-orange)" : "var(--paramo-green)";
                return (
                  <button key={n}
                    onClick={() => setNivelSel(n)}
                    className={`chip ${sel ? "" : "outline"}`}
                    style={{
                      fontSize: 11, cursor: "pointer",
                      background: sel ? c : "white",
                      color: sel ? "white" : c,
                      border: `1.5px solid ${c}`,
                      padding: "5px 12px",
                    }}>{n}</button>
                );
              })}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <a className="btn ghost" style={{ fontSize: 12, textDecoration: "none" }}
             href={`${API}/exportar-reporte.csv?nivel=${nivelSel}&limit=200`}>
            ⬇ CSV plano ({nivelSel})
          </a>
          <a className="btn ghost" style={{ fontSize: 12, textDecoration: "none" }}
             href={`${API}/kpis`} target="_blank" rel="noreferrer">
            🔌 API JSON
          </a>
          <button
            className="btn warm"
            disabled={generandoPdf}
            onClick={() => descargarPdf(tipoSel, nivelSel, true)}
            style={{
              padding: "10px 18px", fontSize: 14, fontWeight: 600,
              background: generandoPdf ? "var(--ink-mute)" : "linear-gradient(135deg, var(--andes-orange), var(--guayaba-red))",
              border: 0, color: "white", borderRadius: 10,
              boxShadow: generandoPdf ? "none" : "0 4px 14px rgba(232,122,79,0.4)",
              cursor: generandoPdf ? "wait" : "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}>
            <span style={{ fontSize: 16 }}>📄</span>
            {generandoPdf ? "Abriendo PDF…" : "Generar y descargar PDF"}
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 6, paddingLeft: 4 }}>
          💡 El PDF se abre en una pestaña nueva con el diálogo de impresión listo. Elegí <strong>"Guardar como PDF"</strong> en el destino.
        </div>
      </div>

      {/* === Historial de reportes generados === */}
      {recientes.length > 0 && (
        <div style={{ padding: "20px 32px 8px" }}>
          <div className="diamond-divider" style={{ marginBottom: 12 }}>Historial · últimos {recientes.length} reportes generados</div>
          <div style={{ display: "grid", gap: 6 }}>
            {recientes.map((rep: any) => {
              const t = REPORT_TYPES.find(x => x.id === rep.tipo);
              return (
                <div key={rep.id_reporte} style={{
                  display: "grid", gridTemplateColumns: "auto 1fr auto auto auto auto",
                  gap: 12, alignItems: "center", padding: "8px 14px",
                  background: "white", borderRadius: 8, fontSize: 11.5,
                  border: `1px solid var(--line)`,
                  borderLeft: `3px solid ${t?.tone || 'var(--ink-mute)'}`,
                }}>
                  <span style={{ fontSize: 16 }}>{t?.icon || '📄'}</span>
                  <div>
                    <span style={{ fontWeight: 600 }}>{t?.label || rep.tipo}</span>
                    <span className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", marginLeft: 8 }}>{rep.id_reporte}</span>
                  </div>
                  <span className={`chip mono ${rep.nivel === 'ROJO' ? 'red' : rep.nivel === 'AMARILLO' ? 'amber' : 'green'}`} style={{ fontSize: 9.5 }}>
                    {rep.nivel}
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>
                    {rep.n_casos} casos
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>
                    {String(rep.fecha_generacion).slice(0,16).replace('T',' ')}
                  </span>
                  <button
                    className="chip outline"
                    style={{ fontSize: 10, cursor: "pointer" }}
                    onClick={() => descargarPdf(rep.tipo, rep.nivel, true)}
                  >
                    ↻ regenerar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === Botón síntesis GPT === */}
      <div style={{ padding: "20px 32px 0", textAlign: "center" }}>
        <button className="btn" onClick={generarResumen} disabled={loadingResumen}
          style={{ fontSize: 13, padding: "10px 18px" }}>
          {loadingResumen ? "🦅 redactando síntesis con GPT…" : "🦅 Pedir síntesis ejecutiva en vivo al cóndor"}
        </button>
      </div>

      {/* === Vista previa del reporte (con síntesis GPT cuando está disponible) === */}
      <div style={{ padding: "20px 32px 32px" }}>
        <div className="diamond-divider" style={{ marginBottom: 12 }}>Vista previa · cómo se ve el reporte</div>

      <div className="card" style={{ padding: 0, overflow: "hidden", maxWidth: 760, margin: "0 auto" }}>
        <div style={{ padding: "26px 32px", background: "var(--marfil-paper)", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <div style={{ fontSize: 10.5, color: "var(--andes-orange)", letterSpacing: ".2em", textTransform: "uppercase" }}>AchachAI · Aseguradora del Sur</div>
              <h1 style={{ fontSize: 30, fontFamily: "var(--serif)", fontWeight: 500, marginTop: 4 }}>
                Resumen ejecutivo · datos reales
              </h1>
              <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 6 }}>
                Generado el {new Date().toLocaleString("es-EC")} · gpt-5-mini · v4.2.1
              </div>
            </div>
            <Condor size={48} mood="speak" tone="wing" />
          </div>
        </div>

        <div style={{ padding: "26px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, marginBottom: 22 }}>
            <div>
              <div className="serif tabular" style={{ fontSize: 28, fontWeight: 500, color: "var(--condor-wing)", lineHeight: 1 }}>
                {totalSin ? totalSin.toLocaleString("en-US") : "…"}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 4, letterSpacing: ".06em", textTransform: "uppercase" }}>siniestros en cartera</div>
            </div>
            <div>
              <div className="serif tabular" style={{ fontSize: 28, fontWeight: 500, color: "var(--guayaba-red)", lineHeight: 1 }}>
                {topCasos.length || "…"}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 4, letterSpacing: ".06em", textTransform: "uppercase" }}>top rojos detectados</div>
            </div>
            <div>
              <div className="serif tabular" style={{ fontSize: 28, fontWeight: 500, color: "var(--paramo-green)", lineHeight: 1 }}>
                ${Math.round(monto/1000).toLocaleString("en-US")}K
              </div>
              <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 4, letterSpacing: ".06em", textTransform: "uppercase" }}>monto reclamado total</div>
            </div>
            <div>
              <div className="serif tabular" style={{ fontSize: 28, fontWeight: 500, color: "var(--andes-orange)", lineHeight: 1 }}>
                {docsInc || "…"}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 4, letterSpacing: ".06em", textTransform: "uppercase" }}>docs inconsistentes</div>
            </div>
          </div>

          <div className="diamond-divider" style={{ marginBottom: 14 }}>Top casos rojos · live del backend</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--condor-wing)" }}>
                {["Caso", "Score", "Monto", "Ciudad", "Reglas"].map(h => (
                  <th key={h} style={{ padding: "8px 6px", textAlign: "left", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-mute)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topCasos.slice(0, 8).map((r: any) => (
                <tr key={r.id_siniestro} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td className="mono" style={{ padding: "10px 6px", color: "var(--mountain-blue)", fontWeight: 600 }}>{r.id_siniestro}</td>
                  <td style={{ padding: "10px 6px" }}><VueloDelCondor score={r.score} variant="sm"/></td>
                  <td className="tabular mono" style={{ padding: "10px 6px" }}>${(r.monto_reclamado_usd || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: "10px 6px", fontSize: 11 }}>{r.ciudad || "—"}</td>
                  <td style={{ padding: "10px 6px", fontSize: 11 }}>
                    {(r.reglas_disparadas || []).map((rg: string) => (
                      <span key={rg} className="chip red mono" style={{ fontSize: 9, marginRight: 2 }}>{rg}</span>
                    ))}
                  </td>
                </tr>
              ))}
              {topCasos.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 14, color: "var(--ink-mute)", fontSize: 12, textAlign: "center" }}>Cargando del backend…</td></tr>
              )}
            </tbody>
          </table>

          {resumen && (
            <div style={{
              marginTop: 22, padding: 18, background: "linear-gradient(180deg, rgba(232,122,79,0.06), white)",
              borderRadius: 10, borderLeft: "3px solid var(--andes-orange)",
              fontSize: 13, lineHeight: 1.65,
            }}>
              <div style={{ fontSize: 10.5, color: "var(--andes-orange)", fontWeight: 700, letterSpacing: ".12em", marginBottom: 12 }}>
                🦅 SÍNTESIS DEL CÓNDOR (GPT-5-mini · live)
              </div>
              <div className="reporte-md">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={reporteMdComponents}>
                  {resumen.response || JSON.stringify(resumen, null, 2)}
                </ReactMarkdown>
              </div>
              {resumen.tools_used && resumen.tools_used.length > 0 && (
                <div style={{
                  marginTop: 14, paddingTop: 10, borderTop: "1px dashed var(--line)",
                  fontSize: 10.5, color: "var(--ink-mute)",
                }}>
                  ⚙ Tools llamadas: {resumen.tools_used.map((t: any) => (
                    <span key={t.name} className="chip mono" style={{ fontSize: 9.5, marginLeft: 4 }}>
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {!resumen && !loadingResumen && (
            <div style={{ marginTop: 22, padding: 14, background: "var(--marfil-paper)", borderRadius: 10, fontSize: 12, color: "var(--ink-mute)", textAlign: "center" }}>
              ↑ Toca "🦅 Generar resumen ejecutivo (GPT)" para que el cóndor redacte la síntesis usando los tools.
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

/* ============================================================
   ROLES — 7 roles selector
   ============================================================ */
export const ROLES = [
  { id: "antifraude", name: "Analista Antifraude", icon: "🕵️", power: "Investigación profunda caso por caso", color: "var(--guayaba-red)" },
  { id: "siniestros", name: "Analista de Siniestros", icon: "📋", power: "Mi día priorizado en orden", color: "var(--andes-orange)" },
  { id: "jefatura", name: "Jefatura de Siniestros", icon: "📊", power: "Centro de operaciones", color: "var(--mountain-blue)" },
  { id: "riesgos", name: "Riesgos", icon: "⚠️", power: "Mapa de exposición consolidada", color: "var(--andes-ocher)" },
  { id: "auditoria", name: "Auditoría Interna", icon: "🔍", power: "Cadena de evidencia legal", color: "var(--paramo-green)" },
  { id: "tecnologia", name: "Tecnología", icon: "🛠️", power: "Salud del sistema en tiempo real", color: "var(--mountain-blue-deep)" },
  { id: "gerencia", name: "Gerencia", icon: "💼", power: "Pulso ejecutivo cartera", color: "var(--condor-wing)" },
];

export function RolesScreen({ currentRole, onPick }) {
  return (
    <div style={{ height: "100%", overflow: "auto", background: "var(--marfil)", padding: 32 }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <div style={{ fontSize: 11, letterSpacing: ".18em", color: "var(--andes-orange)", fontWeight: 600, textTransform: "uppercase" }}>
          Una bandada de cóndores
        </div>
        <h2 style={{ fontSize: 32, marginTop: 6 }}>7 ojos distintos, 1 cartera vigilada</h2>
        <div style={{ fontSize: 13, color: "var(--ink-mute)", marginTop: 6, maxWidth: 540, margin: "6px auto 0" }}>
          AchachAI reconoce a cada rol y le da una vista, prompts sugeridos y tono adaptado.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, maxWidth: 1200, margin: "0 auto" }}>
        {ROLES.map(r => (
          <div key={r.id}
            onClick={() => onPick(r.id)}
            className="card"
            style={{
              padding: 18, cursor: "pointer", position: "relative", overflow: "hidden",
              borderTop: `3px solid ${r.color}`,
              transform: currentRole === r.id ? "translateY(-2px)" : "none",
              boxShadow: currentRole === r.id ? "var(--shadow-lg)" : "var(--shadow-sm)",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `${r.color}18`,
                display: "grid", placeItems: "center", fontSize: 22,
              }}>{r.icon}</div>
              <div>
                <div style={{ fontSize: 15, fontFamily: "var(--serif)", fontWeight: 500 }}>{r.name}</div>
                <div style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: ".1em", textTransform: "uppercase" }}>Superpoder</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 12 }}>{r.power}</div>
            <div className="diamond-divider" style={{ marginBottom: 8 }}>Prompts sugeridos</div>
            {(ROLE_PROMPTS_PREVIEW[r.id] || []).map((p, i) => (
              <div key={i} style={{
                fontSize: 11, color: "var(--ink-soft)", padding: "6px 8px",
                background: "var(--marfil-paper)", borderRadius: 6, marginBottom: 4,
                borderLeft: `2px solid ${r.color}66`,
              }}>"{p}"</div>
            ))}
            {currentRole === r.id && (
              <div style={{
                position: "absolute", top: 10, right: 10,
                fontSize: 10, padding: "3px 8px", borderRadius: 999,
                background: r.color, color: "white", fontWeight: 600,
              }}>activo</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   EVALUAR — Cargar siniestro hipotetico y obtener score en vivo
   (prueba de fuego literal del jurado)
   ============================================================ */
export function EvaluarScreen({ onInvestigate }: any) {
  const API = (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL) || "http://localhost:8000";

  const [form, setForm] = useSc({
    cobertura: "Choque",
    monto_reclamado_usd: 5000,
    monto_pagado_usd: 0,
    suma_asegurada_usd: 15000,
    dias_desde_inicio_poliza: 60,
    dias_desde_fin_poliza: 305,
    dias_entre_ocurrencia_reporte: 1,
    historial_siniestros_asegurado: 0,
    documentos_completos: true,
    tuvo_parte_policial: true,
    tuvo_testigo: false,
    fault_responsable: true,
    estado: "Reserva",
    ciudad_evento: "Quito",
    sucursal: "Quito",
    proveedor_en_lista_restrictiva: false,
    proveedor_tipo: "Taller",
    descripcion: "Colision lateral en interseccion.",
  });
  const [result, setResult] = useSc<any>(null);
  const [loading, setLoading] = useSc(false);
  const [err, setErr] = useSc<string | null>(null);
  // Archivos opcionales
  const [presetSel, setPresetSel] = useSc<string | null>(null);
  // Cargar caso existente
  const [cargarId, setCargarId] = useSc("");
  const [cargandoExist, setCargandoExist] = useSc(false);
  const [casoBaseId, setCasoBaseId] = useSc<string | null>(null);
  const [casoBaseScore, setCasoBaseScore] = useSc<{score: number, nivel: string, reglas: number, senales: number} | null>(null);
  const [factura, setFactura] = useSc<File | null>(null);
  const [fotoDano, setFotoDano] = useSc<File | null>(null);
  const [partePolicial, setPartePolicial] = useSc<File | null>(null);
  const [denuncia, setDenuncia] = useSc<File | null>(null);

  function patch(k: string, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
    setPresetSel(null); // edicion manual desmarca preset
  }

  function hayArchivos() {
    return !!(factura || fotoDano || partePolicial || denuncia);
  }

  async function evaluar() {
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      // Si hay archivos, usamos evaluar-completo (multipart). Sino, evaluar (json).
      if (hayArchivos()) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
        if (factura) fd.append("factura", factura);
        if (fotoDano) fd.append("foto_dano", fotoDano);
        if (partePolicial) fd.append("parte_policial_file", partePolicial);
        if (denuncia) fd.append("denuncia_file", denuncia);
        const r = await fetch(`${API}/evaluar-completo`, { method: "POST", body: fd });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setResult(await r.json());
      } else {
        const r = await fetch(`${API}/evaluar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setResult(await r.json());
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function limpiarArchivos() {
    setFactura(null); setFotoDano(null); setPartePolicial(null); setDenuncia(null);
  }

  // Carga un caso existente del dataset y prepobla el formulario para reevaluarlo
  async function cargarCasoExistente() {
    if (!cargarId.trim()) return;
    setCargandoExist(true);
    try {
      const r = await fetch(`${API}/casos/${encodeURIComponent(cargarId.trim())}`);
      if (!r.ok) throw new Error(`No encontré ${cargarId.trim()} (HTTP ${r.status})`);
      const d = await r.json();
      const s = d.siniestro || {};
      // Mapeamos los campos del caso al schema del form
      setForm({
        cobertura: s.cobertura || "Choque",
        monto_reclamado_usd: s.monto_reclamado_usd || 0,
        monto_pagado_usd: s.monto_pagado_usd || 0,
        suma_asegurada_usd: 15000, // no viene en /casos, usamos default
        dias_desde_inicio_poliza: s.dias_desde_inicio_poliza ?? 60,
        dias_desde_fin_poliza: s.dias_desde_fin_poliza ?? 305,
        dias_entre_ocurrencia_reporte: s.dias_entre_ocurrencia_reporte ?? 1,
        historial_siniestros_asegurado: s.historial_siniestros_asegurado ?? 0,
        documentos_completos: s.documentos_completos !== false,
        tuvo_parte_policial: s.tuvo_parte_policial !== false,
        tuvo_testigo: !!s.tuvo_testigo,
        fault_responsable: (s.fault_responsable === "Asegurado" || s.fault_responsable === true),
        estado: s.estado || "Reserva",
        ciudad_evento: s.ciudad_evento || "Quito",
        sucursal: s.sucursal || "Quito",
        proveedor_en_lista_restrictiva: !!(d.proveedor?.lista_restrictiva),
        proveedor_tipo: d.proveedor?.tipo || "Taller",
        descripcion: d.descripcion || "Caso existente recargado para reevaluación.",
      });
      setCasoBaseId(cargarId.trim());
      setCasoBaseScore({
        score: d.score ?? 0,
        nivel: d.nivel || "?",
        reglas: (d.reglas_criticas || []).length,
        senales: (d.senales_activadas || []).length,
      });
      setPresetSel(null);
      setResult(null);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setCargandoExist(false);
    }
  }

  // Presets rapidos para que el jurado pruebe escenarios
  const PRESETS: Record<string, any> = {
    "Caso normal (verde)": {
      cobertura: "Choque", monto_reclamado_usd: 3000, dias_desde_inicio_poliza: 180,
      dias_desde_fin_poliza: 180, dias_entre_ocurrencia_reporte: 1,
      historial_siniestros_asegurado: 0, documentos_completos: true,
      tuvo_parte_policial: true, proveedor_en_lista_restrictiva: false,
    },
    "Borde de vigencia (PDF p13)": {
      cobertura: "Choque", monto_reclamado_usd: 8500, dias_desde_inicio_poliza: 1,
      dias_desde_fin_poliza: 364, dias_entre_ocurrencia_reporte: 0,
      historial_siniestros_asegurado: 1, documentos_completos: true,
    },
    "Robo con denuncia tardía": {
      cobertura: "Robo", monto_reclamado_usd: 12000, suma_asegurada_usd: 12500,
      dias_desde_inicio_poliza: 30, dias_entre_ocurrencia_reporte: 5,
      historial_siniestros_asegurado: 0, estado: "Pago Total",
      monto_pagado_usd: 11875,
    },
    "Asegurado recurrente + proveedor en lista": {
      cobertura: "RC", monto_reclamado_usd: 4500,
      historial_siniestros_asegurado: 4, dias_entre_ocurrencia_reporte: 8,
      documentos_completos: false, proveedor_en_lista_restrictiva: true,
    },
  };

  // Detectamos si fue evaluacion combinada (con docs) o solo tabular
  const esCombinado = !!result?.evaluacion_tabular;
  const evalTab = esCombinado ? result.evaluacion_tabular : result;
  const score = esCombinado ? (result?.score_combinado ?? 0) : (result?.score ?? 0);
  const nivel = esCombinado ? (result?.nivel_combinado || "—") : (result?.nivel || "—");
  const nivelTone = nivel === "ROJO" ? "var(--guayaba-red)"
                  : nivel === "AMARILLO" ? "var(--andes-orange)"
                  : nivel === "VERDE" ? "var(--paramo-green)" : "var(--ink-mute)";
  const docs = result?.analisis_documentos || [];

  return (
    <div style={{ height: "100%", overflow: "auto", background: "var(--marfil)" }}>
      <div style={{
        padding: "20px 32px 18px", borderBottom: "1px solid var(--line)",
        background: "linear-gradient(180deg, rgba(232,122,79,0.08), transparent)",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <Condor size={32} mood="think" tone="orange" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, letterSpacing: ".18em", color: "var(--andes-orange)", fontWeight: 700, textTransform: "uppercase" }}>
            Prueba de fuego · evaluar siniestro en vivo
          </div>
          <h2 style={{ fontSize: 22, marginTop: 2 }}>Cargá un caso hipotético y pedile al cóndor</h2>
          <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>
            POST /evaluar · responde con score 0-100, nivel, reglas activadas y señales en menos de 1s
          </div>
        </div>
      </div>

      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, alignItems: "flex-start" }}>
        {/* Formulario */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* === SECCIÓN: Presets como cards visuales === */}
          <div className="card" style={{ padding: 16 }}>
            <SectionHeader icon="⚡" title="Escenarios rápidos" hint={
              casoBaseId ? `caso base cargado: ${casoBaseId} — podés modificar y reevaluar` :
              presetSel ? `seleccionado: ${presetSel}` :
              "elegí un preset o cargá un caso existente"
            } />

            {/* Cargar caso existente del dataset */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8,
              marginTop: 10, marginBottom: 10,
              padding: 10, background: casoBaseId ? "rgba(44,95,141,0.08)" : "var(--marfil-paper)",
              borderRadius: 8, borderLeft: `3px solid ${casoBaseId ? "var(--mountain-blue)" : "var(--line-strong)"}`,
              alignItems: "center",
            }}>
              <input
                placeholder="🔁 Cargar caso existente (ej. SIN-100029) para reevaluar"
                value={cargarId}
                onChange={e => setCargarId(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") cargarCasoExistente(); }}
                style={{
                  padding: "6px 10px", fontSize: 12, border: "1px solid var(--line-strong)",
                  borderRadius: 6, background: "white", boxSizing: "border-box", width: "100%",
                }}
              />
              <button
                className="chip outline"
                onClick={cargarCasoExistente}
                disabled={cargandoExist || !cargarId.trim()}
                style={{ fontSize: 11, cursor: cargandoExist ? "wait" : "pointer", whiteSpace: "nowrap" }}>
                {cargandoExist ? "cargando…" : "cargar →"}
              </button>
              {casoBaseId && (
                <button
                  className="chip outline"
                  onClick={() => { setCasoBaseId(null); setCargarId(""); setCasoBaseScore(null); }}
                  style={{ fontSize: 10, cursor: "pointer", color: "var(--guayaba-red)" }}>
                  ✕ limpiar
                </button>
              )}
            </div>

            {/* Aviso importante cuando hay caso base — explica por qué el score puede diferir */}
            {casoBaseId && casoBaseScore && (
              <div style={{
                padding: "12px 14px", marginBottom: 12,
                background: "rgba(212,165,116,0.10)", borderRadius: 8,
                borderLeft: "3px solid var(--andes-orange)",
                fontSize: 11.5, color: "var(--ink-soft)", lineHeight: 1.55,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--andes-orange)", marginBottom: 4 }}>
                  ⚠ Score original del caso: <span style={{ fontFamily: "var(--mono)" }}>{casoBaseScore.score}/100</span> · {casoBaseScore.nivel} · {casoBaseScore.reglas} regla(s) · {casoBaseScore.senales} señal(es)
                </div>
                <div>
                  La reevaluación puede dar un score <strong>menor</strong> que el original
                  ({casoBaseScore.score}) porque el formulario no incluye el contexto de los <strong>documentos</strong>
                  del expediente. Reglas como <span className="mono">RF-02</span> (factura adulterada) o señales como
                  <span className="mono"> S11</span> (documentos inconsistentes) solo se disparan si hay documentos cargados.
                  Para una reevaluación 100% comparable, subí los documentos del expediente en la sección 5.
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 10 }}>
              {Object.entries(PRESETS).map(([nombre, vals], i) => {
                const tone = i === 0 ? "var(--paramo-green)" : i === 1 ? "var(--andes-orange)" : i === 2 ? "var(--guayaba-red)" : "var(--mountain-blue)";
                const ico = ["✓", "⚠", "🚨", "🔴"][i] || "⚡";
                const sel = presetSel === nombre;
                return (
                  <button
                    key={nombre}
                    onClick={() => {
                      setForm((f: any) => ({ ...f, ...vals }));
                      setPresetSel(nombre);
                    }}
                    style={{
                      position: "relative",
                      padding: "12px 8px", borderRadius: 8, cursor: "pointer",
                      background: sel ? `linear-gradient(180deg, ${tone}25, ${tone}10)` : "white",
                      border: sel ? `2px solid ${tone}` : `1.5px solid ${tone}30`,
                      borderTop: sel ? `4px solid ${tone}` : `3px solid ${tone}`,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                      transition: "all 0.15s ease", textAlign: "center",
                      transform: sel ? "translateY(-2px)" : "none",
                      boxShadow: sel ? `0 6px 16px ${tone}35` : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (sel) return;
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px ${tone}25`;
                    }}
                    onMouseLeave={(e) => {
                      if (sel) return;
                      (e.currentTarget as HTMLElement).style.transform = "none";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    {/* badge ✓ cuando esta seleccionado */}
                    {sel && (
                      <span style={{
                        position: "absolute", top: -8, right: -8,
                        width: 20, height: 20, borderRadius: "50%",
                        background: tone, color: "white",
                        display: "grid", placeItems: "center",
                        fontSize: 12, fontWeight: 700,
                        boxShadow: `0 2px 8px ${tone}80`,
                        border: "2px solid white",
                      }}>✓</span>
                    )}
                    <span style={{ fontSize: 20, color: tone }}>{ico}</span>
                    <span style={{
                      fontSize: 10.5, fontWeight: sel ? 700 : 600,
                      color: sel ? tone : "var(--condor-wing)",
                      lineHeight: 1.2,
                    }}>{nombre}</span>
                  </button>
                );
              })}
            </div>
          </div>


          {/* === SECCIÓN 1: Cobertura y montos === */}
          <div className="card" style={{ padding: 16 }}>
            <SectionHeader icon="💰" title="1. Cobertura y montos" hint="qué se reclama y por cuánto" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 12, marginTop: 10 }}>
              <FormField label="Cobertura">
                <select value={form.cobertura} onChange={e => patch("cobertura", e.target.value)} style={fieldStyle}>
                  {["Choque","Robo","RC","DM total","DM parcial","Incendio"].map(c => <option key={c}>{c}</option>)}
                </select>
              </FormField>
              <FormField label="Estado del trámite">
                <select value={form.estado} onChange={e => patch("estado", e.target.value)} style={fieldStyle}>
                  {["Reserva","Pago Total","Pago Parcial","Anticipo","Negativa","Cierre Sin Consecuencia","Liquidado"].map(c => <option key={c}>{c}</option>)}
                </select>
              </FormField>
              <FormField label="Sucursal">
                <input value={form.sucursal} onChange={e => { patch("sucursal", e.target.value); patch("ciudad_evento", e.target.value); }} style={fieldStyle}/>
              </FormField>
              <FormField label="Monto reclamado (USD)">
                <input type="number" value={form.monto_reclamado_usd} onChange={e => patch("monto_reclamado_usd", +e.target.value)} style={fieldStyle}/>
              </FormField>
              <FormField label="Monto pagado (USD)">
                <input type="number" value={form.monto_pagado_usd} onChange={e => patch("monto_pagado_usd", +e.target.value)} style={fieldStyle}/>
              </FormField>
              <FormField label="Suma asegurada (USD)" hint="reclamo >95% dispara señal 14">
                <input type="number" value={form.suma_asegurada_usd} onChange={e => patch("suma_asegurada_usd", +e.target.value)} style={fieldStyle}/>
              </FormField>
            </div>
          </div>

          {/* === SECCIÓN 2: Cronología === */}
          <div className="card" style={{ padding: 16 }}>
            <SectionHeader icon="📅" title="2. Cronología del siniestro" hint="cuándo pasó vs cuándo se reportó vs vigencia de la póliza" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 12, marginTop: 10 }}>
              <FormField label="Días desde inicio póliza" hint="≤2d → RF-05 ROJO">
                <input type="number" value={form.dias_desde_inicio_poliza} onChange={e => patch("dias_desde_inicio_poliza", +e.target.value)} style={fieldStyle}/>
              </FormField>
              <FormField label="Días hasta fin póliza" hint="≤10d → señal S1">
                <input type="number" value={form.dias_desde_fin_poliza} onChange={e => patch("dias_desde_fin_poliza", +e.target.value)} style={fieldStyle}/>
              </FormField>
              <FormField label="Días evento → reporte" hint="Robo >4d → RF-06">
                <input type="number" value={form.dias_entre_ocurrencia_reporte} onChange={e => patch("dias_entre_ocurrencia_reporte", +e.target.value)} style={fieldStyle}/>
              </FormField>
            </div>
          </div>

          {/* === SECCIÓN 3: Asegurado y proveedor === */}
          <div className="card" style={{ padding: 16 }}>
            <SectionHeader icon="👤" title="3. Asegurado y proveedor" hint="perfil del cliente y del taller / clínica" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12, marginTop: 10 }}>
              <FormField label="Siniestros previos del asegurado" hint="≥3 en 18m → señal S3">
                <input type="number" value={form.historial_siniestros_asegurado} onChange={e => patch("historial_siniestros_asegurado", +e.target.value)} style={fieldStyle}/>
              </FormField>
              <FormField label="Tipo de beneficiario">
                <select value={form.proveedor_tipo} onChange={e => patch("proveedor_tipo", e.target.value)} style={fieldStyle}>
                  {["Taller","Clinica","Perito","Otro"].map(c => <option key={c}>{c}</option>)}
                </select>
              </FormField>
              <FormField label="Proveedor en lista restrictiva" hint="dispara RF-03 ROJO">
                <select value={form.proveedor_en_lista_restrictiva ? "1" : "0"} onChange={e => patch("proveedor_en_lista_restrictiva", e.target.value === "1")} style={fieldStyle}>
                  <option value="0">No</option><option value="1">Sí (dispara RF-03)</option>
                </select>
              </FormField>
              <FormField label="Documentos completos">
                <select value={form.documentos_completos ? "1" : "0"} onChange={e => patch("documentos_completos", e.target.value === "1")} style={fieldStyle}>
                  <option value="1">Sí</option><option value="0">No (señal S8)</option>
                </select>
              </FormField>
              <FormField label="Tuvo parte policial">
                <select value={form.tuvo_parte_policial ? "1" : "0"} onChange={e => patch("tuvo_parte_policial", e.target.value === "1")} style={fieldStyle}>
                  <option value="1">Sí</option><option value="0">No</option>
                </select>
              </FormField>
              <FormField label="Tuvo testigo">
                <select value={form.tuvo_testigo ? "1" : "0"} onChange={e => patch("tuvo_testigo", e.target.value === "1")} style={fieldStyle}>
                  <option value="1">Sí</option><option value="0">No</option>
                </select>
              </FormField>
            </div>
          </div>

          {/* === SECCIÓN 4: Narrativa === */}
          <div className="card" style={{ padding: 16 }}>
            <SectionHeader icon="✍️" title="4. Narrativa del asegurado" hint="el relato del siniestro — clave para análisis NLP y visión" />
            <textarea
              value={form.descripcion}
              onChange={e => patch("descripcion", e.target.value)}
              rows={3}
              placeholder="Ej: Colisión lateral en intersección de la Av. Amazonas con la 6 de Diciembre, otro vehículo invadió mi carril sin señalizar..."
              style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit", marginTop: 10, padding: 12, fontSize: 12.5, lineHeight: 1.5 }}
            />
          </div>

          {/* === SECCIÓN 5: Documentos opcionales con drop zones === */}
          <div className="card" style={{
            padding: 16,
            background: hayArchivos() ? "linear-gradient(180deg, rgba(232,122,79,0.05), white)" : "white",
            borderTop: `3px solid ${hayArchivos() ? "var(--andes-orange)" : "var(--line-strong)"}`,
            transition: "background 0.3s ease",
          }}>
            <SectionHeader
              icon="📎"
              title="5. Documentos (opcional)"
              hint="Azure Document Intelligence + GPT-4o Vision · combinan con los datos en un solo veredicto"
            />
            {hayArchivos() && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -28, marginBottom: 8 }}>
                <button className="chip outline" style={{ fontSize: 10, cursor: "pointer", background: "white" }} onClick={limpiarArchivos}>
                  ✕ quitar todos
                </button>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <DropZone label="Factura del taller" icon="🧾" accept=".pdf,.jpg,.png"
                        file={factura} onChange={setFactura}
                        engine="Azure DI · prebuilt-invoice" />
              <DropZone label="Foto del daño" icon="📷" accept=".jpg,.jpeg,.png"
                        file={fotoDano} onChange={setFotoDano}
                        engine="GPT-4o Vision" />
              <DropZone label="Parte policial" icon="🚓" accept=".pdf,.jpg,.png"
                        file={partePolicial} onChange={setPartePolicial}
                        engine="OCR + LLM" />
              <DropZone label="Denuncia" icon="📄" accept=".pdf,.jpg,.png"
                        file={denuncia} onChange={setDenuncia}
                        engine="OCR + LLM" />
            </div>
          </div>

          {/* === BOTÓN GIGANTE === */}
          <button
            onClick={evaluar}
            disabled={loading}
            className="btn warm"
            style={{
              padding: "14px 18px", fontSize: 14, fontWeight: 600,
              background: loading ? "var(--ink-mute)" : "linear-gradient(135deg, var(--andes-orange), var(--guayaba-red))",
              border: 0, color: "white", borderRadius: 12,
              boxShadow: loading ? "none" : "0 6px 20px rgba(232,122,79,0.35)",
              cursor: loading ? "wait" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "none"; }}
          >
            <span style={{ fontSize: 18 }}>🦅</span>
            {loading
              ? hayArchivos() ? "Procesando datos + documentos…" : "Cóndor evaluando…"
              : hayArchivos() ? `Evaluar caso + ${[factura,fotoDano,partePolicial,denuncia].filter(Boolean).length} documento(s)`
                              : "Evaluar con AchachAI"}
            {!loading && <span style={{ fontSize: 16 }}>→</span>}
          </button>
        </div>

        {/* Resultado */}
        <div style={{ position: "sticky", top: 20 }}>
          {!result && !loading && !err && (
            <EmptyStateEvaluar form={form} hayArchivos={hayArchivos()} />
          )}

          {loading && (
            <LoadingStateEvaluar hayArchivos={hayArchivos()} />
          )}

          {err && (
            <div className="card" style={{ padding: 22, borderLeft: "3px solid var(--guayaba-red)" }}>
              <div style={{ fontSize: 13, color: "var(--guayaba-red)", fontWeight: 600 }}>Error: {err}</div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>
                Verificá que el backend esté en {API}.
              </div>
            </div>
          )}

          {result && (
            <div className="card fade-up" style={{ padding: 22, borderTop: `3px solid ${nivelTone}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 18, alignItems: "center" }}>
                <VueloDelCondor score={score} variant="lg" />
                <div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", letterSpacing: ".1em", textTransform: "uppercase" }}>
                    {esCombinado ? "Veredicto combinado (datos + documentos)"
                     : casoBaseId ? `Reevaluación de ${casoBaseId}`
                     : "Resultado"}
                  </div>
                  <h3 style={{ fontSize: 28, margin: 0, color: nivelTone }}>{nivel}</h3>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.5 }}>
                    {result.explicacion}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 8 }}>
                    Señales: {evalTab?.puntos_totales_senales ?? 0} pts · {evalTab?.senales_activadas?.length || 0} activas · {evalTab?.reglas_criticas?.length || 0} regla(s) crítica(s)
                    {esCombinado && docs.length > 0 && (
                      <> · {docs.length} doc(s) analizado(s) · {result.n_inconsistencias_total || 0} inconsistencia(s) doc (+{result.boost_por_inconsistencias || 0} pts)</>
                    )}
                  </div>
                </div>
              </div>

              {/* Comparativa con score original cuando reevaluamos caso existente */}
              {casoBaseId && casoBaseScore && (
                <div style={{
                  marginTop: 14, padding: 12,
                  background: "rgba(44,95,141,0.06)",
                  borderLeft: "3px solid var(--mountain-blue)", borderRadius: 8,
                  fontSize: 12, lineHeight: 1.5,
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "center" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 9.5, color: "var(--ink-mute)", letterSpacing: ".06em", textTransform: "uppercase" }}>
                        Score original ({casoBaseId})
                      </div>
                      <div className="serif tabular" style={{ fontSize: 24, fontWeight: 600, color: casoBaseScore.nivel === "ROJO" ? "var(--guayaba-red)" : casoBaseScore.nivel === "AMARILLO" ? "var(--andes-orange)" : "var(--paramo-green)" }}>
                        {casoBaseScore.score}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>{casoBaseScore.nivel}</div>
                    </div>
                    <div style={{ fontSize: 18, color: "var(--ink-mute)" }}>
                      {score > casoBaseScore.score ? "↗" : score < casoBaseScore.score ? "↘" : "="}
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 9.5, color: "var(--ink-mute)", letterSpacing: ".06em", textTransform: "uppercase" }}>
                        Score reevaluado (con tus cambios)
                      </div>
                      <div className="serif tabular" style={{ fontSize: 24, fontWeight: 600, color: nivelTone }}>
                        {score}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>{nivel}</div>
                    </div>
                  </div>
                  {score < casoBaseScore.score && !esCombinado && (
                    <div style={{ marginTop: 8, fontSize: 10.5, color: "var(--ink-mute)", fontStyle: "italic", textAlign: "center" }}>
                      ↘ Score bajó porque el formulario no llevó el contexto de los documentos del expediente.
                      Subí factura/foto en la sección 5 para reevaluación completa.
                    </div>
                  )}
                </div>
              )}

              {/* Override por severidad — banner llamativo cuando aplica */}
              {esCombinado && result.override_severidad && (
                <div style={{
                  marginTop: 14, padding: 12,
                  background: "linear-gradient(180deg, rgba(197,51,58,0.10), rgba(232,122,79,0.05))",
                  borderLeft: "4px solid var(--guayaba-red)", borderRadius: 8,
                  fontSize: 12.5, lineHeight: 1.55,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <strong style={{ color: "var(--guayaba-red)" }}>Override por severidad ALTA aplicado</strong>
                  </div>
                  <div style={{ color: "var(--ink-soft)" }}>{result.override_severidad}</div>
                </div>
              )}

              {/* Si fue combinado: mostrar mini-breakdown del score */}
              {esCombinado && (
                <div style={{
                  marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
                }}>
                  <div style={{ padding: 10, background: "var(--marfil-paper)", borderRadius: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 9.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: ".05em" }}>tabular (reglas)</div>
                    <div className="serif tabular" style={{ fontSize: 22, fontWeight: 600, color: "var(--condor-wing)" }}>
                      {evalTab?.score || 0}
                    </div>
                    <div style={{ fontSize: 9.5, color: "var(--ink-mute)" }}>{evalTab?.nivel}</div>
                  </div>
                  <div style={{ padding: 10, background: "var(--marfil-paper)", borderRadius: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 9.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: ".05em" }}>docs (max)</div>
                    <div className="serif tabular" style={{ fontSize: 22, fontWeight: 600, color: "var(--mountain-blue)" }}>
                      {Math.max(0, ...docs.map((d: any) => d.score_doc || 0))}
                    </div>
                    <div style={{ fontSize: 9.5, color: "var(--ink-mute)" }}>{docs.length} archivo(s)</div>
                  </div>
                  <div style={{ padding: 10, background: nivelTone === "var(--ink-mute)" ? "var(--marfil-paper)" : `${nivelTone}15`, borderRadius: 8, textAlign: "center", border: `1px solid ${nivelTone}40` }}>
                    <div style={{ fontSize: 9.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: ".05em" }}>combinado</div>
                    <div className="serif tabular" style={{ fontSize: 22, fontWeight: 700, color: nivelTone }}>
                      {score}
                    </div>
                    <div style={{ fontSize: 9.5, color: nivelTone, fontWeight: 600 }}>{nivel}</div>
                  </div>
                </div>
              )}

              {evalTab?.reglas_criticas?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 10.5, color: "var(--ink-mute)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>
                    Reglas críticas disparadas (datos)
                  </div>
                  {evalTab.reglas_criticas.map((r: any) => (
                    <div key={r.codigo} style={{
                      display: "flex", gap: 10, padding: "8px 10px", marginBottom: 4,
                      background: "rgba(197,51,58,0.06)", borderRadius: 8,
                      border: "1px solid rgba(197,51,58,0.18)",
                    }}>
                      <span className="mono chip red" style={{ fontSize: 9.5 }}>{r.codigo}</span>
                      <div style={{ flex: 1, fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{r.nombre}</div>
                        <div style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>{r.evidencia}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {evalTab?.senales_activadas?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10.5, color: "var(--ink-mute)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>
                    Señales activadas (1..14)
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    {evalTab.senales_activadas.map((s: any) => (
                      <div key={s.id} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 10px", background: "var(--marfil-paper)", borderRadius: 6,
                        border: "1px solid var(--line)",
                      }}>
                        <span className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>S{s.id}</span>
                        <div style={{ flex: 1, fontSize: 11.5 }}>
                          {s.nombre}
                          {s.evidencia && <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>{s.evidencia}</div>}
                        </div>
                        <span className="chip amber mono" style={{ fontSize: 9.5 }}>+{s.puntos}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documentos analizados (solo si combinado) */}
              {esCombinado && docs.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 10.5, color: "var(--ink-mute)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>
                    Análisis de documentos (Azure DI + GPT-4o)
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {docs.map((d: any, i: number) => {
                      const docNivel = d.nivel_riesgo_doc || "VERDE";
                      const docColor = docNivel === "ROJO" ? "var(--guayaba-red)"
                                     : docNivel === "AMARILLO" ? "var(--andes-orange)"
                                     : "var(--paramo-green)";
                      return (
                        <div key={i} style={{
                          padding: "10px 12px", borderRadius: 8,
                          background: "white", border: `1px solid ${docColor}40`,
                          borderLeft: `3px solid ${docColor}`,
                        }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{d._etiqueta}</span>
                            <span className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>{d._nombre_archivo}</span>
                            <span className={`chip mono ${docNivel === "ROJO" ? "red" : docNivel === "AMARILLO" ? "amber" : "green"}`} style={{ fontSize: 9 }}>
                              {docNivel} · {d.score_doc}
                            </span>
                          </div>
                          {d.explicacion && (
                            <div style={{ fontSize: 11.5, color: "var(--ink-soft)", lineHeight: 1.5, marginBottom: 4 }}>
                              {d.explicacion}
                            </div>
                          )}
                          {d.inconsistencias && d.inconsistencias.length > 0 && (
                            <ul style={{ margin: "4px 0 0 18px", padding: 0, fontSize: 11, color: "var(--guayaba-red)" }}>
                              {d.inconsistencias.slice(0, 4).map((inc: any, j: number) => (
                                <li key={j}>
                                  <strong>[{inc.severidad}]</strong> {inc.evidencia}
                                </li>
                              ))}
                            </ul>
                          )}
                          {d.error && <div style={{ fontSize: 10.5, color: "var(--guayaba-red)" }}>⚠ {d.error}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Accion sugerida (solo combinado) */}
              {esCombinado && result.accion_sugerida && (
                <div style={{
                  marginTop: 14, padding: 12, background: `${nivelTone}10`,
                  borderRadius: 8, borderLeft: `3px solid ${nivelTone}`, fontSize: 12.5, lineHeight: 1.55,
                }}>
                  <strong style={{ color: nivelTone }}>🦅 Acción sugerida:</strong> {result.accion_sugerida}
                </div>
              )}

              <div style={{
                marginTop: 14, padding: 10, background: "rgba(74,124,89,0.08)",
                borderRadius: 8, borderLeft: "3px solid var(--paramo-green)", fontSize: 11.5,
              }}>
                ⚖️ Este resultado es una <strong>alerta sugerida</strong>, no una acusación. La decisión final es del analista.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* === Header con icono para secciones del form de Evaluar === */
function SectionHeader({ icon, title, hint }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: "1px solid var(--line)" }}>
      <span style={{
        width: 30, height: 30, borderRadius: 8,
        background: "linear-gradient(135deg, rgba(232,122,79,0.15), rgba(197,51,58,0.08))",
        display: "grid", placeItems: "center", fontSize: 16,
      }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--condor-wing)" }}>{title}</div>
        {hint && <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 1 }}>{hint}</div>}
      </div>
    </div>
  );
}

/* === Drop zone visual para documentos === */
function DropZone({ label, icon, accept, file, onChange, engine }: any) {
  const id = `dz-${label.replace(/\s/g, "")}`;
  const isImg = file && /\.(jpe?g|png|gif)$/i.test(file.name);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (file && isImg) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
  }, [file, isImg]);

  return (
    <label htmlFor={id} style={{
      position: "relative", overflow: "hidden",
      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
      background: file ? "white" : "var(--marfil-paper)",
      border: `1.5px ${file ? "solid var(--paramo-green)" : "dashed var(--line-strong)"}`,
      borderRadius: 10, cursor: "pointer",
      minHeight: 56, transition: "all 0.18s ease",
    }}
      onMouseEnter={(e) => { if (!file) (e.currentTarget as HTMLElement).style.borderColor = "var(--andes-orange)"; }}
      onMouseLeave={(e) => { if (!file) (e.currentTarget as HTMLElement).style.borderColor = "var(--line-strong)"; }}
    >
      <input id={id} type="file" accept={accept} style={{ display: "none" }}
             onChange={e => onChange(e.target.files?.[0] || null)} />

      {/* Icono / preview */}
      <div style={{
        width: 38, height: 38, borderRadius: 8, flexShrink: 0,
        background: file ? "rgba(74,124,89,0.10)" : "rgba(26,58,82,0.06)",
        display: "grid", placeItems: "center",
        overflow: "hidden", border: "1px solid var(--line)",
      }}>
        {preview ? (
          <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 20 }}>{icon}</span>
        )}
      </div>

      {/* Texto */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--condor-wing)" }}>{label}</div>
        {file ? (
          <div className="mono" style={{ fontSize: 10, color: "var(--paramo-green)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            ✓ {file.name} · {(file.size / 1024).toFixed(0)} KB
          </div>
        ) : (
          <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>
            {engine ? `${engine} · ` : ""}click para subir {accept.replace(/\./g, "").toUpperCase()}
          </div>
        )}
      </div>

      {file && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); onChange(null); }}
          style={{ background: "transparent", border: 0, color: "var(--guayaba-red)", cursor: "pointer", fontSize: 18, padding: 0, width: 24, height: 24 }}
          aria-label="Quitar archivo"
        >×</button>
      )}
    </label>
  );
}

/* === Empty state animado con tips en vivo === */
function EmptyStateEvaluar({ form, hayArchivos }: any) {
  // Tips dinámicos basados en lo que ya escribió el usuario
  const tips: string[] = [];
  if (form.dias_desde_inicio_poliza <= 10) tips.push("Tu póliza inicia hace muy poco — eso disparará la señal S1 (borde de vigencia)");
  if (form.cobertura === "Robo" && form.dias_entre_ocurrencia_reporte > 4) tips.push("Robo con denuncia >4d → RF-06 AMARILLO");
  if (form.proveedor_en_lista_restrictiva) tips.push("Proveedor en lista restrictiva → RF-03 ROJO automático");
  if (!form.documentos_completos) tips.push("Documentos incompletos → señal S8 (+4 pts)");
  if (form.historial_siniestros_asegurado >= 3) tips.push("Historial alto del asegurado → señal S3 (+8 pts)");
  if (form.cobertura === "Robo" && form.monto_pagado_usd >= form.suma_asegurada_usd * 0.95) tips.push("PTxRB activo → RF-01 ROJO");
  if (hayArchivos) tips.push("Tenés documentos adjuntos — el cóndor los analizará con Azure DI + GPT-4o Vision");

  return (
    <div className="card" style={{
      padding: 28,
      background: "linear-gradient(180deg, white, var(--marfil-paper))",
      textAlign: "center", overflow: "hidden", position: "relative",
      minHeight: 360,
    }}>
      {/* halo radar de fondo */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(circle at center, rgba(232,122,79,0.06), transparent 70%)",
      }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Cóndor animado */}
        <div style={{ position: "relative", width: 100, height: 100, margin: "0 auto" }}>
          {/* círculos pulsantes */}
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: "2px solid rgba(232,122,79,0.35)",
              animation: `sonar-out 2.4s ease-out infinite ${i * 0.8}s`,
            }} />
          ))}
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <Condor size={64} mood="think" tone="orange" />
          </div>
        </div>

        <div style={{ marginTop: 16, fontFamily: "var(--serif)", fontSize: 18, color: "var(--condor-wing)", fontWeight: 600 }}>
          El cóndor está listo
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4, maxWidth: 320, marginInline: "auto" }}>
          Llená el formulario o usá un preset. Cuando presiones <strong style={{ color: "var(--andes-orange)" }}>Evaluar</strong>, en menos de 1 segundo (o 5s con documentos) tendrás el veredicto completo.
        </div>

        {tips.length > 0 && (
          <div style={{
            marginTop: 22, padding: 14, background: "rgba(232,122,79,0.08)",
            borderRadius: 10, borderLeft: "3px solid var(--andes-orange)",
            textAlign: "left",
          }}>
            <div style={{ fontSize: 10.5, color: "var(--andes-orange)", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>
              🦅 Lo que ya predigo con tus valores actuales:
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: "var(--ink-soft)", lineHeight: 1.55 }}>
              {tips.slice(0, 4).map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* === Loader con fases mientras procesa === */
function LoadingStateEvaluar({ hayArchivos }: any) {
  const baseFases = [
    { ic: "📊", txt: "Aplicando 7 reglas críticas + 14 señales", delay: 0 },
    { ic: "🧮", txt: "Calculando score tabular con XGBoost", delay: 800 },
  ];
  const fasesDocs = hayArchivos ? [
    { ic: "📄", txt: "Azure Document Intelligence procesando documentos", delay: 1400 },
    { ic: "📷", txt: "GPT-4o Vision analizando imágenes", delay: 2400 },
    { ic: "🧠", txt: "Combinando datos + documentos en veredicto único", delay: 3400 },
  ] : [];
  const fases = [...baseFases, ...fasesDocs, { ic: "✨", txt: "Generando explicación en lenguaje natural", delay: hayArchivos ? 4200 : 1600 }];

  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
    const timers: any[] = [];
    fases.forEach((f, i) => {
      timers.push(setTimeout(() => setStep(i + 1), f.delay + 300));
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayArchivos]);

  return (
    <div className="card" style={{ padding: 28, minHeight: 360 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ position: "relative", width: 56, height: 56 }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: "3px solid var(--line)", borderTopColor: "var(--andes-orange)",
            animation: "spin-slow 1.2s linear infinite",
          }} />
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <Condor size={32} mood="think" tone="orange" />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--condor-wing)" }}>El cóndor está procesando…</div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
            {hayArchivos ? "Pipeline integral: datos + documentos + síntesis" : "Pipeline rápido: reglas + modelo + explicación"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {fases.map((f, i) => {
          const done = step > i;
          const active = step === i;
          const pending = step < i;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px", borderRadius: 8,
              background: active ? "rgba(232,122,79,0.10)" : done ? "rgba(74,124,89,0.06)" : "var(--marfil-paper)",
              border: `1px solid ${active ? "var(--andes-orange)" : done ? "var(--paramo-green)" : "var(--line)"}`,
              transition: "all 0.3s ease",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: done ? "var(--paramo-green)" : active ? "var(--andes-orange)" : "white",
                color: done || active ? "white" : "var(--ink-mute)",
                display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700,
                border: pending ? "1px solid var(--line)" : "none",
              }}>
                {done ? "✓" : active ? <span style={{ animation: "pulse-red 1s infinite" }}>{f.ic}</span> : i + 1}
              </div>
              <div style={{
                flex: 1, fontSize: 12.5,
                color: pending ? "var(--ink-mute)" : "var(--condor-wing)",
                fontWeight: active ? 600 : 400,
              }}>
                {f.txt}
              </div>
              {active && (
                <div style={{ display: "flex", gap: 3 }}>
                  {[0, 1, 2].map(d => (
                    <span key={d} style={{
                      width: 5, height: 5, borderRadius: "50%", background: "var(--andes-orange)",
                      animation: `pulse-red 1s infinite ${d * 0.2}s`,
                    }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FileSlot({ label, accept, file, onChange }: any) {
  const id = `file-${label.replace(/\s/g, "")}`;
  return (
    <label htmlFor={id} style={{
      display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
      background: file ? "rgba(74,124,89,0.10)" : "white",
      border: `1px solid ${file ? "var(--paramo-green)" : "var(--line-strong)"}`,
      borderRadius: 6, cursor: "pointer", fontSize: 11.5,
    }}>
      <input
        id={id} type="file" accept={accept}
        style={{ display: "none" }}
        onChange={e => onChange(e.target.files?.[0] || null)}
      />
      <span style={{ flex: 1, fontWeight: 500 }}>{label}</span>
      {file ? (
        <>
          <span className="mono" style={{ fontSize: 10, color: "var(--paramo-green)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100, whiteSpace: "nowrap" }}>
            ✓ {file.name}
          </span>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onChange(null); }}
            style={{ background: "transparent", border: 0, color: "var(--guayaba-red)", cursor: "pointer", fontSize: 14, padding: 0 }}
          >×</button>
        </>
      ) : (
        <span style={{ fontSize: 10, color: "var(--ink-mute)" }}>elegir…</span>
      )}
    </label>
  );
}

function FormField({ label, hint, children }: any) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10.5, color: "var(--ink-mute)", fontWeight: 500, letterSpacing: ".04em" }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 9.5, color: "var(--ink-mute)", fontStyle: "italic" }}>{hint}</span>}
    </label>
  );
}

const fieldStyle: any = {
  padding: "6px 10px",
  border: "1px solid var(--line-strong)",
  borderRadius: 6,
  background: "white",
  fontSize: 12,
  width: "100%",
  boxSizing: "border-box",
};

/* ============================================================
   ASEGURADO 360 — vista completa de una persona
   ============================================================ */
export function AseguradoScreen({ aseguradoId, onBack, onInvestigate }: any) {
  const API = (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL) || "http://localhost:8000";
  const [data, setData] = useSc<any>(null);
  const [err, setErr] = useSc<string | null>(null);

  useScE(() => {
    let cancelled = false;
    setData(null); setErr(null);
    fetch(`${API}/asegurados/${encodeURIComponent(aseguradoId)}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setErr(e?.message || String(e)); });
    return () => { cancelled = true; };
  }, [aseguradoId]);

  if (err) {
    return (
      <div style={{ padding: 32 }}>
        <button className="btn ghost" onClick={onBack} style={{ marginBottom: 12 }}>← Volver</button>
        <div className="card" style={{ padding: 22, borderLeft: '3px solid var(--guayaba-red)' }}>
          <div style={{ color: 'var(--guayaba-red)', fontSize: 13 }}>Error cargando {aseguradoId}: {err}</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <Condor size={56} mood="think" tone="orange" />
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-mute)' }}>Recuperando expediente de {aseguradoId}…</div>
      </div>
    );
  }

  const p = data.perfil;
  const t = data.totales;
  const sins = data.siniestros || [];
  const provs = data.proveedores_frecuentes || [];
  const polizas = data.polizas || [];
  const riesgoColor = (p.score_cliente_simulado || 700) >= 700 ? 'var(--paramo-green)'
                    : (p.score_cliente_simulado || 700) >= 500 ? 'var(--andes-orange)'
                    : 'var(--guayaba-red)';

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--marfil)' }}>
      {/* Header */}
      <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--line)',
        background: 'linear-gradient(180deg, rgba(44,95,141,0.08), transparent)',
        display: 'flex', alignItems: 'center', gap: 16 }}>
        <button className="btn ghost" onClick={onBack} style={{ padding: '6px 10px', fontSize: 12 }}>← Volver</button>
        <Condor size={36} mood="speak" tone="wing" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, letterSpacing: '.18em', color: 'var(--mountain-blue)', fontWeight: 700, textTransform: 'uppercase' }}>
            Vista 360 del asegurado
          </div>
          <h2 style={{ fontSize: 24, marginTop: 2 }}>
            {p.id_asegurado} <span style={{ fontSize: 14, color: 'var(--ink-mute)', fontFamily: 'var(--sans)', fontWeight: 400 }}>· {p.segmento || 'sin perfil'} · {p.ciudad || '—'}</span>
          </h2>
          {p._perfil_derivado && (
            <div style={{ fontSize: 10.5, color: 'var(--andes-orange)', marginTop: 4, fontStyle: 'italic' }}>
              ⓘ Perfil derivado de los siniestros (este id no está en la tabla asegurados.parquet)
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="serif tabular" style={{ fontSize: 28, fontWeight: 600, color: riesgoColor }}>{p.score_cliente_simulado || '—'}</div>
          <div style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '.1em', textTransform: 'uppercase' }}>score cliente</div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ padding: '20px 32px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        <MiniKpi label="Siniestros" value={t.n_siniestros} />
        <MiniKpi label="Pólizas" value={t.n_polizas} />
        <MiniKpi label="Antigüedad" value={`${p.antiguedad_anios || 0}a`} />
        <MiniKpi label="Reclamos 12m" value={p.reclamos_ultimos_12_meses} tone={p.reclamos_ultimos_12_meses >= 3 ? 'red' : 'wing'} />
        <MiniKpi label="Monto reclamado" value={`$${Math.round((t.monto_reclamado_total || 0)/1000)}K`} />
        <MiniKpi label="Mora actual" value={p.mora_actual ? 'SÍ' : 'no'} tone={p.mora_actual ? 'red' : 'green'} />
      </div>

      {/* Body */}
      <div style={{ padding: '0 32px 32px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
        {/* Siniestros del asegurado */}
        <div className="card" style={{ padding: 18 }}>
          <div className="diamond-divider" style={{ marginBottom: 12 }}>Historial de siniestros ({sins.length})</div>
          {sins.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Sin siniestros registrados.</div>}
          <div style={{ display: 'grid', gap: 6, maxHeight: 480, overflow: 'auto' }}>
            {sins.map((s: any) => (
              <div key={s.id_siniestro} style={{
                display: 'grid', gridTemplateColumns: '110px 1fr 90px 70px 70px',
                gap: 10, alignItems: 'center', padding: '8px 12px',
                background: 'var(--marfil-paper)', borderRadius: 8, fontSize: 11.5,
                borderLeft: s.etiqueta_fraude_simulada ? '3px solid var(--guayaba-red)' : s.caso_inyectado ? '3px solid var(--andes-orange)' : '3px solid var(--line)',
              }}>
                <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--mountain-blue)' }}>{s.id_siniestro}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12 }}>{s.marca || ''} {s.modelo || ''} {s.anio_vehiculo || ''}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>
                    {String(s.fecha_ocurrencia).slice(0,10)} · {s.cobertura} · {s.sucursal || s.ciudad_evento}
                    {s.lista_restrictiva ? ' · ⚠ prov. lista restrictiva' : ''}
                  </div>
                </div>
                <span className="tabular mono" style={{ fontSize: 11 }}>${(s.monto_reclamado_usd||0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                <span className="chip mono" style={{ fontSize: 9 }}>{s.id_proveedor}</span>
                <button className="chip outline" style={{ fontSize: 9.5, cursor: 'pointer' }} onClick={() => onInvestigate(s.id_siniestro)}>
                  🦅 ver
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Panel derecho: proveedores recurrentes + pólizas */}
        <div>
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div className="diamond-divider" style={{ marginBottom: 10 }}>Proveedores recurrentes</div>
            {provs.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>No hay datos de proveedores.</div>}
            {provs.map((p: any) => (
              <div key={p.id_proveedor} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--mountain-blue)', fontWeight: 600 }}>{p.id_proveedor}</span>
                <div style={{ flex: 1, fontSize: 11 }}>{p.prov_nombre || '—'}</div>
                <span className="chip mono" style={{ fontSize: 9.5 }}>{p.n_casos} casos</span>
                {p.en_lista && <span className="chip red" style={{ fontSize: 9 }}>lista</span>}
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="diamond-divider" style={{ marginBottom: 10 }}>Pólizas ({polizas.length})</div>
            {polizas.map((po: any) => (
              <div key={po.id_poliza} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4, padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 11 }}>
                <span className="mono" style={{ fontWeight: 600 }}>{po.id_poliza}</span>
                <span className="chip mono" style={{ fontSize: 9 }}>{po.estado_poliza}</span>
                <div style={{ gridColumn: '1 / -1', fontSize: 10.5, color: 'var(--ink-mute)' }}>
                  {po.ramo} · {String(po.fecha_inicio).slice(0,10)} → {String(po.fecha_fin).slice(0,10)} · suma {`$${(po.suma_asegurada_usd||0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Componentes para renderizar el reporte ejecutivo del cóndor (markdown bonito)
const reporteMdComponents: any = {
  h1: ({ children }: any) => (
    <h3 style={{
      fontSize: 18, fontFamily: "var(--serif)", color: "var(--guayaba-red)",
      marginTop: 18, marginBottom: 8, fontWeight: 600,
    }}>{children}</h3>
  ),
  h2: ({ children }: any) => (
    <h4 style={{
      fontSize: 14, color: "var(--andes-orange)",
      marginTop: 16, marginBottom: 6, fontWeight: 700,
      letterSpacing: ".02em", display: "flex", alignItems: "center", gap: 6,
    }}>
      <span style={{ fontSize: 16 }}>▸</span>{children}
    </h4>
  ),
  h3: ({ children }: any) => (
    <h5 style={{ fontSize: 12.5, color: "var(--condor-wing)", marginTop: 12, marginBottom: 4, fontWeight: 600 }}>
      {children}
    </h5>
  ),
  p: ({ children }: any) => (
    <p style={{ margin: "6px 0", color: "var(--ink-soft)" }}>{children}</p>
  ),
  ul: ({ children }: any) => (
    <ul style={{ margin: "4px 0 8px 0", paddingLeft: 22 }}>{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol style={{ margin: "4px 0 8px 0", paddingLeft: 22 }}>{children}</ol>
  ),
  li: ({ children }: any) => (
    <li style={{ margin: "2px 0", color: "var(--ink-soft)", lineHeight: 1.55 }}>{children}</li>
  ),
  strong: ({ children }: any) => (
    <strong style={{ color: "var(--mountain-blue)" }}>{children}</strong>
  ),
  em: ({ children }: any) => (
    <em style={{ color: "var(--ink-mute)" }}>{children}</em>
  ),
  code: ({ children }: any) => (
    <code className="mono" style={{
      background: "var(--marfil-paper)", padding: "1px 5px", borderRadius: 4,
      fontSize: 11.5, color: "var(--guayaba-red)",
    }}>{children}</code>
  ),
  table: ({ children }: any) => (
    <table style={{
      width: "100%", borderCollapse: "collapse", margin: "8px 0",
      fontSize: 11.5, background: "white", borderRadius: 6, overflow: "hidden",
    }}>{children}</table>
  ),
  thead: ({ children }: any) => (
    <thead style={{ background: "var(--marfil-paper)" }}>{children}</thead>
  ),
  th: ({ children }: any) => (
    <th style={{
      padding: "6px 10px", textAlign: "left", borderBottom: "1px solid var(--line)",
      fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-mute)", fontWeight: 600,
    }}>{children}</th>
  ),
  td: ({ children }: any) => (
    <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--line)", color: "var(--ink-soft)" }}>
      {children}
    </td>
  ),
  hr: () => <hr style={{ border: 0, borderTop: "1px dashed var(--line)", margin: "14px 0" }} />,
  blockquote: ({ children }: any) => (
    <blockquote style={{
      margin: "8px 0", padding: "8px 12px",
      background: "var(--marfil-paper)", borderLeft: "3px solid var(--andes-orange)",
      borderRadius: 4, color: "var(--ink-soft)", fontStyle: "italic",
    }}>{children}</blockquote>
  ),
};

function renderInlineBold(text: string) {
  // Convierte "**texto**" en <strong>
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} style={{ color: "var(--guayaba-red)" }}>{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}

function MiniKpi({ label, value, tone = 'wing' }: any) {
  const c: any = { red: 'var(--guayaba-red)', green: 'var(--paramo-green)', orange: 'var(--andes-orange)', wing: 'var(--condor-wing)' };
  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <div style={{ fontSize: 9.5, color: 'var(--ink-mute)', letterSpacing: '.1em', textTransform: 'uppercase' }}>{label}</div>
      <div className="serif tabular" style={{ fontSize: 22, fontWeight: 600, color: c[tone], lineHeight: 1, marginTop: 4 }}>{value}</div>
    </div>
  );
}

/* ============================================================
   EXPLORAR — ver todos los 25K siniestros con filtros amplios
   ============================================================ */
export function ExplorarScreen({ onInvestigate }: any) {
  const API = (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL) || "http://localhost:8000";

  const [opciones, setOpciones] = useSc<any>(null);
  const [page, setPage] = useSc(0);
  const [limit] = useSc(50);
  const [data, setData] = useSc<any>(null);
  const [loading, setLoading] = useSc(false);

  // Filtros (controlado)
  const [filtros, setFiltros] = useSc({
    q: "", ciudad: "", sucursal: "", cobertura: "", estado: "",
    proveedor: "", asegurado: "",
    monto_min: "", monto_max: "",
    fecha_desde: "", fecha_hasta: "",
    solo_fraude_sim: false, solo_inyectados: false,
    orden: "fecha_desc",
  });

  useScE(() => {
    fetch(`${API}/casos/filtros/opciones`).then(r => r.json()).then(setOpciones);
  }, []);

  function buildQS() {
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    qs.set("offset", String(page * limit));
    qs.set("orden", filtros.orden);
    Object.entries(filtros).forEach(([k, v]) => {
      if (k === "orden") return;
      if (v === "" || v === false || v == null) return;
      qs.set(k, String(v));
    });
    return qs.toString();
  }

  useScE(() => {
    setLoading(true);
    fetch(`${API}/casos?${buildQS()}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, filtros]);

  function patch(k: string, v: any) {
    setPage(0); // reset pagina al cambiar filtro
    setFiltros((f: any) => ({ ...f, [k]: v }));
  }
  function limpiarFiltros() {
    setPage(0);
    setFiltros({
      q: "", ciudad: "", sucursal: "", cobertura: "", estado: "",
      proveedor: "", asegurado: "",
      monto_min: "", monto_max: "",
      fecha_desde: "", fecha_hasta: "",
      solo_fraude_sim: false, solo_inyectados: false,
      orden: "fecha_desc",
    });
  }

  const total = data?.total || 0;
  const nPaginas = data?.n_paginas || 0;
  const items = data?.items || [];
  const aplicados = data?.filtros_aplicados || {};

  return (
    <div style={{ height: "100%", overflow: "auto", background: "var(--marfil)" }}>
      <div style={{
        padding: "20px 32px", borderBottom: "1px solid var(--line)",
        background: "linear-gradient(180deg, rgba(44,95,141,0.06), transparent)",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <Condor size={30} mood="speak" tone="wing" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, letterSpacing: ".18em", color: "var(--mountain-blue)", fontWeight: 700, textTransform: "uppercase" }}>
            Explorador de cartera
          </div>
          <h2 style={{ fontSize: 22, marginTop: 2 }}>Todos los siniestros, todos los filtros</h2>
          <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>
            {total > 0
              ? `${total.toLocaleString('en-US')} casos coinciden con tus filtros · página ${page+1} de ${nPaginas}`
              : loading ? "cargando…" : "—"}
          </div>
        </div>
        <a className="btn ghost" style={{ fontSize: 11, textDecoration: "none" }}
           href={`${API}/casos?${buildQS().replace(/limit=\d+/, 'limit=500').replace(/offset=\d+/, 'offset=0')}`}
           target="_blank" rel="noreferrer">
          Ver JSON (max 500) →
        </a>
      </div>

      {/* Barra de filtros */}
      <div style={{
        padding: "14px 32px", background: "white", borderBottom: "1px solid var(--line)",
        display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8,
      }}>
        <input
          placeholder="🔍 buscar id (SIN-...)"
          value={filtros.q}
          onChange={e => patch("q", e.target.value)}
          style={expField}
        />
        <select value={filtros.sucursal} onChange={e => patch("sucursal", e.target.value)} style={expField}>
          <option value="">Sucursal (todas)</option>
          {opciones?.sucursales?.map((s: string) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filtros.cobertura} onChange={e => patch("cobertura", e.target.value)} style={expField}>
          <option value="">Cobertura (todas)</option>
          {opciones?.coberturas?.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtros.estado} onChange={e => patch("estado", e.target.value)} style={expField}>
          <option value="">Estado (todos)</option>
          {opciones?.estados?.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtros.ciudad} onChange={e => patch("ciudad", e.target.value)} style={expField}>
          <option value="">Ciudad (todas)</option>
          {opciones?.ciudades?.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtros.orden} onChange={e => patch("orden", e.target.value)} style={expField}>
          <option value="fecha_desc">Más recientes primero</option>
          <option value="fecha_asc">Más antiguos primero</option>
          <option value="monto_desc">Monto: mayor a menor</option>
          <option value="monto_asc">Monto: menor a mayor</option>
        </select>

        <input
          placeholder="Proveedor (PRV-...)"
          value={filtros.proveedor}
          onChange={e => patch("proveedor", e.target.value)}
          style={expField}
        />
        <input
          placeholder="Asegurado (ASE-...)"
          value={filtros.asegurado}
          onChange={e => patch("asegurado", e.target.value)}
          style={expField}
        />
        <input type="number" placeholder="Monto min USD" value={filtros.monto_min}
               onChange={e => patch("monto_min", e.target.value)} style={expField}/>
        <input type="number" placeholder="Monto max USD" value={filtros.monto_max}
               onChange={e => patch("monto_max", e.target.value)} style={expField}/>
        <input type="date" value={filtros.fecha_desde} onChange={e => patch("fecha_desde", e.target.value)} style={expField}/>
        <input type="date" value={filtros.fecha_hasta} onChange={e => patch("fecha_hasta", e.target.value)} style={expField}/>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}
               title="Casos marcados históricamente como sospechosos por el equipo. NO es una acusación.">
          <input type="checkbox" checked={filtros.solo_fraude_sim}
                 onChange={e => patch("solo_fraude_sim", e.target.checked)} />
          Solo con alerta histórica ⓘ
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}
               title="Casos sintéticos inyectados al dataset para auditar el modelo.">
          <input type="checkbox" checked={filtros.solo_inyectados}
                 onChange={e => patch("solo_inyectados", e.target.checked)} />
          Solo casos de auditoría ⓘ
        </label>
        <div />
        <div />
        <div />
        <button className="btn ghost" onClick={limpiarFiltros} style={{ fontSize: 11 }}>
          ✕ Limpiar filtros
        </button>
      </div>

      {/* Chips de filtros activos */}
      {Object.keys(aplicados).length > 0 && (
        <div style={{ padding: "10px 32px", background: "rgba(232,122,79,0.05)", display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11 }}>
          <span style={{ color: "var(--ink-mute)" }}>Activos:</span>
          {Object.entries(aplicados).map(([k, v]) => (
            <span key={k} className="chip" style={{ fontSize: 10, padding: "2px 8px" }}>
              {k}: <strong>{String(v)}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Banner aclaratorio sobre etiquetas */}
      <div style={{
        padding: "10px 32px", background: "rgba(74,124,89,0.05)",
        borderBottom: "1px solid var(--line)",
        fontSize: 11, color: "var(--ink-soft)",
      }}>
        ℹ️ Las etiquetas <span className="chip amber" style={{ fontSize: 9, margin: "0 2px" }}>🚩 alerta</span> y
        <span className="chip" style={{ fontSize: 9, margin: "0 2px" }}>auditoría</span> son marcas históricas del dataset (etiqueta_fraude_simulada y caso_inyectado). <strong>NO son acusaciones</strong> — solo indican que el caso fue marcado como sospechoso por el equipo o sintetizado para auditar el modelo. La decisión final siempre la toma un analista humano.
      </div>

      {/* Tabla de resultados */}
      <div style={{ padding: "16px 32px" }}>
        {loading && <div style={{ fontSize: 12, color: "var(--ink-mute)", padding: 20, textAlign: "center" }}>cargando…</div>}
        {!loading && items.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-mute)" }}>
            Ningún caso coincide con esos filtros. Probá relajar alguno.
          </div>
        )}
        {!loading && items.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "white", borderRadius: 8, overflow: "hidden" }}>
            <thead>
              <tr style={{ background: "var(--marfil-paper)" }}>
                {["ID", "Fecha", "Cobertura", "Estado", "Ciudad", "Sucursal", "Asegurado", "Proveedor", "Monto USD", "Flags", ""].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-mute)", borderBottom: "1px solid var(--line)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((c: any) => (
                <tr key={c.id_siniestro} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td className="mono" style={{ padding: "8px 10px", color: "var(--mountain-blue)", fontWeight: 600, fontSize: 11.5 }}>{c.id_siniestro}</td>
                  <td className="mono" style={{ padding: "8px 10px", fontSize: 11 }}>{String(c.fecha_ocurrencia).slice(0,10)}</td>
                  <td style={{ padding: "8px 10px" }}>{c.cobertura}</td>
                  <td style={{ padding: "8px 10px", fontSize: 11 }}>{c.estado}</td>
                  <td style={{ padding: "8px 10px", fontSize: 11 }}>{c.ciudad_evento}</td>
                  <td style={{ padding: "8px 10px", fontSize: 11 }}>{c.sucursal}</td>
                  <td className="mono" style={{ padding: "8px 10px", fontSize: 11 }}>{c.id_asegurado}</td>
                  <td className="mono" style={{ padding: "8px 10px", fontSize: 11 }}>{c.id_proveedor}</td>
                  <td className="tabular mono" style={{ padding: "8px 10px", textAlign: "right" }}>${(c.monto_reclamado_usd||0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: "8px 10px" }}>
                    {c.etiqueta_fraude_simulada > 0 && (
                      <span className="chip amber" style={{ fontSize: 9, marginRight: 2 }}
                            title="Marcado históricamente como sospechoso. No es acusación.">
                        🚩 alerta
                      </span>
                    )}
                    {c.caso_inyectado && (
                      <span className="chip" style={{ fontSize: 9 }}
                            title="Caso sintético inyectado para auditoría del modelo">
                        auditoría
                      </span>
                    )}
                    {!c.documentos_completos && <span className="chip" style={{ fontSize: 9, marginLeft: 2 }}>docs incompletos</span>}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <button className="chip outline" style={{ fontSize: 10, cursor: "pointer" }} onClick={() => onInvestigate && onInvestigate(c.id_siniestro)}>
                      🦅 investigar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Paginacion */}
        {nPaginas > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16, alignItems: "center" }}>
            <button className="btn ghost" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ fontSize: 11 }}>‹ Anterior</button>
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              Página {page + 1} de {nPaginas} ({total.toLocaleString('en-US')} casos)
            </span>
            <button className="btn ghost" onClick={() => setPage(p => Math.min(nPaginas - 1, p + 1))} disabled={page >= nPaginas - 1} style={{ fontSize: 11 }}>Siguiente ›</button>
          </div>
        )}
      </div>
    </div>
  );
}

const expField: any = {
  padding: "6px 10px",
  fontSize: 11.5,
  border: "1px solid var(--line-strong)",
  borderRadius: 6,
  background: "white",
  width: "100%",
  boxSizing: "border-box",
};

/* ============================================================
   CARGAR CASOS NUEVOS — bulk CSV + form individual
   ============================================================ */
export function CargarCasosScreen({ onInvestigate }: any) {
  const API = (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL) || "http://localhost:8000";
  const [archivo, setArchivo] = useSc<File | null>(null);
  const [preview, setPreview] = useSc<any[] | null>(null);
  const [subiendo, setSubiendo] = useSc(false);
  const [resultado, setResultado] = useSc<any>(null);
  const [tab, setTab] = useSc<"csv" | "form">("csv");

  // Form individual
  const [form, setForm] = useSc({
    cobertura: "Choque", monto_reclamado_usd: 5000, monto_pagado_usd: 0,
    estado: "Reserva", sucursal: "Quito", ciudad_evento: "Quito",
    descripcion: "Caso nuevo cargado manualmente",
    dias_desde_inicio_poliza: 60, dias_desde_fin_poliza: 305,
    dias_entre_ocurrencia_reporte: 1, historial_siniestros_asegurado: 0,
    documentos_completos: true, tuvo_parte_policial: true, tuvo_testigo: false,
    fault_responsable: "Asegurado",
    id_proveedor: "", id_asegurado: "",
  });

  async function handleFile(f: File | null) {
    setArchivo(f);
    setPreview(null);
    setResultado(null);
    if (!f) return;
    try {
      const text = await f.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        setPreview([{ error: "El CSV está vacío o no tiene filas de datos." }]);
        return;
      }
      const headers = lines[0].split(",").map(h => h.trim());
      const rows = lines.slice(1, 6).map(l => {
        const vals = l.split(",");
        const o: any = {};
        headers.forEach((h, i) => o[h] = (vals[i] || "").trim());
        return o;
      });
      setPreview(rows);
    } catch (e: any) {
      setPreview([{ error: e?.message || String(e) }]);
    }
  }

  async function subirCSV() {
    if (!archivo) return;
    setSubiendo(true);
    setResultado(null);
    try {
      const fd = new FormData();
      fd.append("file", archivo);
      const r = await fetch(`${API}/casos/cargar-csv`, { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) {
        setResultado({ ok: false, mensaje: d?.detail || `HTTP ${r.status}` });
      } else {
        setResultado(d);
      }
    } catch (e: any) {
      setResultado({ ok: false, mensaje: e?.message || String(e) });
    } finally {
      setSubiendo(false);
    }
  }

  async function subirForm() {
    setSubiendo(true);
    setResultado(null);
    try {
      const r = await fetch(`${API}/casos/cargar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      setResultado(d);
    } catch (e: any) {
      setResultado({ ok: false, mensaje: e?.message || String(e) });
    } finally {
      setSubiendo(false);
    }
  }

  function patchForm(k: string, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
  }

  return (
    <div style={{ height: "100%", overflow: "auto", background: "var(--marfil)" }}>
      {/* HERO */}
      <div style={{
        position: "relative", overflow: "hidden",
        padding: "28px 32px",
        background: "linear-gradient(135deg, #FAF6EE 0%, #F4EDE4 60%, rgba(74,124,89,0.08) 100%)",
        borderBottom: "1px solid var(--line)",
      }}>
        <div aria-hidden style={{
          position: "absolute", right: 32, top: 12, fontSize: 120, opacity: 0.06,
          pointerEvents: "none", animation: "condor-float 9s ease-in-out infinite",
        }}>📥</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Condor size={36} mood="speak" tone="wing" />
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".22em", color: "var(--paramo-green)", fontWeight: 700, textTransform: "uppercase" }}>
              Carga de nuevos siniestros al dataset
            </div>
            <h1 style={{ fontSize: 28, marginTop: 4, fontFamily: "var(--serif)", fontWeight: 500 }}>
              Sumá casos nuevos al cóndor en segundos.
            </h1>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>
              Subí un CSV con muchos casos o cargá uno solo desde el formulario.
              Se agregan a <span className="mono">data/processed/siniestros.parquet</span> y aparecen inmediatamente en bandeja, explorador y agente.
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "16px 32px 0", display: "flex", gap: 6 }}>
        {(["csv", "form"] as const).map(t => {
          const sel = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "10px 18px", fontSize: 13, fontWeight: 600,
                background: sel ? "white" : "var(--marfil-paper)",
                color: sel ? "var(--andes-orange)" : "var(--ink-mute)",
                border: sel ? "1px solid var(--line)" : "1px solid transparent",
                borderBottom: sel ? "1px solid white" : "1px solid var(--line)",
                borderRadius: "8px 8px 0 0",
                cursor: "pointer", marginBottom: -1,
              }}
            >
              {t === "csv" ? "📂 Subir CSV (bulk)" : "📝 Cargar uno solo (form)"}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "0 32px 32px" }}>
        <div className="card" style={{ padding: 22, borderRadius: "0 8px 8px 8px" }}>
          {tab === "csv" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--condor-wing)" }}>
                    1. Bajá la plantilla (asegurate de respetar los nombres de columna)
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>
                    Columnas <strong>obligatorias</strong>: <span className="mono">cobertura</span>, <span className="mono">monto_reclamado_usd</span>. El resto tienen defaults.
                  </div>
                </div>
                <a className="btn ghost" style={{ fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" }}
                   href={`${API}/casos/plantilla.csv`}>
                  ⬇ Descargar plantilla.csv
                </a>
              </div>

              <div style={{ marginTop: 18, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--condor-wing)" }}>
                  2. Subí tu archivo CSV
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>
                  Máximo 1000 filas por carga. Encoding UTF-8.
                </div>
              </div>

              <label htmlFor="csv-input" style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 12, padding: "30px 20px",
                background: archivo ? "rgba(74,124,89,0.08)" : "var(--marfil-paper)",
                border: `2px dashed ${archivo ? "var(--paramo-green)" : "var(--line-strong)"}`,
                borderRadius: 12, cursor: "pointer", textAlign: "center",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => { if (!archivo) (e.currentTarget as HTMLElement).style.borderColor = "var(--andes-orange)"; }}
              onMouseLeave={e => { if (!archivo) (e.currentTarget as HTMLElement).style.borderColor = "var(--line-strong)"; }}
              >
                <input id="csv-input" type="file" accept=".csv" style={{ display: "none" }}
                       onChange={e => handleFile(e.target.files?.[0] || null)} />
                <div style={{ fontSize: 36 }}>{archivo ? "✓" : "📂"}</div>
                <div style={{ textAlign: "left" }}>
                  {archivo ? (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--paramo-green)" }}>{archivo.name}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                        {(archivo.size / 1024).toFixed(1)} KB · click para cambiar
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Click para elegir tu CSV</div>
                      <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>O arrastrá el archivo aquí</div>
                    </>
                  )}
                </div>
                {archivo && (
                  <button onClick={e => { e.preventDefault(); handleFile(null); }}
                          style={{ background: "transparent", border: 0, fontSize: 18, color: "var(--guayaba-red)", cursor: "pointer" }}>×</button>
                )}
              </label>

              {/* Preview */}
              {preview && preview.length > 0 && !preview[0].error && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>
                    Preview · primeras {preview.length} filas
                  </div>
                  <div style={{ overflow: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: "var(--marfil-paper)" }}>
                          {Object.keys(preview[0]).slice(0, 8).map(k => (
                            <th key={k} style={{ padding: "6px 10px", textAlign: "left", fontSize: 9.5, color: "var(--ink-mute)", letterSpacing: ".05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((r, i) => (
                          <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                            {Object.entries(r).slice(0, 8).map(([k, v]) => (
                              <td key={k} className="mono" style={{ padding: "6px 10px", fontSize: 10.5, color: "var(--condor-wing)", whiteSpace: "nowrap", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
                                {String(v)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {preview && preview[0]?.error && (
                <div style={{ marginTop: 12, padding: 10, background: "rgba(197,51,58,0.06)", borderRadius: 8, fontSize: 12, color: "var(--guayaba-red)" }}>
                  ⚠ {preview[0].error}
                </div>
              )}

              <button
                onClick={subirCSV}
                disabled={!archivo || subiendo}
                className="btn warm"
                style={{
                  marginTop: 18, padding: "12px 18px", width: "100%",
                  background: subiendo ? "var(--ink-mute)" : !archivo ? "var(--line-strong)"
                          : "linear-gradient(135deg, var(--paramo-green), var(--mountain-blue))",
                  color: "white", border: 0, borderRadius: 10, fontSize: 14, fontWeight: 600,
                  cursor: (!archivo || subiendo) ? "not-allowed" : "pointer",
                  boxShadow: archivo && !subiendo ? "0 4px 14px rgba(74,124,89,0.35)" : "none",
                }}>
                {subiendo ? "🦅 Cargando al dataset…" : !archivo ? "Elegí un CSV primero" : "🦅 Cargar al dataset del cóndor"}
              </button>
            </>
          )}

          {tab === "form" && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--condor-wing)", marginBottom: 4 }}>
                Cargar UN siniestro manualmente
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginBottom: 14 }}>
                Los campos en blanco usan defaults. Después de guardar, podés ver el caso en la bandeja con su nuevo <span className="mono">id_siniestro</span> autogenerado.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 12 }}>
                <FormField label="Cobertura *">
                  <select value={form.cobertura} onChange={e => patchForm("cobertura", e.target.value)} style={fieldStyle}>
                    {["Choque","Robo","RC","Daño","Pérdida Total","Incendio"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </FormField>
                <FormField label="Monto reclamado USD *">
                  <input type="number" value={form.monto_reclamado_usd} onChange={e => patchForm("monto_reclamado_usd", +e.target.value)} style={fieldStyle}/>
                </FormField>
                <FormField label="Estado">
                  <select value={form.estado} onChange={e => patchForm("estado", e.target.value)} style={fieldStyle}>
                    {["Reserva","Pago Total","Pago Parcial","Anticipo","Negativa","Cierre Sin Consecuencia","Liquidado"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </FormField>
                <FormField label="Sucursal">
                  <input value={form.sucursal} onChange={e => { patchForm("sucursal", e.target.value); patchForm("ciudad_evento", e.target.value); }} style={fieldStyle}/>
                </FormField>
                <FormField label="Días desde inicio póliza">
                  <input type="number" value={form.dias_desde_inicio_poliza} onChange={e => patchForm("dias_desde_inicio_poliza", +e.target.value)} style={fieldStyle}/>
                </FormField>
                <FormField label="Días entre evento y reporte">
                  <input type="number" value={form.dias_entre_ocurrencia_reporte} onChange={e => patchForm("dias_entre_ocurrencia_reporte", +e.target.value)} style={fieldStyle}/>
                </FormField>
                <FormField label="Historial asegurado">
                  <input type="number" value={form.historial_siniestros_asegurado} onChange={e => patchForm("historial_siniestros_asegurado", +e.target.value)} style={fieldStyle}/>
                </FormField>
                <FormField label="ID proveedor (opcional)">
                  <input value={form.id_proveedor} placeholder="auto si vacío" onChange={e => patchForm("id_proveedor", e.target.value)} style={fieldStyle}/>
                </FormField>
                <FormField label="ID asegurado (opcional)">
                  <input value={form.id_asegurado} placeholder="auto si vacío" onChange={e => patchForm("id_asegurado", e.target.value)} style={fieldStyle}/>
                </FormField>
                <div style={{ gridColumn: "1 / -1" }}>
                  <FormField label="Descripción del siniestro">
                    <textarea value={form.descripcion} onChange={e => patchForm("descripcion", e.target.value)} rows={2}
                              style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit" }}/>
                  </FormField>
                </div>
              </div>

              <button
                onClick={subirForm}
                disabled={subiendo}
                className="btn warm"
                style={{
                  marginTop: 16, padding: "12px 18px", width: "100%",
                  background: subiendo ? "var(--ink-mute)" : "linear-gradient(135deg, var(--paramo-green), var(--mountain-blue))",
                  color: "white", border: 0, borderRadius: 10, fontSize: 14, fontWeight: 600,
                  cursor: subiendo ? "wait" : "pointer",
                  boxShadow: subiendo ? "none" : "0 4px 14px rgba(74,124,89,0.35)",
                }}>
                {subiendo ? "🦅 Guardando…" : "🦅 Guardar caso en el dataset"}
              </button>
            </>
          )}

          {/* Resultado */}
          {resultado && (
            <div style={{
              marginTop: 18, padding: 16, borderRadius: 10,
              background: resultado.ok ? "rgba(74,124,89,0.08)" : "rgba(197,51,58,0.08)",
              borderLeft: `3px solid ${resultado.ok ? "var(--paramo-green)" : "var(--guayaba-red)"}`,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: resultado.ok ? "var(--paramo-green)" : "var(--guayaba-red)" }}>
                {resultado.ok ? "✓" : "⚠"} {resultado.mensaje}
              </div>
              {resultado.ok && resultado.n_agregados > 0 && (
                <>
                  <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 8 }}>
                    Antes: <strong>{resultado.n_antes?.toLocaleString('en-US')}</strong> ·
                    {' '}Ahora: <strong>{resultado.n_total?.toLocaleString('en-US')}</strong> ·
                    {' '}Agregados: <strong style={{ color: "var(--paramo-green)" }}>{resultado.n_agregados}</strong>
                    {resultado.n_errores > 0 && <> · Rechazados: <strong style={{ color: "var(--guayaba-red)" }}>{resultado.n_errores}</strong></>}
                  </div>
                  {resultado.ids_generados?.length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                      IDs generados: {resultado.ids_generados.map((id: string) => (
                        <button key={id}
                                onClick={() => onInvestigate && onInvestigate(id)}
                                className="mono chip outline" style={{ fontSize: 10, cursor: "pointer", marginRight: 4, marginTop: 4 }}>
                          🦅 {id}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {resultado.errores && resultado.errores.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--guayaba-red)" }}>
                    Ver {resultado.errores.length} errore(s)
                  </summary>
                  <div style={{ marginTop: 6, maxHeight: 200, overflow: "auto" }}>
                    {resultado.errores.map((e: any, i: number) => (
                      <div key={i} style={{ fontSize: 10.5, padding: "4px 0", color: "var(--ink-soft)" }}>
                        Fila {e.fila}: <span style={{ color: "var(--guayaba-red)" }}>{e.error}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Aviso final */}
        <div style={{
          marginTop: 16, padding: 14, fontSize: 11.5, color: "var(--ink-soft)",
          background: "rgba(232,122,79,0.05)", borderRadius: 8,
          borderLeft: "3px solid var(--andes-orange)",
        }}>
          ⚖️ Los casos cargados se mezclan con el dataset existente. El próximo reentreno
          del modelo XGBoost / IsolationForest los incorporará. Mientras tanto, ya aparecen
          en bandeja, explorador, agente y mapa de Ecuador.
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PREVENCION — alertas tempranas + watchlist sugerida
   "Lo que la industria llama 'detectar fraude' es ya tarde. AchachAI lo previene."
   ============================================================ */
export function PrevencionScreen({ onInvestigate }: any) {
  const API = (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL) || "http://localhost:8000";
  const [alertas, setAlertas] = useSc<any>(null);
  const [watchlist, setWatchlist] = useSc<any>(null);
  const [ventana, setVentana] = useSc(30);
  const [loading, setLoading] = useSc(true);

  useScE(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/prevencion/alertas-tempranas?ventana_dias=${ventana}`).then(r => r.json()).catch(() => null),
      fetch(`${API}/prevencion/watchlist-sugerida`).then(r => r.json()).catch(() => null),
    ]).then(([a, w]) => { setAlertas(a); setWatchlist(w); setLoading(false); });
  }, [ventana]);

  const sevColor = (s: string) => s === 'alta' ? 'var(--guayaba-red)' : s === 'media' ? 'var(--andes-orange)' : 'var(--paramo-green)';
  const tipoIcon: Record<string, string> = {
    proveedor_uptick: '📈',
    asegurado_recurrente: '👤',
    cluster_geografico: '📍',
  };

  return (
    <div style={{ height: "100%", overflow: "auto", background: "var(--marfil)" }}>
      <div style={{
        padding: "20px 32px", borderBottom: "1px solid var(--line)",
        background: "linear-gradient(180deg, rgba(74,124,89,0.10), transparent)",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <Condor size={32} mood="alert" tone="wing" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, letterSpacing: ".18em", color: "var(--paramo-green)", fontWeight: 700, textTransform: "uppercase" }}>
            🛡️ Sistema de prevención · antes de que pase
          </div>
          <h2 style={{ fontSize: 22, marginTop: 2 }}>Alertas tempranas y watchlist sugerida</h2>
          <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>
            La mayoría de soluciones detectan fraude <em>después</em> del pago. AchachAI detecta los <strong>patrones formándose</strong> y sugiere intervenir antes de que generen pérdidas.
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>Ventana de análisis</div>
          <select
            value={ventana}
            onChange={(e) => setVentana(+e.target.value)}
            style={{ padding: "6px 10px", border: "1px solid var(--line-strong)", borderRadius: 6, marginTop: 4 }}
          >
            <option value={7}>últimos 7 días</option>
            <option value={14}>últimos 14 días</option>
            <option value={30}>últimos 30 días</option>
            <option value={60}>últimos 60 días</option>
          </select>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Condor size={48} mood="think" tone="wing" />
            <div style={{ marginTop: 10, fontSize: 13, color: "var(--ink-mute)" }}>Buscando clusters en formación…</div>
          </div>
        )}

        {!loading && alertas && (
          <>
            {/* KPI header de prevención */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
              <MiniKpi label="Alertas tempranas" value={alertas.n_alertas} tone={alertas.n_alta_severidad > 0 ? "red" : "orange"} />
              <MiniKpi label="Alta severidad" value={alertas.n_alta_severidad} tone="red" />
              <MiniKpi label="USD en riesgo (prevenible)" value={`$${Math.round((alertas.monto_total_en_riesgo_usd||0)/1000)}K`} tone="green" />
              <MiniKpi label="Watchlist sugerida" value={watchlist?.proveedores_sugeridos?.length || 0} tone="wing" />
            </div>

            <div style={{
              padding: 14, marginBottom: 18,
              background: alertas.n_alertas > 0
                ? "linear-gradient(180deg, rgba(232,122,79,0.08), rgba(232,122,79,0.02))"
                : "linear-gradient(180deg, rgba(74,124,89,0.08), rgba(74,124,89,0.02))",
              borderLeft: `3px solid ${alertas.n_alertas > 0 ? "var(--andes-orange)" : "var(--paramo-green)"}`,
              borderRadius: 8, fontSize: 13,
            }}>
              <strong style={{ color: alertas.n_alertas > 0 ? "var(--andes-orange)" : "var(--paramo-green)" }}>
                🦅 El cóndor te avisa:
              </strong> {alertas.mensaje}
              {alertas.diagnostico && (
                <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-mute)" }}>
                  Diagnóstico: {alertas.diagnostico.n_siniestros_ventana_actual.toLocaleString()} siniestros en la ventana actual ·
                  {' '}{alertas.diagnostico.n_proveedores_activos_ahora} proveedores activos ·
                  fecha de corte {alertas.fecha_corte?.slice(0,10)}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
              {/* Alertas tempranas */}
              <div className="card" style={{ padding: 18 }}>
                <div className="diamond-divider" style={{ marginBottom: 12 }}>Clusters formándose</div>
                {alertas.alertas?.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                    ✓ Nada raro en la ventana actual. Sigue volando.
                  </div>
                )}
                <div style={{ display: "grid", gap: 10 }}>
                  {alertas.alertas?.map((a: any, i: number) => (
                    <div key={i} style={{
                      padding: "12px 14px",
                      background: "white", borderRadius: 10,
                      borderLeft: `4px solid ${sevColor(a.severidad)}`,
                      border: "1px solid var(--line)",
                    }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 18 }}>{tipoIcon[a.tipo] || '⚠️'}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: sevColor(a.severidad) }}>
                          {a.titulo}
                        </span>
                        <span className={`chip mono ${a.severidad === 'alta' ? 'red' : 'amber'}`} style={{ fontSize: 9 }}>
                          {a.severidad}
                        </span>
                      </div>
                      <ul style={{ margin: "0 0 8px 18px", padding: 0, fontSize: 11.5, color: "var(--ink-soft)", lineHeight: 1.55 }}>
                        {(a.evidencia || []).map((e: string, j: number) => <li key={j}>{e}</li>)}
                      </ul>
                      <div style={{
                        padding: "8px 10px", background: "var(--marfil-paper)", borderRadius: 6,
                        fontSize: 11.5, color: "var(--condor-wing)",
                        borderLeft: "3px solid var(--andes-orange)",
                      }}>
                        <strong>Acción sugerida:</strong> {a.accion_sugerida}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Watchlist sugerida */}
              <div className="card" style={{ padding: 18 }}>
                <div className="diamond-divider" style={{ marginBottom: 12 }}>Proveedores que deberías vigilar</div>
                <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginBottom: 10 }}>
                  {watchlist?.criterio || ""}
                </div>
                {watchlist?.proveedores_sugeridos?.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>Sin candidatos por ahora.</div>
                )}
                <div style={{ display: "grid", gap: 6 }}>
                  {(watchlist?.proveedores_sugeridos || []).map((p: any) => (
                    <div key={p.id_proveedor} style={{
                      padding: "8px 12px", background: "var(--marfil-paper)", borderRadius: 8,
                      borderLeft: "3px solid var(--andes-orange)",
                    }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                        <span className="mono" style={{ fontSize: 11, color: "var(--mountain-blue)", fontWeight: 600 }}>{p.id_proveedor}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 500, flex: 1 }}>{p.nombre}</span>
                        <span className="chip red mono" style={{ fontSize: 9 }} title="Tasa histórica de alertas en este proveedor">
                          {(p.tasa_fraude_sim*100).toFixed(0)}% alertas
                        </span>
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>
                        {p.n_siniestros} siniestros · {p.tipo} · {p.ciudad} · USD {(p.monto_total || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} total
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{
              marginTop: 20, padding: 16,
              background: "linear-gradient(180deg, rgba(232,122,79,0.06), rgba(232,122,79,0.02))",
              borderRadius: 10, border: "1px solid rgba(232,122,79,0.2)",
              fontSize: 12.5, lineHeight: 1.6, color: "var(--condor-wing)",
            }}>
              <strong style={{ color: "var(--andes-orange)" }}>¿Por qué esto importa?</strong>
              <p style={{ margin: "6px 0 0" }}>
                Si bloqueás un proveedor sospechoso <strong>antes</strong> de pagar 5 reclamos más, ahorrás todo ese dinero.
                Esta pantalla cuantifica esa oportunidad: <strong>USD {Math.round((alertas?.monto_total_en_riesgo_usd||0)/1000)}K</strong> en exposición prevenible si actúas en los próximos {ventana} días.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   AJUSTES — pesos de senales y reglas editables
   ============================================================ */
export function AjustesScreen() {
  const API = (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL) || "http://localhost:8000";
  const [cfg, setCfg] = useSc<any>(null);
  const [savedMsg, setSavedMsg] = useSc<string | null>(null);
  const [busy, setBusy] = useSc(false);
  // Fairness + admin
  const [fairness, setFairness] = useSc<any>(null);
  const [modelInfo, setModelInfo] = useSc<any>(null);
  const [retrainLog, setRetrainLog] = useSc<any>(null);
  const [retraining, setRetraining] = useSc(false);

  useScE(() => { load(); cargarFairness(); cargarInfoModelos(); }, []);

  function load() {
    fetch(`${API}/config/pesos`).then(r => r.json()).then(d => setCfg(d.config));
  }
  function cargarFairness() {
    fetch(`${API}/feedback/fairness`).then(r => r.json()).then(setFairness).catch(() => setFairness(null));
  }
  function cargarInfoModelos() {
    fetch(`${API}/admin/modelos-info`).then(r => r.json()).then(setModelInfo).catch(() => setModelInfo(null));
  }

  async function reentrenarIForest() {
    if (!confirm("¿Reentrenar IsolationForest con los datos actuales? Tarda ~5-10s.")) return;
    setRetraining(true);
    setRetrainLog(null);
    try {
      const r = await fetch(`${API}/admin/reentrenar-iforest`, { method: "POST" });
      const d = await r.json();
      setRetrainLog(d);
      cargarInfoModelos();
    } catch (e: any) {
      setRetrainLog({ ok: false, mensaje: e?.message || String(e) });
    } finally {
      setRetraining(false);
    }
  }

  async function save() {
    setBusy(true);
    setSavedMsg(null);
    try {
      const r = await fetch(`${API}/config/pesos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const d = await r.json();
      setSavedMsg(d?.ok ? `✓ Pesos guardados. Cache invalidado.` : `⚠ ${JSON.stringify(d)}`);
    } catch (e: any) {
      setSavedMsg(`✗ ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function resetDefault() {
    if (!confirm("¿Restaurar los pesos del PDF del reto? Se perderán tus ajustes.")) return;
    setBusy(true);
    try {
      await fetch(`${API}/config/pesos/reset`, { method: "POST" });
      await load();
      setSavedMsg("✓ Restaurado a default del PDF.");
    } finally { setBusy(false); }
  }

  if (!cfg) return <div style={{ padding: 40 }}><Condor size={48} mood="think" tone="orange" /> Cargando configuración…</div>;

  function patchSenalMax(id: string, max: number) {
    setCfg((c: any) => ({ ...c, senales: { ...c.senales, [id]: { ...c.senales[id], max } } }));
  }
  function patchUmbral(k: string, v: number) {
    setCfg((c: any) => ({ ...c, umbrales_score: { ...c.umbrales_score, [k]: v } }));
  }
  function toggleRegla(codigo: string) {
    setCfg((c: any) => ({
      ...c,
      reglas: { ...c.reglas, [codigo]: { ...c.reglas[codigo], activa: !c.reglas[codigo].activa } },
    }));
  }

  return (
    <div style={{ height: "100%", overflow: "auto", background: "var(--marfil)" }}>
      <div style={{
        padding: "20px 32px", borderBottom: "1px solid var(--line)",
        background: "linear-gradient(180deg, rgba(232,122,79,0.08), transparent)",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <Condor size={30} mood="speak" tone="orange" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, letterSpacing: ".18em", color: "var(--andes-orange)", fontWeight: 700, textTransform: "uppercase" }}>
            Ajustes · calibración de pesos
          </div>
          <h2 style={{ fontSize: 22, marginTop: 2 }}>Reglas y señales editables</h2>
          <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>
            Cambiá los pesos del PDF, desactivá reglas críticas, ajustá umbrales rojo/amarillo/verde. Los cambios persisten en <span className="mono">data/processed/pesos_config.json</span> e invalidan el cache.
          </div>
        </div>
        <button className="btn ghost" onClick={resetDefault} disabled={busy}>↺ Restaurar default PDF</button>
        <button className="btn warm" onClick={save} disabled={busy}>{busy ? "Guardando…" : "💾 Guardar y aplicar"}</button>
      </div>

      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        {/* Senales */}
        <div className="card" style={{ padding: 18 }}>
          <div className="diamond-divider" style={{ marginBottom: 12 }}>14 Señales ponderadas</div>
          <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginBottom: 10 }}>
            Mové el slider de cada señal para cambiar su peso máximo. Reduce a 0 para silenciar la señal.
          </div>
          {Object.entries(cfg.senales).map(([id, s]: any) => (
            <div key={id} style={{ marginBottom: 10, padding: "8px 10px", background: "var(--marfil-paper)", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                <span className="mono chip" style={{ fontSize: 9.5 }}>S{id}</span>
                <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{s.nombre}</span>
                <span className="tabular mono" style={{ fontSize: 12, color: "var(--andes-orange)", fontWeight: 600 }}>{s.max} pts</span>
              </div>
              <input
                type="range" min={0} max={15} value={s.max}
                onChange={(e) => patchSenalMax(id, +e.target.value)}
                style={{ width: "100%", accentColor: "var(--andes-orange)" }}
              />
              <div style={{ fontSize: 9.5, color: "var(--ink-mute)" }}>
                {(s.thresholds || []).map((t: any) => `${t.if} → ${t.pts}pts`).join(" · ")}
              </div>
            </div>
          ))}
        </div>

        {/* Reglas + umbrales */}
        <div>
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div className="diamond-divider" style={{ marginBottom: 12 }}>7 Reglas críticas (override)</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginBottom: 10 }}>
              Cuando una regla se activa, fuerza el semáforo a ROJO o AMARILLO sin importar el score numérico. Podés desactivar una regla si tu equipo decide no aplicarla.
            </div>
            {Object.entries(cfg.reglas).map(([codigo, r]: any) => (
              <label key={codigo} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                background: "var(--marfil-paper)", borderRadius: 8, marginBottom: 6, cursor: "pointer",
              }}>
                <input type="checkbox" checked={!!r.activa} onChange={() => toggleRegla(codigo)} />
                <span className="mono chip red" style={{ fontSize: 9.5 }}>{codigo}</span>
                <div style={{ flex: 1, fontSize: 11.5 }}>{r.nombre}</div>
                <span className={`chip mono ${r.nivel === "ROJO" ? "red" : "amber"}`} style={{ fontSize: 9 }}>{r.nivel}</span>
              </label>
            ))}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="diamond-divider" style={{ marginBottom: 12 }}>Umbrales del semáforo</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginBottom: 10 }}>
              Define cuándo el score numérico (0-100) pasa de verde a amarillo a rojo. El PDF sugiere 0-40 / 41-75 / 76-100.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "end" }}>
              <FormField label="Verde hasta (≤)">
                <input type="number" min={0} max={100} value={cfg.umbrales_score?.verde_hasta || 40}
                  onChange={(e) => patchUmbral("verde_hasta", +e.target.value)} style={fieldStyle}/>
              </FormField>
              <FormField label="Amarillo hasta (≤)">
                <input type="number" min={0} max={100} value={cfg.umbrales_score?.amarillo_hasta || 75}
                  onChange={(e) => patchUmbral("amarillo_hasta", +e.target.value)} style={fieldStyle}/>
              </FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 12, fontSize: 10.5, textAlign: "center" }}>
              <div style={{ padding: 8, background: "rgba(74,124,89,0.15)", borderRadius: 6 }}>
                🟢 VERDE<br/><span className="mono">0 – {cfg.umbrales_score?.verde_hasta || 40}</span>
              </div>
              <div style={{ padding: 8, background: "rgba(212,165,116,0.20)", borderRadius: 6 }}>
                🟡 AMARILLO<br/><span className="mono">{(cfg.umbrales_score?.verde_hasta || 40)+1} – {cfg.umbrales_score?.amarillo_hasta || 75}</span>
              </div>
              <div style={{ padding: 8, background: "rgba(197,51,58,0.15)", borderRadius: 6 }}>
                🔴 ROJO<br/><span className="mono">{(cfg.umbrales_score?.amarillo_hasta || 75)+1} – 100</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {savedMsg && (
        <div style={{ position: "fixed", bottom: 24, right: 24, padding: "10px 16px",
          background: savedMsg.startsWith("✓") ? "var(--paramo-green)" : "var(--guayaba-red)",
          color: "white", borderRadius: 8, fontSize: 12, boxShadow: "var(--shadow-lg)" }}>
          {savedMsg}
        </div>
      )}

      {/* === PANEL AUDITORÍA DEL CÓNDOR (fairness + admin de modelos) === */}
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>
        {/* Fairness analysis */}
        <div className="card" style={{ padding: 18 }}>
          <div className="diamond-divider" style={{ marginBottom: 12 }}>
            🎯 Auditoría de sesgo · acuerdo humano vs modelo
          </div>
          {!fairness && (
            <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>Cargando fairness…</div>
          )}
          {fairness?.mensaje && fairness?.cohen_kappa == null && (
            <div style={{
              padding: 14, background: "var(--marfil-paper)", borderRadius: 8,
              fontSize: 12.5, color: "var(--ink-soft)", borderLeft: "3px solid var(--andes-orange)",
            }}>
              {fairness.mensaje}
            </div>
          )}
          {fairness?.cohen_kappa != null && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                <Stat label="Decisiones válidas" value={fairness.n_validos} />
                <Stat label="Acuerdo simple" value={`${fairness.acuerdo_simple_pct}%`} />
                <Stat
                  label="Cohen κ"
                  value={fairness.cohen_kappa.toFixed(3)}
                  tone={fairness.cohen_kappa >= 0.6 ? "green" : fairness.cohen_kappa >= 0.4 ? "orange" : "red"}
                />
              </div>
              <div style={{
                padding: 10, marginBottom: 14, fontSize: 12, lineHeight: 1.5,
                background: "linear-gradient(180deg, rgba(232,122,79,0.06), white)",
                borderLeft: "3px solid var(--andes-orange)", borderRadius: 6,
              }}>
                <strong>Interpretación:</strong> {fairness.interpretacion}
              </div>

              {/* Breakdown por sucursal */}
              {fairness.breakdown_sucursal?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10.5, color: "var(--ink-mute)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>
                    Acuerdo por SUCURSAL · detección de sesgo geográfico
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    {fairness.breakdown_sucursal.slice(0, 8).map((b: any) => {
                      const k = b.kappa;
                      const tc = k == null ? "var(--ink-mute)"
                              : k >= 0.6 ? "var(--paramo-green)"
                              : k >= 0.4 ? "var(--andes-orange)"
                              : "var(--guayaba-red)";
                      return (
                        <div key={b.grupo} style={{
                          display: "grid", gridTemplateColumns: "120px 1fr 60px 60px",
                          gap: 8, alignItems: "center", padding: "5px 8px",
                          background: "var(--marfil-paper)", borderRadius: 6, fontSize: 11.5,
                        }}>
                          <span style={{ fontWeight: 500 }}>{b.grupo}</span>
                          <div style={{ flex: 1, height: 4, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${b.acuerdo_pct}%`, height: "100%", background: tc }} />
                          </div>
                          <span className="tabular mono" style={{ fontSize: 10.5 }}>{b.n} dec</span>
                          <span className="tabular mono" style={{ fontSize: 10.5, color: tc, fontWeight: 600 }}>
                            κ {k != null ? k.toFixed(2) : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Breakdown por cobertura */}
              {fairness.breakdown_cobertura?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10.5, color: "var(--ink-mute)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>
                    Acuerdo por COBERTURA · detección de sesgo por tipo
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    {fairness.breakdown_cobertura.map((b: any) => {
                      const k = b.kappa;
                      const tc = k == null ? "var(--ink-mute)"
                              : k >= 0.6 ? "var(--paramo-green)"
                              : k >= 0.4 ? "var(--andes-orange)"
                              : "var(--guayaba-red)";
                      return (
                        <div key={b.grupo} style={{
                          display: "grid", gridTemplateColumns: "120px 1fr 60px 60px",
                          gap: 8, alignItems: "center", padding: "5px 8px",
                          background: "var(--marfil-paper)", borderRadius: 6, fontSize: 11.5,
                        }}>
                          <span style={{ fontWeight: 500 }}>{b.grupo}</span>
                          <div style={{ flex: 1, height: 4, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${b.acuerdo_pct}%`, height: "100%", background: tc }} />
                          </div>
                          <span className="tabular mono" style={{ fontSize: 10.5 }}>{b.n} dec</span>
                          <span className="tabular mono" style={{ fontSize: 10.5, color: tc, fontWeight: 600 }}>
                            κ {k != null ? k.toFixed(2) : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ fontSize: 10.5, color: "var(--ink-mute)", lineHeight: 1.5 }}>
                {fairness.nota}
              </div>
            </>
          )}
          <button
            className="btn ghost"
            style={{ marginTop: 10, fontSize: 11 }}
            onClick={cargarFairness}
          >
            ↻ Recalcular
          </button>
        </div>

        {/* Admin de modelos + reentreno on-demand */}
        <div className="card" style={{ padding: 18 }}>
          <div className="diamond-divider" style={{ marginBottom: 12 }}>
            🔧 Estado de modelos · reentreno on-demand
          </div>

          {modelInfo && (
            <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
              {["xgboost", "iforest"].map(k => {
                const m = modelInfo[k];
                if (!m) return null;
                return (
                  <div key={k} style={{
                    padding: "10px 12px", background: "var(--marfil-paper)",
                    borderRadius: 8, borderLeft: `3px solid ${m.existe ? "var(--paramo-green)" : "var(--guayaba-red)"}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>{k}</span>
                      {m.existe
                        ? <span className="chip green mono" style={{ fontSize: 9 }}>✓ {m.size_kb} KB</span>
                        : <span className="chip red mono" style={{ fontSize: 9 }}>no entrenado</span>}
                    </div>
                    {m.mtime && (
                      <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 2 }}>
                        Entrenado: {String(m.mtime).slice(0, 16).replace("T", " ")}
                      </div>
                    )}
                    {m.meta?.contamination != null && (
                      <div style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>
                        contamination={m.meta.contamination} · n_estimators={m.meta.n_estimators} · n_filas={m.meta.n_filas_train?.toLocaleString?.('en-US')}
                      </div>
                    )}
                    {m.metricas?.auc != null && (
                      <div style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>
                        AUC {m.metricas.auc.toFixed(3)} · Recall {m.metricas.recall?.toFixed(3)} · F1 {m.metricas.f1?.toFixed(3)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            className="btn warm"
            disabled={retraining}
            onClick={reentrenarIForest}
            style={{ width: "100%", padding: "10px 14px" }}
          >
            {retraining ? "🦅 Reentrenando IsolationForest…" : "⚡ Reentrenar IsolationForest ahora"}
          </button>

          {retrainLog && (
            <div style={{
              marginTop: 12, padding: 10,
              background: retrainLog.ok ? "rgba(74,124,89,0.08)" : "rgba(197,51,58,0.08)",
              borderRadius: 8,
              borderLeft: `3px solid ${retrainLog.ok ? "var(--paramo-green)" : "var(--guayaba-red)"}`,
              fontSize: 11.5,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {retrainLog.ok ? "✓" : "✗"} {retrainLog.mensaje}
              </div>
              {retrainLog.stdout && (
                <details style={{ marginTop: 4 }}>
                  <summary style={{ cursor: "pointer", fontSize: 10.5, color: "var(--ink-mute)" }}>Ver stdout</summary>
                  <pre className="mono" style={{ fontSize: 9.5, padding: 8, background: "var(--marfil-paper)", borderRadius: 4, maxHeight: 160, overflow: "auto", whiteSpace: "pre-wrap" }}>
                    {retrainLog.stdout}
                  </pre>
                </details>
              )}
              {retrainLog.stderr && retrainLog.stderr.trim() && (
                <details style={{ marginTop: 4 }}>
                  <summary style={{ cursor: "pointer", fontSize: 10.5, color: "var(--guayaba-red)" }}>Ver stderr</summary>
                  <pre className="mono" style={{ fontSize: 9.5, padding: 8, background: "rgba(197,51,58,0.06)", borderRadius: 4, maxHeight: 160, overflow: "auto", whiteSpace: "pre-wrap" }}>
                    {retrainLog.stderr}
                  </pre>
                </details>
              )}
            </div>
          )}

          <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 10, lineHeight: 1.5 }}>
            Demuestra el LOOP COMPLETO: feedback de analistas → reentreno on-demand sin redeploy → el siguiente <span className="mono">/anomalias-novedosas</span> usa el nuevo .pkl.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ANOMALIAS NOVEDOSAS — patrones nuevos via IsolationForest
   ============================================================ */
export function AnomaliasScreen({ onInvestigate }: any) {
  const API = (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL) || "http://localhost:8000";
  const [data, setData] = useSc<any>(null);
  const [contamination, setContamination] = useSc(0.02);
  const [loading, setLoading] = useSc(true);
  // Explicaciones GPT por id (cache local)
  const [explicaciones, setExplicaciones] = useSc<Record<string, any>>({});
  const [explicando, setExplicando] = useSc<Record<string, boolean>>({});

  async function pedirExplicacion(id: string) {
    if (explicaciones[id]) return; // ya la tenemos
    setExplicando((m) => ({ ...m, [id]: true }));
    try {
      const r = await fetch(`${API}/anomalias-novedosas/${encodeURIComponent(id)}/explicar`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setExplicaciones((m) => ({ ...m, [id]: d }));
    } catch (e: any) {
      setExplicaciones((m) => ({ ...m, [id]: { explicacion_condor: `⚠ ${e?.message || e}` } }));
    } finally {
      setExplicando((m) => ({ ...m, [id]: false }));
    }
  }

  useScE(() => {
    setLoading(true);
    fetch(`${API}/anomalias-novedosas?limit=20&contamination=${contamination}`)
      .then(r => r.json()).then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [contamination]);

  return (
    <div style={{ height: "100%", overflow: "auto", background: "var(--marfil)" }}>
      <div style={{
        padding: "20px 32px", borderBottom: "1px solid var(--line)",
        background: "linear-gradient(180deg, rgba(44,95,141,0.08), transparent)",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <Condor size={32} mood="alert" tone="wing" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, letterSpacing: ".18em", color: "var(--mountain-blue)", fontWeight: 700, textTransform: "uppercase" }}>
            Patrones nuevos · IsolationForest no supervisado
          </div>
          <h2 style={{ fontSize: 22, marginTop: 2 }}>Casos anómalos que las reglas NO ven</h2>
          <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>
            Detecta siniestros estadísticamente raros en múltiples dimensiones a la vez, sin depender de las alertas históricas ni de las 7 reglas críticas. Sirve para descubrir <strong>patrones emergentes</strong> que el modelo supervisado no fue entrenado a reconocer.
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>Sensibilidad (contamination)</div>
          <select
            value={contamination}
            onChange={(e) => setContamination(+e.target.value)}
            style={{ padding: "6px 10px", border: "1px solid var(--line-strong)", borderRadius: 6, marginTop: 4 }}
          >
            <option value={0.01}>1% (sólo los más raros)</option>
            <option value={0.02}>2% (recomendado)</option>
            <option value={0.05}>5%</option>
            <option value={0.10}>10% (más amplio)</option>
          </select>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <Condor size={56} mood="think" tone="wing" />
            <div style={{ marginTop: 10, fontSize: 13, color: "var(--ink-mute)" }}>
              Entrenando IsolationForest sobre 25K siniestros…
            </div>
          </div>
        )}

        {!loading && data && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
              <MiniKpi label="Casos atípicos detectados" value={data.total} tone="orange"/>
              <MiniKpi label="Patrones nuevos (sin alerta previa)" value={data.novedosos} tone="red"/>
              <MiniKpi label="Modelo" value={data.model} />
              <MiniKpi label="Sensibilidad" value={`${(data.contamination*100).toFixed(0)}%`} />
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div className="diamond-divider" style={{ marginBottom: 12 }}>Top {data.items.length} casos anómalos</div>
              <div style={{ display: "grid", gap: 6 }}>
                {data.items.map((it: any) => {
                  const exp = explicaciones[it.id_siniestro];
                  const isExp = explicando[it.id_siniestro];
                  return (
                  <div key={it.id_siniestro} style={{
                    background: "var(--marfil-paper)", borderRadius: 8,
                    borderLeft: it.novedoso ? "3px solid var(--guayaba-red)" : it.caso_inyectado ? "3px solid var(--andes-orange)" : "3px solid var(--paramo-green)",
                  }}>
                    <div style={{
                      display: "grid", gridTemplateColumns: "100px 80px 1fr 100px 110px auto auto",
                      gap: 10, alignItems: "center", padding: "10px 12px",
                    }}>
                      <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--mountain-blue)" }}>{it.id_siniestro}</span>
                      <span className="tabular mono chip blue" style={{ fontSize: 10 }}>score {it.anomaly_score}</span>
                      <div style={{ fontSize: 11 }}>
                        <div style={{ fontWeight: 500 }}>{it.cobertura} · {it.ciudad}</div>
                        <div style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>
                          {it.razones?.slice(0, 2).join(" · ")}
                        </div>
                      </div>
                      <span className="tabular mono" style={{ fontSize: 11 }}>${(it.monto_reclamado_usd||0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {it.novedoso && <span className="chip red" style={{ fontSize: 9 }}>✨ patrón nuevo</span>}
                        {it.etiqueta_fraude_simulada > 0 && (
                          <span className="chip amber" style={{ fontSize: 9 }} title="Marcado históricamente. No es acusación.">
                            🚩 alerta
                          </span>
                        )}
                        {it.caso_inyectado && (
                          <span className="chip" style={{ fontSize: 9 }} title="Caso sintético de auditoría">
                            auditoría
                          </span>
                        )}
                      </div>
                      <button
                        className="chip outline"
                        style={{ fontSize: 10, cursor: "pointer" }}
                        disabled={isExp}
                        onClick={() => pedirExplicacion(it.id_siniestro)}
                      >
                        {isExp ? "🦅 pensando…" : exp ? "🦅 explicación ↑" : "🦅 que me explique"}
                      </button>
                      <button className="chip outline" style={{ fontSize: 10, cursor: "pointer" }} onClick={() => onInvestigate(it.id_siniestro)}>🔍 ver</button>
                    </div>
                    {exp && (
                      <div style={{
                        padding: "12px 16px 14px", margin: "0 12px 12px",
                        background: "linear-gradient(180deg, rgba(232,122,79,0.06), rgba(232,122,79,0.02))",
                        border: "1px solid rgba(232,122,79,0.25)", borderRadius: 8,
                        fontSize: 12.5, lineHeight: 1.65, color: "var(--condor-wing)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                          <Condor size={18} mood="speak" tone="orange" />
                          <span style={{ fontSize: 10.5, color: "var(--andes-orange)", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>
                            Cóndor (GPT-5-mini)
                          </span>
                        </div>
                        {/* Renderizado simple de markdown: **negrita**, lineas y bullets */}
                        {(exp.explicacion_condor || "").split(/\n+/).map((linea: string, i: number) => {
                          const trimmed = linea.trim();
                          if (!trimmed) return null;
                          if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
                            return (
                              <div key={i} style={{ marginLeft: 14, fontSize: 12, color: "var(--ink-soft)" }}>
                                → {renderInlineBold(trimmed.replace(/^[-•]\s/, ""))}
                              </div>
                            );
                          }
                          return (
                            <div key={i} style={{ marginTop: i === 0 ? 0 : 6 }}>
                              {renderInlineBold(trimmed)}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 14, padding: 10, background: "rgba(44,95,141,0.08)", borderRadius: 8, fontSize: 11, borderLeft: "3px solid var(--mountain-blue)" }}>
                💡 <strong>Cómo leerlo:</strong> Los casos marcados <span className="chip red" style={{ fontSize: 9 }}>✨ patrón nuevo</span> son los más interesantes: el algoritmo los considera estadísticamente raros, PERO no tienen alerta histórica ni fueron casos de auditoría. Pueden ser falsos positivos o patrones genuinamente nuevos que el modelo supervisado no ve. <strong>No son acusación de fraude</strong> — son sugerencias de revisión humana prioritaria.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const ROLE_PROMPTS_PREVIEW = {
  antifraude: ["¿Qué patrones se repiten en los rojos?", "Investigar SIN-100029"],
  siniestros: ["¿Cuáles 5 casos resuelvo hoy?", "Resumime mi cola"],
  jefatura: ["¿Qué sucursal tiene más pendientes?", "Productividad de María este mes"],
  riesgos: ["Exposición total a PRV-NEW0019", "Simular bloqueo de top 5"],
  auditoria: ["Casos cerrados con RF-03 en marzo", "Reporte SBS Q1"],
  tecnologia: ["¿Hay endpoint con latencia alta?", "Comparar v3 vs v4"],
  gerencia: ["¿Cuánto recuperamos este mes?", "Top 3 logros para el board"],
};

