'use client';
import { useEffect, useRef, useState } from 'react';
import { api, type ChatMessage } from '@/lib/api';

const SUGERENCIAS = [
  '¿Cuáles son los 10 siniestros con mayor riesgo de posible fraude?',
  '¿Qué proveedores concentran más alertas?',
  '¿Qué ciudades presentan mayor concentración de alertas?',
  '¿Qué patrones se repiten en los reclamos sospechosos?',
  'Genera un resumen ejecutivo de los casos críticos.',
  'Recomienda qué casos debería revisar primero el analista.',
];

export default function ChatPage() {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastTools, setLastTools] = useState<string[]>([]);
  const [lastTokens, setLastTokens] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  async function send(msg?: string) {
    const message = (msg ?? input).trim();
    if (!message || loading) return;
    setInput('');
    const newHist: ChatMessage[] = [...history, { role: 'user', content: message }];
    setHistory(newHist);
    setLoading(true);
    try {
      const r = await api.chat(message, history);
      setHistory((h) => [...h, { role: 'assistant', content: r.response }]);
      setLastTools(r.tools_used.map((t) => t.tool));
      setLastTokens(r.tokens);
    } catch (e: any) {
      setHistory((h) => [...h, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 h-[calc(100vh-160px)]">
      <div className="flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50">
          <div className="font-semibold">Agente AchachAI</div>
          <div className="text-xs text-gray-500">Azure OpenAI · gpt-5-mini · function calling sobre las 7 tablas</div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {history.length === 0 && !loading && (
            <div className="text-center text-gray-500 py-12">
              <div className="text-4xl mb-4">💬</div>
              <p>Hazme una pregunta sobre los siniestros de la cartera.</p>
              <p className="text-xs mt-2">Probá una sugerencia abajo →</p>
            </div>
          )}
          {history.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap break-words">
                  {m.content}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2 text-sm">
                <span className="inline-flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </span>
                <span className="ml-2 text-gray-500 text-xs">Consultando tools…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="border-t p-3 flex gap-2 bg-gray-50"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Preguntá al agente…"
            disabled={loading}
            className="flex-1 px-3 py-2 border rounded-md text-sm bg-white"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium disabled:opacity-40"
          >
            Enviar
          </button>
        </form>
      </div>

      <aside className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-3">Preguntas sugeridas</h3>
          <div className="space-y-2">
            {SUGERENCIAS.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s)}
                disabled={loading}
                className="block w-full text-left text-xs p-2 rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {lastTools.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-xs">
            <div className="font-semibold mb-2">Última consulta</div>
            <div className="text-gray-500">Tools usados:</div>
            <ul className="list-disc list-inside mt-1">
              {lastTools.map((t, i) => <li key={i} className="font-mono text-[11px]">{t}</li>)}
            </ul>
            <div className="mt-2 text-gray-500">Tokens: <span className="font-mono">{lastTokens}</span></div>
          </div>
        )}
      </aside>
    </div>
  );
}
