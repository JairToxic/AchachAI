/* global React, ReactDOM,
   Condor, VueloDelCondor, CondorBubble, LearningBar,
   ChatScreen, InvestigationScreen,
   KanbanScreen, DocumentsScreen, TejidoScreen, ReportsScreen, RolesScreen, ROLES,
   RoleHome,
   useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSlider, TweakToggle, TweakSelect */
const { useState, useEffect } = React;

/* ============================================================
   SIDEBAR
   ============================================================ */
const NAV = [
  { id: "home",      label: "Mi vista",          glyph: "✦", hint: "rol" },
  { id: "chat",      label: "Cóndor agéntico",   glyph: "▲", hint: "CU-05" },
  { id: "kanban",    label: "Bandeja",            glyph: "❒", hint: "CU-03" },
  { id: "documents", label: "Documentos",         glyph: "✎", hint: "CU-01" },
  { id: "tejido",    label: "Tejido del fraude",  glyph: "◇", hint: "Red" },
  { id: "reports",   label: "Reportes",           glyph: "▦", hint: "CU-06" },
  { id: "roles",     label: "Cambiar de rol",     glyph: "⇄", hint: "7 vistas" },
];

function Sidebar({ active, onNav, role }) {
  const r = ROLES.find(x => x.id === role) || ROLES[0];
  return (
    <aside style={{
      width: 220, background: "var(--condor-wing)", color: "var(--marfil)",
      display: "flex", flexDirection: "column", padding: "18px 14px", gap: 18,
    }}>
      {/* logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
        <div style={{
          width: 42, height: 42, borderRadius: 11, background: "var(--marfil)",
          display: "grid", placeItems: "center",
        }}>
          <Condor size={30} tone="wing" mood="idle"/>
        </div>
        <div>
          <div className="serif" style={{ fontSize: 19, fontWeight: 600, lineHeight: 1 }}>
            Achach<span style={{ color: "var(--andes-orange)" }}>AI</span>
          </div>
          <div style={{ fontSize: 9.5, letterSpacing: ".14em", color: "rgba(244,237,228,0.55)", marginTop: 3 }}>
            OJOS DE CÓNDOR
          </div>
        </div>
      </div>

      {/* role chip */}
      <div
        onClick={() => onNav("roles")}
        style={{
          padding: "10px 12px", borderRadius: 10,
          background: "rgba(244,237,228,0.06)", cursor: "pointer",
          borderLeft: `3px solid ${r.color}`,
        }}>
        <div style={{ fontSize: 9.5, color: "rgba(244,237,228,0.55)", letterSpacing: ".1em", textTransform: "uppercase" }}>Sesión activa</div>
        <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
          <span>{r.icon}</span> María Yánez
        </div>
        <div style={{ fontSize: 10.5, color: "rgba(244,237,228,0.6)", marginTop: 1 }}>{r.name}</div>
        <div style={{ fontSize: 9.5, color: "rgba(244,237,228,0.4)", marginTop: 4 }}>cambiar de rol →</div>
      </div>

      {/* nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {NAV.map(n => {
          const isActive = active === n.id || (active === "investigation" && n.id === "kanban");
          return (
            <button key={n.id} onClick={() => onNav(n.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 8,
                background: isActive ? "rgba(244,237,228,0.10)" : "transparent",
                color: isActive ? "var(--marfil)" : "rgba(244,237,228,0.78)",
                border: 0, cursor: "pointer", fontSize: 13, fontWeight: 500,
                textAlign: "left", width: "100%",
                borderLeft: isActive ? "2px solid var(--andes-orange)" : "2px solid transparent",
              }}>
              <span style={{ width: 16, fontSize: 13, color: isActive ? "var(--andes-orange)" : "rgba(244,237,228,0.45)" }}>{n.glyph}</span>
              <span style={{ flex: 1 }}>{n.label}</span>
              <span style={{ fontSize: 9, color: "rgba(244,237,228,0.35)", letterSpacing: ".1em" }}>{n.hint}</span>
            </button>
          );
        })}
      </nav>

      {/* footer */}
      <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(244,237,228,0.04)", fontSize: 10.5, color: "rgba(244,237,228,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--paramo-green)" }}/>
          Azure ML · v4.2.1 · sano
        </div>
        <div>25.460 siniestros · AUC 0.96</div>
      </div>
    </aside>
  );
}

/* ============================================================
   APP
   ============================================================ */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "role": "antifraude",
  "showLearningBar": true,
  "showBubble": true
}/*EDITMODE-END*/;

function App() {
  const [screen, setScreen] = useState("home");
  const [caseId, setCaseId] = useState("SIN-100029");
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  function go(name) {
    setScreen(name);
  }

  function pickRole(r) {
    setTweak("role", r);
    setScreen("home"); // jump to that role's dedicated home
  }

  function investigate(id) {
    setCaseId(id || "SIN-100029");
    setScreen("investigation");
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", height: "100vh" }}>
      <Sidebar active={screen} onNav={go} role={t.role}/>

      <main style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
        {t.showLearningBar && <LearningBar/>}

        <div style={{ flex: 1, minHeight: 0 }}>
          {screen === "home"           && <RoleHome role={t.role} onInvestigate={investigate} onGoChat={() => setScreen("chat")}/>}
          {screen === "chat"           && <ChatScreen role={t.role} onInvestigate={investigate}/>}
          {screen === "investigation"  && <InvestigationScreen caseId={caseId} onBack={() => setScreen("kanban")}/>}
          {screen === "kanban"         && <KanbanScreen onInvestigate={investigate}/>}
          {screen === "documents"      && <DocumentsScreen/>}
          {screen === "tejido"         && <TejidoScreen/>}
          {screen === "reports"        && <ReportsScreen/>}
          {screen === "roles"          && <RolesScreen currentRole={t.role} onPick={pickRole}/>}
        </div>
      </main>

      {t.showBubble && (
        <CondorBubble
          onOpen={() => setScreen("chat")}
          mood={screen === "investigation" || screen === "kanban" ? "alert" : "idle"}
          message={screen === "home" ? "Hola María. Sobrevolé tu cartera. Hay 12 casos en rojo nuevos." : null}
        />
      )}

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks · AchachAI">
        <TweakSection title="Rol activo (cambia el home)">
          <TweakSelect label="Vista personalizada"
            value={t.role}
            options={ROLES.map(r => ({ value: r.id, label: `${r.icon}  ${r.name}` }))}
            onChange={v => { setTweak("role", v); setScreen("home"); }}/>
        </TweakSection>
        <TweakSection title="Interfaz">
          <TweakToggle label="Barra de auto-aprendizaje" value={t.showLearningBar} onChange={v => setTweak("showLearningBar", v)}/>
          <TweakToggle label="Burbuja del cóndor" value={t.showBubble} onChange={v => setTweak("showBubble", v)}/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
