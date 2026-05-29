'use client';
// @ts-nocheck
/**
 * Modulo de voz tipo Jarvis para el Condor.
 *
 * - STT: Web Speech API con interim results (vas viendo lo que decis en vivo)
 * - TTS: Web Speech API con voz neuronal latina amigable
 * - Overlay grande mientras hablas para que se note
 * - Cero dependencias externas, cero claves
 *
 * Funciona en Chrome / Edge. En Firefox solo TTS.
 */
import { useEffect, useRef, useState } from 'react';
import { FaMicrophone, FaMicrophoneSlash, FaVolumeUp, FaVolumeMute, FaTimes } from 'react-icons/fa';

type Props = {
  onTranscript: (text: string) => void;
  speakText?: string | null;
  disabled?: boolean;
};

// SpeechRecognition (solo Chrome/Edge)
function getRecognition(): any {
  if (typeof window === 'undefined') return null;
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = 'es-MX'; // mas amigable que es-ES para LATAM
  rec.continuous = false;
  rec.interimResults = true;  // CLAVE: muestra lo que va diciendo en vivo
  rec.maxAlternatives = 1;
  return rec;
}

// Elige la mejor voz neuronal latina amigable
function pickFriendlyVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined') return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Score cada voz: queremos neuronal / natural, latina, preferentemente femenina amigable
  const NAMES_PRIORIDAD = [
    // Microsoft Edge / Windows - neurales latinas amigables
    'dalia', 'jenny', 'sara', 'elvira', 'paloma', 'isabela', 'salome',
    // Google Chrome
    'google espa', 'google us',
  ];

  function score(v: SpeechSynthesisVoice): number {
    let s = 0;
    const name = v.name.toLowerCase();
    const lang = v.lang.toLowerCase();
    // Idioma
    if (lang === 'es-mx') s += 100;
    else if (lang === 'es-us') s += 90;
    else if (lang === 'es-co') s += 80;
    else if (lang === 'es-ar') s += 70;
    else if (lang === 'es-es') s += 60;
    else if (lang.startsWith('es')) s += 40;
    else return -1; // descartar no-español
    // Calidad
    if (name.includes('neural') || name.includes('natural')) s += 50;
    if (name.includes('online')) s += 30;
    // Voces específicas amigables
    for (let i = 0; i < NAMES_PRIORIDAD.length; i++) {
      if (name.includes(NAMES_PRIORIDAD[i])) {
        s += 40 - i * 3;
        break;
      }
    }
    // Femenina (usualmente mas calida para asistentes)
    if (name.includes('female') || name.includes('mujer')) s += 10;
    return s;
  }

  const ranked = voices
    .map(v => ({ v, s: score(v) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s);

  return ranked[0]?.v || null;
}

const TTS_PREF_KEY = 'achachai-tts-enabled';

export function VoiceButton({ onTranscript, speakText, disabled }: Props) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [speaking, setSpeaking] = useState(false);
  // TTS apagado por DEFAULT — el usuario lo activa explicitamente con el boton parlante.
  // La preferencia se recuerda en localStorage para no resetear en cada visita.
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [supported, setSupported] = useState({ stt: false, tts: false });
  const [voiceName, setVoiceName] = useState<string>('');
  const recRef = useRef<any>(null);
  const lastSpokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported({
      stt: !!SR,
      tts: !!window.speechSynthesis,
    });
    // Cargar preferencia previa SOLO si el usuario explicitamente la activo antes
    try {
      const saved = localStorage.getItem(TTS_PREF_KEY);
      if (saved === '1') setTtsEnabled(true);
    } catch {}

    // Las voces a veces se cargan async (Chrome)
    function refreshVoice() {
      const v = pickFriendlyVoice();
      if (v) setVoiceName(v.name);
    }
    if (window.speechSynthesis) {
      refreshVoice();
      window.speechSynthesis.onvoiceschanged = refreshVoice;
    }
  }, []);

  // CLEANUP: cuando este componente se desmonta (ej. salir del chat),
  // cancelar cualquier lectura en curso. Y tambien si la tab pierde foco.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cancel = () => {
      try {
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
        }
      } catch {}
      try {
        if (recRef.current) recRef.current.stop();
      } catch {}
    };
    // Si el tab pasa a background (cambio de pestaña, minimizar), cortamos
    const onVisibility = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', onVisibility);
    // Tambien al cerrar/recargar
    window.addEventListener('beforeunload', cancel);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', cancel);
      cancel();
    };
  }, []);

  // Hablar la respuesta del condor
  useEffect(() => {
    if (!ttsEnabled || !speakText || !supported.tts) return;
    if (speakText === lastSpokenRef.current) return;
    lastSpokenRef.current = speakText;

    const clean = speakText
      .replace(/\*\*/g, '')
      .replace(/[#`*_~]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\|/g, ' ')              // tablas markdown
      .replace(/[-=]{3,}/g, ' ')        // separadores
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 700);

    if (!clean) return;

    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(clean);
    const v = pickFriendlyVoice();
    if (v) utt.voice = v;
    utt.lang = v?.lang || 'es-MX';
    utt.rate = 1.0;       // velocidad natural (era 1.05, muy rapido)
    utt.pitch = 1.05;     // un toque mas calido (era 1.0)
    utt.volume = 1.0;
    utt.onstart = () => setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
  }, [speakText, ttsEnabled, supported.tts]);

  function startListening() {
    if (!supported.stt) {
      alert('Tu navegador no soporta reconocimiento de voz. Usá Chrome o Edge.');
      return;
    }
    // Si el condor esta hablando, callalo para escuchar al usuario
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
    const rec = getRecognition();
    if (!rec) return;
    recRef.current = rec;

    rec.onstart = () => {
      setListening(true);
      setInterim('');
    };
    rec.onresult = (ev: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (interimText) setInterim(interimText);
      if (finalText.trim()) {
        setInterim(finalText.trim());
        // Pequeña pausa visual para que el usuario vea lo que dijo antes de enviar
        setTimeout(() => {
          onTranscript(finalText.trim());
          setInterim('');
          setListening(false);
        }, 400);
      }
    };
    rec.onerror = (ev: any) => {
      console.warn('SpeechRecognition error:', ev.error);
      setListening(false);
      setInterim('');
    };
    rec.onend = () => {
      setListening(false);
      // No limpiamos interim aca para que el usuario vea lo ultimo dicho
      setTimeout(() => setInterim(''), 1500);
    };
    rec.start();
  }

  function stopListening() {
    recRef.current?.stop();
    setListening(false);
  }

  function toggleListen() {
    if (listening) stopListening();
    else startListening();
  }

  function toggleTTS() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
    setTtsEnabled(v => {
      const next = !v;
      try { localStorage.setItem(TTS_PREF_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  }

  if (!supported.stt && !supported.tts) return null;

  return (
    <>
      {/* OVERLAY GRANDE mientras escucha — para que se vea claro que el cóndor escucha */}
      {listening && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(15,23,42,0.78)',
            backdropFilter: 'blur(6px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 28, padding: 32,
            animation: 'voice-overlay-in 0.25s ease-out',
          }}
          onClick={stopListening}
        >
          {/* Mic animado grande */}
          <div style={{
            width: 140, height: 140, borderRadius: '50%',
            background: 'linear-gradient(135deg, #e76f51, #d54a30)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 0 0 12px rgba(231,111,81,0.25), 0 0 0 28px rgba(231,111,81,0.15), 0 0 60px rgba(231,111,81,0.5)',
            animation: 'voice-pulse 1.6s ease-in-out infinite',
            position: 'relative',
          }}>
            <FaMicrophone size={56} color="#fff" />
          </div>

          {/* Onda equalizer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 40 }}>
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{
                width: 5, background: '#fff', borderRadius: 3,
                animation: `voice-bar 0.9s ease-in-out infinite`,
                animationDelay: `${i * 0.08}s`,
              }} />
            ))}
          </div>

          {/* Texto interim (lo que va diciendo el usuario) */}
          <div style={{
            color: '#fff', fontSize: 22, fontWeight: 500,
            textAlign: 'center', maxWidth: 720, lineHeight: 1.4,
            minHeight: 32,
          }}>
            {interim
              ? <span>{interim}<span className="cursor-blink">|</span></span>
              : <span style={{ opacity: 0.7, fontSize: 18 }}>Te estoy escuchando…</span>
            }
          </div>

          {/* Hint inferior */}
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12.5, textAlign: 'center' }}>
            Hablá normal · El cóndor envía solo cuando termines de hablar<br/>
            Toca cualquier parte de la pantalla para cancelar
          </div>

          {/* Boton cerrar arriba a la derecha */}
          <button
            onClick={(e) => { e.stopPropagation(); stopListening(); }}
            style={{
              position: 'absolute', top: 24, right: 24,
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer',
            }}
            aria-label="Cancelar"
          >
            <FaTimes size={18} />
          </button>

          <style jsx>{`
            @keyframes voice-overlay-in {
              from { opacity: 0; }
              to   { opacity: 1; }
            }
            @keyframes voice-pulse {
              0%, 100% { transform: scale(1);    }
              50%      { transform: scale(1.06); }
            }
            @keyframes voice-bar {
              0%, 100% { height: 8px;  }
              50%      { height: 36px; }
            }
            .cursor-blink {
              display: inline-block; margin-left: 2px;
              animation: blink 1s steps(2) infinite;
            }
            @keyframes blink { 50% { opacity: 0; } }
          `}</style>
        </div>
      )}

      {/* Botones inline en el chat */}
      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        {supported.stt && (
          <button
            onClick={toggleListen}
            disabled={disabled}
            title={listening ? 'Detener escucha' : 'Hablar con el cóndor'}
            aria-label={listening ? 'Detener escucha' : 'Hablar con el cóndor'}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              border: '2px solid ' + (listening ? '#e76f51' : 'var(--border-color, #d4cdb8)'),
              background: listening
                ? 'linear-gradient(135deg, #e76f51, #d54a30)'
                : 'var(--bg-card, #fff)',
              color: listening ? '#fff' : 'var(--text-primary, #1f1f1f)',
              display: 'grid', placeItems: 'center',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              boxShadow: listening
                ? '0 0 0 8px rgba(231,111,81,0.18), 0 0 24px rgba(231,111,81,0.4)'
                : '0 1px 3px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease',
            }}
          >
            {listening ? <FaMicrophone size={14} /> : <FaMicrophoneSlash size={14} />}
          </button>
        )}

        {supported.tts && (
          <button
            onClick={toggleTTS}
            title={ttsEnabled ? `Silenciar al cóndor (voz: ${voiceName || 'default'})` : 'Activar voz del cóndor'}
            aria-label={ttsEnabled ? 'Silenciar voz' : 'Activar voz'}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              border: '2px solid ' + (speaking ? '#1c5d99' : 'var(--border-color, #d4cdb8)'),
              background: speaking ? '#e6f1fb' : (ttsEnabled ? 'var(--bg-card, #fff)' : '#f0f0ed'),
              color: speaking ? '#1c5d99' : (ttsEnabled ? 'var(--text-primary)' : 'var(--text-secondary)'),
              display: 'grid', placeItems: 'center',
              cursor: 'pointer',
              boxShadow: speaking
                ? '0 0 0 6px rgba(28,93,153,0.15)'
                : '0 1px 3px rgba(0,0,0,0.06)',
              transition: 'all 0.2s ease',
            }}
          >
            {ttsEnabled ? <FaVolumeUp size={14} /> : <FaVolumeMute size={14} />}
          </button>
        )}
      </div>
    </>
  );
}
