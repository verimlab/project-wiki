export type AssistantScope = 'skills' | 'lore' | 'mixed';

export type NameGenParams = {
  type?: string;
  style?: string;
  count?: number;
  language?: string;
  syllables?: { min?: number; max?: number };
  startsWith?: string;
  endsWith?: string;
  avoid?: string[];
};

export type AssistantGenerator = { kind: 'name'; params?: NameGenParams };

export type AssistantRequest = {
  question: string;
  role: 'gm' | 'player';
  scope?: AssistantScope;
  generator?: AssistantGenerator;
};

export type AssistantResponse = {
  answer: string;
  citations: Array<{ id: string; title: string; type: 'skill' | 'lore'; sectionId?: string | null }>;
  usedScope: AssistantScope;
  role: 'gm' | 'player';
  error?: string;
};

export async function askAssistant(req: AssistantRequest): Promise<AssistantResponse> {
  const base = (import.meta as any).env?.VITE_ASSISTANT_API_BASE || '';
  const prefix = base ? String(base).replace(/\/+$/, '') : '';
  const isFnHost = /cloudfunctions\.net|run\.app/i.test(prefix);
  const path = isFnHost ? '/gemini' : '/api/gemini';
  const url = `${prefix}${path}` || path;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: req.question,
      role: req.role,
      scope: req.scope ?? 'mixed',
      generator: req.generator,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Assistant error ${res.status}: ${text}`);
  }
  return (await res.json()) as AssistantResponse;
}
