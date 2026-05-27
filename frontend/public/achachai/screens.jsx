/* global React, Condor, VueloDelCondor */
const { useState: useSc, useEffect: useScE, useRef: useScR } = React;

/* ============================================================
   KANBAN — Bandeja de casos (CU-03)
   ============================================================ */

const KANBAN_DATA = {
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

function KanbanScreen({ onInvestigate }) {
  const [liveData, setLiveData] = useSc(KANBAN_DATA);
  const [loading, setLoading] = useSc(true);
  const API = (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL) || "http://localhost:8000";

  useScE(() => {
    fetch(`${API}/top-riesgo?limit=30`)
      .then(r => r.json())
      .then(data => {
        const buckets = { rojo: [], amarillo: [], verde: [] };
        for (const c of data.top || []) {
          const key = c.nivel === "ROJO" ? "rojo" : c.nivel === "AMARILLO" ? "amarillo" : "verde";
          if (buckets[key].length < 6) {
            buckets[key].push({
              id: c.id_siniestro,
              score: c.score,
              monto: `$${c.monto_reclamado_usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
              ciudad: c.ciudad || "—",
              cobertura: c.cobertura,
              reglas: c.reglas_disparadas || [],
              prov: "—",
            });
          }
        }
        // Si alguna columna queda vacia, pedimos algun caso del backend para llenarla
        if (buckets.verde.length === 0) {
          fetch(`${API}/casos?limit=3`).then(r => r.json()).then(d => {
            buckets.verde = (d.items || []).slice(0, 3).map(s => ({
              id: s.id_siniestro, score: 18,
              monto: `$${(s.monto_reclamado_usd || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
              ciudad: s.ciudad_evento, cobertura: s.cobertura, reglas: [], prov: "—",
            }));
            setLiveData(buckets);
            setLoading(false);
          });
        } else {
          setLiveData(buckets);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--marfil)" }}>
      {/* header */}
      <div style={{ padding: "20px 32px 16px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Condor size={28} mood="speak" tone="orange" />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 22 }}>Bandeja priorizada {loading && <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>· cargando del backend…</span>}</h2>
            <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              {liveData.rojo[0] ? <>El cóndor te recomienda empezar por <span className="mono" style={{ color: "var(--guayaba-red)", fontWeight: 600 }}>{liveData.rojo[0].id}</span> · score {liveData.rojo[0].score}</> : "Evaluando casos…"}
            </div>
          </div>
          {/* filters */}
          <div style={{ display: "flex", gap: 6 }}>
            <select className="chip outline" style={{ padding: "6px 10px", border: "1px solid var(--line-strong)" }}>
              <option>Todas las ciudades</option><option>Quito</option><option>Guayaquil</option>
            </select>
            <select className="chip outline" style={{ padding: "6px 10px", border: "1px solid var(--line-strong)" }}>
              <option>Toda cobertura</option><option>DM total</option><option>DM parcial</option><option>RC</option>
            </select>
            <select className="chip outline" style={{ padding: "6px 10px", border: "1px solid var(--line-strong)" }}>
              <option>Cualquier monto</option><option>&gt; $5K</option><option>&gt; $10K</option>
            </select>
            <button className="btn ghost" style={{ fontSize: 12 }}>Exportar bandeja</button>
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
function DocumentsScreen() {
  const [scanning, setScanning] = useSc(false);
  const [done, setDone] = useSc(false);
  const [result, setResult] = useSc(null);
  const [error, setError] = useSc(null);
  const [fileName, setFileName] = useSc("");
  const fileInputRef = useScR(null);
  const API = (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL) || "http://localhost:8000";

  function trigger() {
    if (fileInputRef.current) fileInputRef.current.click();
  }

  async function handleUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setScanning(true); setDone(false); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Heuristica simple para tipo
      const tipo = /factura/i.test(file.name) ? "factura"
                 : /foto|imag|jpg|jpeg|png/i.test(file.name) ? "imagen_dano"
                 : "factura";
      fd.append("tipo", tipo);
      fd.append("fecha_ocurrencia", "2024-08-15");
      if (tipo === "imagen_dano") {
        fd.append("descripcion_siniestro", "Choque trasero mientras estaba detenido");
      }
      const resp = await fetch(`${API}/analyze-document`, { method: "POST", body: fd });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setResult(data);
    } catch (err) {
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

const TEJIDO_PROVIDERS = [
  { id: "PRV-NEW0019", x: 360, y: 220, r: 26, hot: true,  label: "Auto Servicio Andes" },
  { id: "PRV-0007",    x: 720, y: 290, r: 22, hot: true,  label: "Taller Cumbayá" },
  { id: "PRV-0042",    x: 240, y: 430, r: 20, hot: true,  label: "Clínica San Rafael" },
  { id: "PRV-0019",    x: 820, y: 460, r: 18, hot: false, label: "Multipartes Guayas" },
  { id: "PRV-0103",    x: 540, y: 480, r: 16, hot: false, label: "Repuestos del Valle" },
  { id: "PRV-0011",    x: 940, y: 170, r: 14, hot: false, label: "Carrocerías Norte" },
];

const TEJIDO_INSUREDS = (() => {
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
const CONDOR_FLIGHT_PATH = "M 60 80 Q 280 40 540 160 T 1020 240 Q 700 360 360 220 Q 220 380 240 430";

const TEJIDO_PHASES = [
  { id: 0, label: "Listo para investigar" },
  { id: 1, label: "Escaneando red…" },
  { id: 2, label: "Conectando hilos…" },
  { id: 3, label: "Detectando concentración…" },
  { id: 4, label: "Cruzando proveedores…" },
  { id: 5, label: "Patrón detectado ✓" },
];

function TejidoScreen() {
  const [phase, setPhase] = useSc(0);
  const [running, setRunning] = useSc(false);
  const timeoutsRef = useScR([]);

  function clearTimers() {
    timeoutsRef.current.forEach(t => clearTimeout(t));
    timeoutsRef.current = [];
  }

  function play() {
    clearTimers();
    setPhase(0); setRunning(true);
    const steps = [
      [200,  1],   // start scan
      [2400, 2],   // edges light up
      [4400, 3],   // hot nodes pulse
      [5800, 4],   // cluster trace
      [7200, 5],   // pattern detected
      [7800, null],// stop running flag
    ];
    steps.forEach(([t, p]) => {
      const id = setTimeout(() => {
        if (p === null) setRunning(false);
        else setPhase(p);
      }, t);
      timeoutsRef.current.push(id);
    });
  }

  useScE(() => {
    // auto-play on mount
    play();
    return clearTimers;
  }, []);

  const currentPhase = TEJIDO_PHASES.find(p => p.id === phase);

  return (
    <div style={{ height: "100%", overflow: "hidden", background: "var(--marfil)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 32px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 14 }}>
        <Condor size={28} mood={running ? "think" : "speak"} tone="wing" />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 22 }}>Tejido del Fraude</h2>
          <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
            Hilos sueltos no dicen nada. Tejidos juntos revelan el patrón.
            <span style={{ marginLeft: 8 }}>198 proveedores · 25.460 asegurados · 12 clusters detectados</span>
          </div>
        </div>
        <button className="btn warm" onClick={play} disabled={running} style={{ minWidth: 200 }}>
          {running ? `🦅 ${currentPhase.label}` : "▶ Descubrir patrón"}
        </button>
      </div>

      {/* phase progress strip */}
      <div style={{ padding: "10px 32px", borderBottom: "1px solid var(--line)", background: "var(--marfil-paper)", display: "flex", alignItems: "center", gap: 6 }}>
        {TEJIDO_PHASES.slice(1).map(p => (
          <div key={p.id} style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              background: phase >= p.id ? (p.id === 5 ? "var(--paramo-green)" : "var(--andes-orange)") : "var(--line)",
              color: "white", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700,
              transition: "background 0.3s ease",
            }}>{phase > p.id ? "✓" : p.id}</div>
            <div style={{ fontSize: 10.5, color: phase >= p.id ? "var(--condor-wing)" : "var(--ink-mute)", fontWeight: phase === p.id ? 600 : 400, flex: 1 }}>
              {p.label}
            </div>
            {p.id < 5 && <div style={{ flex: 1, height: 1, background: phase > p.id ? "var(--andes-orange)" : "var(--line)", transition: "background 0.3s ease" }}/>}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 280px", minHeight: 0 }}>
        <div style={{ position: "relative", overflow: "hidden", background: "var(--marfil-paper)" }}>
          <TejidoCanvas phase={phase} />
        </div>
        <aside style={{ borderLeft: "1px solid var(--line)", padding: "18px 16px", overflow: "auto" }}>
          <div className="diamond-divider" style={{ marginBottom: 12 }}>Clusters críticos</div>
          {[
            { id: "PRV-NEW0019", n: 8, exp: "$156K", level: "red" },
            { id: "PRV-0007", n: 6, exp: "$132K", level: "red" },
            { id: "PRV-0042", n: 5, exp: "$98K", level: "amber" },
            { id: "PRV-0019", n: 4, exp: "$76K", level: "amber" },
            { id: "PRV-0103", n: 3, exp: "$54K", level: "amber" },
          ].map((c, i) => (
            <div key={c.id} className="fade-up" style={{
              padding: "10px 12px", marginBottom: 8, borderRadius: 10,
              background: phase >= 3 && c.level === "red" ? "rgba(197,51,58,0.08)" : "white",
              border: `1px solid ${phase >= 3 && c.level === "red" ? "rgba(197,51,58,0.30)" : "var(--line)"}`,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
              opacity: phase >= 2 ? 1 : 0.35,
              transition: "all 0.4s ease",
              animationDelay: `${i * 100}ms`,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: "50%",
                background: c.level === "red" ? "var(--guayaba-red)" : "var(--andes-ocher)",
                animation: phase >= 3 && c.level === "red" ? "pulse-red 1.2s infinite" : "none",
              }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 11.5, fontWeight: 600 }}>{c.id}</div>
                <div style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>{c.n} casos · {c.exp}</div>
              </div>
              <span style={{ color: "var(--ink-mute)" }}>›</span>
            </div>
          ))}

          <div className="diamond-divider" style={{ margin: "18px 0 10px" }}>El cóndor sugiere</div>
          {phase >= 5 ? (
            <div className="fade-up" style={{
              padding: 12, background: "rgba(197,51,58,0.10)", borderRadius: 10,
              fontSize: 12, lineHeight: 1.5, borderLeft: "3px solid var(--guayaba-red)",
            }}>
              <Condor size={14} tone="red" mood="still" /> "Encontré algo. <strong>3 proveedores</strong>
              comparten <strong>5 asegurados</strong>. No es coincidencia — es un cluster organizado.
              Exposición combinada: <strong>$386K USD</strong>."
              <button className="btn danger" style={{ marginTop: 10, fontSize: 11, padding: "6px 10px" }}>Generar reporte forense</button>
            </div>
          ) : (
            <div style={{
              padding: 12, background: "rgba(232,122,79,0.06)", borderRadius: 10,
              fontSize: 12, lineHeight: 1.5, borderLeft: "3px solid var(--andes-orange)",
              color: "var(--ink-mute)",
            }}>
              {running ? "El cóndor está investigando…" : "Tocá ▶ para que el cóndor descubra el patrón."}
            </div>
          )}
        </aside>
      </div>
    </div>
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
function ReportsScreen() {
  return (
    <div style={{ height: "100%", overflow: "auto", background: "var(--marfil)", padding: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <Condor size={28} mood="speak" tone="wing" />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 22 }}>Reportes generados</h2>
          <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
            "Te preparé el reporte mensual. 47 páginas. Listo para enviar." — Cóndor, 09:24
          </div>
        </div>
        <button className="btn">+ Nuevo reporte</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        {[
          { name: "Comité Antifraude", cadence: "Semanal", date: "Lun 27-May", n: 12, accent: "var(--guayaba-red)" },
          { name: "Auditoría SBS", cadence: "Regulatorio Q1", date: "31-Mar", n: 47, accent: "var(--mountain-blue)" },
          { name: "Directorio", cadence: "Mensual ejecutivo", date: "Mayo 2026", n: 8, accent: "var(--andes-orange)" },
        ].map((r, i) => (
          <div key={i} className="card" style={{ padding: 16, borderTop: `3px solid ${r.accent}` }}>
            <div style={{ fontSize: 10.5, color: "var(--ink-mute)", letterSpacing: ".1em", textTransform: "uppercase" }}>{r.cadence}</div>
            <div style={{ fontSize: 17, fontFamily: "var(--serif)", marginTop: 4 }}>{r.name}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 6 }}>
              Última generación: <span className="mono">{r.date}</span> · {r.n} casos cubiertos
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <button className="btn ghost" style={{ fontSize: 11 }}>Vista previa</button>
              <button className="btn" style={{ fontSize: 11 }}>⬇ PDF firmado</button>
            </div>
          </div>
        ))}
      </div>

      <div className="diamond-divider" style={{ marginBottom: 12 }}>Vista previa · Comité Antifraude · semana 22</div>

      {/* magazine-style preview */}
      <div className="card" style={{ padding: 0, overflow: "hidden", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ padding: "26px 32px", background: "var(--marfil-paper)", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <div style={{ fontSize: 10.5, color: "var(--andes-orange)", letterSpacing: ".2em", textTransform: "uppercase" }}>AchachAI · Aseguradora del Sur</div>
              <h1 style={{ fontSize: 32, fontFamily: "var(--serif)", fontWeight: 500, marginTop: 4 }}>
                Semana 22 · Resumen ejecutivo
              </h1>
              <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 6 }}>
                Quito · 27 mayo 2026 · firmado digitalmente por agente <span className="mono">gpt-5-mini · v4.2.1</span>
              </div>
            </div>
            <Condor size={48} mood="speak" tone="wing" />
          </div>
        </div>

        <div style={{ padding: "26px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, marginBottom: 22 }}>
            {[
              ["247", "casos esta semana", "wing"],
              ["12", "rojos detectados", "red"],
              ["$486K", "exposición evitada", "green"],
              ["1.4s", "tiempo promedio", "wing"],
            ].map(([v, l, t], i) => (
              <div key={i}>
                <div className="serif tabular" style={{ fontSize: 28, fontWeight: 500, color: t === "red" ? "var(--guayaba-red)" : t === "green" ? "var(--paramo-green)" : "var(--condor-wing)", lineHeight: 1 }}>{v}</div>
                <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 4, letterSpacing: ".06em", textTransform: "uppercase" }}>{l}</div>
              </div>
            ))}
          </div>

          <div className="diamond-divider" style={{ marginBottom: 14 }}>Casos de mayor riesgo</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--condor-wing)" }}>
                {["Caso", "Score", "Monto", "Proveedor", "Recomendación"].map(h => (
                  <th key={h} style={{ padding: "8px 6px", textAlign: "left", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-mute)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {KANBAN_DATA.rojo.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td className="mono" style={{ padding: "10px 6px", color: "var(--mountain-blue)", fontWeight: 600 }}>{r.id}</td>
                  <td style={{ padding: "10px 6px" }}><VueloDelCondor score={r.score} variant="sm"/></td>
                  <td className="tabular mono" style={{ padding: "10px 6px" }}>{r.monto}</td>
                  <td className="mono" style={{ padding: "10px 6px", fontSize: 11 }}>{r.prov}</td>
                  <td style={{ padding: "10px 6px", fontSize: 11.5 }}>Bloquear pago + investigar</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{
            marginTop: 22, padding: 14, background: "var(--marfil-paper)",
            borderRadius: 10, borderLeft: "3px solid var(--andes-orange)",
            fontSize: 12.5, lineHeight: 1.55,
          }}>
            <div style={{ fontSize: 10.5, color: "var(--andes-orange)", fontWeight: 700, letterSpacing: ".12em", marginBottom: 6 }}>
              SÍNTESIS DEL CÓNDOR
            </div>
            La cartera muestra un patrón claro de concentración en el proveedor <span className="mono">PRV-NEW0019</span>,
            que aparece en 8 de los 12 casos rojos. Se recomienda al comité considerar la suspensión preventiva
            de pagos a este proveedor hasta completar la investigación cruzada con los 5 asegurados vinculados.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ROLES — 7 roles selector
   ============================================================ */
const ROLES = [
  { id: "antifraude", name: "Analista Antifraude", icon: "🕵️", power: "Investigación profunda caso por caso", color: "var(--guayaba-red)" },
  { id: "siniestros", name: "Analista de Siniestros", icon: "📋", power: "Mi día priorizado en orden", color: "var(--andes-orange)" },
  { id: "jefatura", name: "Jefatura de Siniestros", icon: "📊", power: "Centro de operaciones", color: "var(--mountain-blue)" },
  { id: "riesgos", name: "Riesgos", icon: "⚠️", power: "Mapa de exposición consolidada", color: "var(--andes-ocher)" },
  { id: "auditoria", name: "Auditoría Interna", icon: "🔍", power: "Cadena de evidencia legal", color: "var(--paramo-green)" },
  { id: "tecnologia", name: "Tecnología", icon: "🛠️", power: "Salud del sistema en tiempo real", color: "var(--mountain-blue-deep)" },
  { id: "gerencia", name: "Gerencia", icon: "💼", power: "Pulso ejecutivo cartera", color: "var(--condor-wing)" },
];

function RolesScreen({ currentRole, onPick }) {
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

const ROLE_PROMPTS_PREVIEW = {
  antifraude: ["¿Qué patrones se repiten en los rojos?", "Investigar SIN-100029"],
  siniestros: ["¿Cuáles 5 casos resuelvo hoy?", "Resumime mi cola"],
  jefatura: ["¿Qué sucursal tiene más pendientes?", "Productividad de María este mes"],
  riesgos: ["Exposición total a PRV-NEW0019", "Simular bloqueo de top 5"],
  auditoria: ["Casos cerrados con RF-03 en marzo", "Reporte SBS Q1"],
  tecnologia: ["¿Hay endpoint con latencia alta?", "Comparar v3 vs v4"],
  gerencia: ["¿Cuánto recuperamos este mes?", "Top 3 logros para el board"],
};

Object.assign(window, { KanbanScreen, DocumentsScreen, TejidoScreen, ReportsScreen, RolesScreen, ROLES });
