import React, { useMemo, useRef, useState } from 'react';
import './AssistantWidget.css';
import { askAssistant, type AssistantScope } from '../api/assistant';
import { useRole } from '../hooks/useRole';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Msg = { id: string; from: 'me' | 'bot'; text: string };

const AssistantWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [scope, setScope] = useState<AssistantScope>('mixed');
  const inputRef = useRef<HTMLInputElement>(null);
  const { role } = useRole();

  const roleLabel = useMemo(() => (role === 'gm' ? 'ГМ' : 'Игрок'), [role]);

  const send = async () => {
    const q = inputRef.current?.value?.trim();
    if (!q) return;
    if (inputRef.current) inputRef.current.value = '';
    const mid = `${Date.now()}`;
    setMessages((m) => [...m, { id: mid, from: 'me', text: q }]);
    setPending(true);
    try {
      // Slash command: /name type=character style=эльф count=10
      const lower = q.toLowerCase();
      const isNameCmd = lower.startsWith('/name') || lower.startsWith('/имя') || lower.startsWith('/название');
      let res;
      if (isNameCmd) {
        const params: Record<string, string> = {};
        q.split(/\s+/).slice(1).forEach((pair) => {
          const [k, ...rest] = pair.split('=');
          if (!k) return;
          params[k.trim()] = rest.join('=');
        });
        res = await askAssistant({
          question: q,
          role: role === 'gm' ? 'gm' : 'player',
          scope,
          generator: { kind: 'name', params: {
            type: params.type || params.тип,
            style: params.style || params.стиль,
            count: params.count ? Number(params.count) : undefined,
            language: params.lang || params.язык || 'ru',
            startsWith: params.startsWith || params.начинается,
            endsWith: params.endsWith || params.заканчивается,
          }},
        });
      } else {
        res = await askAssistant({ question: q, role: role === 'gm' ? 'gm' : 'player', scope });
      }
      const cite = res.citations?.slice(0, 6).map((c) => `- ${c.type === 'skill' ? 'Навык' : 'Лор'}: ${c.title}`).join('\n');
      const full = cite ? `${res.answer}\n\n**Ссылки:**\n${cite}` : res.answer;
      setMessages((m) => [...m, { id: mid + '-r', from: 'bot', text: full }]);
    } catch (e: any) {
      setMessages((m) => [...m, { id: mid + '-e', from: 'bot', text: `Ошибка ассистента: ${e?.message || e}` }]);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="aiw-root" aria-live="polite">
      {open && (
        <section className="aiw-panel" role="dialog" aria-label="AI помощник">
          <header className="aiw-header">
            <i className="fa-regular fa-gem" aria-hidden />
            <strong>AI Помощник</strong>
            <span className="aiw-meta">Роль: {roleLabel}</span>
            <div className="aiw-scope">
              <label htmlFor="aiw-scope">Контекст:</label>
              <select id="aiw-scope" value={scope} onChange={(e) => setScope(e.target.value as AssistantScope)}>
                <option value="mixed">Смешанный</option>
                <option value="skills">Навыки</option>
                <option value="lore">Лор</option>
              </select>
            </div>
            <button className="aiw-meta" onClick={() => setOpen(false)} title="Свернуть">×</button>
          </header>
          <div className="aiw-body">
            {messages.map((m) => (
              <div key={m.id} className={`aiw-msg ${m.from}`}>
                {m.from === 'bot' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} className="aiw-md">
                    {m.text}
                  </ReactMarkdown>
                ) : (
                  m.text
                )}
              </div>
            ))}
            {pending && <div className="aiw-msg bot">Думаю…</div>}
          </div>
          <footer className="aiw-footer">
            <input
              ref={inputRef}
              className="aiw-input"
              type="text"
              placeholder="Спросите про навыки, правила или лор…"
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            />
            <button className="aiw-send" onClick={send} disabled={pending}><i className="fa-solid fa-paper-plane" /></button>
          </footer>
        </section>
      )}
      <button className="aiw-button" onClick={() => setOpen((v) => !v)} aria-label="Открыть AI помощника">
        <i className="fa-solid fa-robot" />
      </button>
    </div>
  );
};

export default AssistantWidget;
