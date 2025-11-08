import corsLib from 'cors';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Firebase Admin once (modular API)
try {
  if (!getApps().length) {
    initializeApp();
  }
} catch {}

const db = getFirestore();
const cors = corsLib({ origin: true });

// Secret configured via: `firebase functions:secrets:set GEMINI_API_KEY`
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
let genAI = null;

function textOrEmpty(v) {
  return typeof v === 'string' ? v : (v == null ? '' : String(v));
}

function normalize(str = '') {
  return String(str).toLowerCase();
}

function tokenize(str = '') {
  const m = normalize(str).match(/[\p{L}\p{N}]+/gu) || [];
  return Array.from(new Set(m.filter((t) => t.length >= 2)));
}

function scoreText(tokens, title, fullText) {
  if (!tokens.length) return 1; // no filter -> neutral score
  const titleL = normalize(title);
  const fullL = normalize(fullText);
  const words = new Set((fullL.match(/[\p{L}\p{N}]+/gu) || []).slice(0, 5000));
  let score = 0;
  for (const t of tokens) {
    if (!t) continue;
    if (titleL.includes(t)) score += 8;
    if (fullL.includes(t)) score += 5;
    // prefix match on words
    for (const w of words) {
      if (w.startsWith(t)) { score += 2; break; }
    }
  }
  return score;
}

const SKILLS_SCAN_LIMIT = 1000; // how many skills to scan server-side
const LORE_ARTICLES_PER_SECTION_SCAN = 200; // how many lore articles per section

async function fetchCandidateDocs({ scope, queryText, limit = 40 }) {
  const results = [];
  const tokens = tokenize(queryText);

  // Naive keyword filtering over a limited subset of docs per collection
  if (!scope || scope === 'skills' || scope === 'mixed') {
    const snap = await db
      .collection('skillsCatalog')
      .orderBy('updatedAt', 'desc')
      .limit(Math.max(limit, SKILLS_SCAN_LIMIT))
      .get();
    snap.forEach((doc) => {
      const d = doc.data() || {};
      const title = textOrEmpty(d.name);
      const attack = d.attack || {};
      const statMods = Array.isArray(d.statMods) ? d.statMods : [];
      const extra = [
        textOrEmpty(d.description),
        textOrEmpty(d.manaCost),
        (d.keywords || []).join(', '),
        (d.perks || []).join('\n'),
        textOrEmpty(attack.damage),
        textOrEmpty(attack.damageType),
        textOrEmpty(attack.range),
        textOrEmpty(attack.saveType),
        textOrEmpty(attack.effect),
        statMods.map((m) => `${m.target}:${m.delta}`).join(', '),
      ].join('\n');
      const s = scoreText(tokens, title, extra);
      if (s > 0) {
        results.push({
          id: doc.id,
          type: 'skill',
          title,
          content: `${textOrEmpty(d.description)}\n${d.manaCost ? `Mana Cost: ${textOrEmpty(d.manaCost)}\n` : ''}\nAttack: ${attack.damage || ''} ${attack.damageType || ''} ${attack.range || ''} ${attack.saveType || ''}\n${attack.effect || ''}\nStatMods: ${statMods.map((m) => `${m.target}+${m.delta}`).join(', ')}`.trim(),
          _score: s,
        });
      }
    });
  }

  if (!scope || scope === 'lore' || scope === 'mixed') {
    const sectionsSnap = await db.collection('loreSections').limit(10).get();
    for (const sec of sectionsSnap.docs) {
      const articlesRef = db.collection('loreSections').doc(sec.id).collection('articles');
      const artSnap = await articlesRef
        .orderBy('updatedAt', 'desc')
        .limit(Math.max(20, Math.min(LORE_ARTICLES_PER_SECTION_SCAN, limit)))
        .get();
      artSnap.forEach((doc) => {
        const d = doc.data() || {};
        const title = textOrEmpty(d.title);
        const extra = [
          textOrEmpty(d.summary),
          textOrEmpty(d.content),
          (d.tags || []).join(', '),
          textOrEmpty(d.attacks),
          textOrEmpty(d.ac),
          JSON.stringify(d.baseStats || {}),
        ].join('\n');
        const s = scoreText(tokens, title, extra);
        if (s > 0) {
          results.push({
            id: doc.id,
            sectionId: sec.id,
            type: 'lore',
            title,
            content: textOrEmpty(d.summary || d.content),
            _score: s,
          });
        }
      });
    }
  }

  // Fallback: if nothing matched, return some recent/default items so the model has context
  if (results.length === 0) {
    const fallback = [];
    if (!scope || scope === 'skills' || scope === 'mixed') {
      const snap = await db
        .collection('skillsCatalog')
        .orderBy('updatedAt', 'desc')
        .limit(Math.max(10, Math.min(50, limit)))
        .get();
      snap.forEach((doc) => {
        const d = doc.data() || {};
        const base = [textOrEmpty(d.description)];
        if (d.manaCost) base.push(`Mana Cost: ${textOrEmpty(d.manaCost)}`);
        fallback.push({ id: doc.id, type: 'skill', title: textOrEmpty(d.name), content: base.join('\n').trim() });
      });
    }
    if (!scope || scope === 'lore' || scope === 'mixed') {
      const sectionsSnap = await db.collection('loreSections').limit(4).get();
      for (const sec of sectionsSnap.docs) {
        const artSnap = await db
          .collection('loreSections')
          .doc(sec.id)
          .collection('articles')
          .orderBy('updatedAt', 'desc')
          .limit(8)
          .get();
        artSnap.forEach((doc) => {
          const d = doc.data() || {};
          fallback.push({ id: doc.id, sectionId: sec.id, type: 'lore', title: textOrEmpty(d.title), content: textOrEmpty(d.summary || d.content) });
        });
      }
    }
    return fallback.slice(0, limit);
  }

  // Rank by score if present
  results.sort((a, b) => (b._score || 0) - (a._score || 0));
  return results.slice(0, limit).map(({ _score, ...rest }) => rest);
}

function buildSystemPrompt(role) {
  const base = `You are an in-universe assistant for a tabletop RPG wiki. Use only the provided context to answer. Prefer items with titles and text that best match the user's query (partial matches are OK). Include attack details and stat modifiers when present. Cite relevant item titles. If information is missing, say so and suggest where it might live. Reply in the same language as the user's question (if the question is in Russian, answer in Russian).`;
  if (role === 'gm') {
    return base + `\nAudience: Game Master. You may include mechanical guidance, encounter ideas, balance notes. Avoid revealing player secrets unless clearly asked.`;
  }
  return base + `\nAudience: Player. Avoid GM-only spoilers. Explain rules and lore clearly, with examples when helpful.`;
}

function makeContextBlocks(candidates) {
  return candidates
    .map((c, i) => `# ${c.type.toUpperCase()}: ${c.title} (id: ${c.id}${c.sectionId ? `, section: ${c.sectionId}` : ''})\n${c.content}`)
    .join('\n\n');
}

export const gemini = onRequest({ cors: true, region: 'us-central1', secrets: [GEMINI_API_KEY] }, async (req, res) => {
  cors(req, res, async () => {
    // Handle CORS preflight explicitly to avoid 405 on OPTIONS
    if (req.method === 'OPTIONS') {
      try {
        res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      } catch {}
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      if (!genAI) {
        const key = GEMINI_API_KEY.value();
        if (key) {
          genAI = new GoogleGenerativeAI(key);
        }
      }
      if (!genAI) {
        res.status(500).json({ error: 'Gemini API key not configured' });
        return;
      }

      const { question, role = 'player', scope = 'mixed', generator } = req.body || {};
      if (!question || typeof question !== 'string') {
        res.status(400).json({ error: 'Missing question' });
        return;
      }

      const MODEL_ID = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({ model: MODEL_ID });

      // Name generation mode
      if (generator && generator.kind === 'name') {
        const params = generator.params || {};
        const lex = [];
        try {
          const skillsSnap = await db.collection('skillsCatalog').orderBy('updatedAt', 'desc').limit(50).get();
          skillsSnap.forEach((d) => lex.push(textOrEmpty((d.data() || {}).name)));
          const sectionsSnap = await db.collection('loreSections').limit(5).get();
          for (const sec of sectionsSnap.docs) {
            const arts = await db.collection('loreSections').doc(sec.id).collection('articles').orderBy('updatedAt', 'desc').limit(20).get();
            arts.forEach((a) => lex.push(textOrEmpty((a.data() || {}).title)));
          }
        } catch {}

        const count = Math.min(Math.max(Number(params.count ?? 10), 1), 50);
        const lang = params.language || 'ru';
        const guide = [
          `Task: generate ${count} unique ${params.type || 'names'} for a fantasy tabletop RPG wiki.`,
          params.style ? `Style: ${params.style}.` : '',
          params.syllables ? `Syllables: ${(params.syllables.min ?? '')}-${(params.syllables.max ?? '')}.` : '',
          params.startsWith ? `Start with: ${params.startsWith}.` : '',
          params.endsWith ? `End with: ${params.endsWith}.` : '',
          params.avoid && params.avoid.length ? `Avoid: ${params.avoid.join(', ')}.` : '',
          `Language: ${lang}.`,
        ].filter(Boolean).join('\n');

        const promptGen = `You are a creative namer for a fantasy wiki. Reply in ${lang}.\n${guide}\n\nSetting Lexicon (hints): ${lex.filter(Boolean).slice(0,120).join(', ')}\n\nOutput in Markdown list:\n- **Name** — short 3-7 word descriptor (optional). No numbering.`;

        let result;
        try {
          result = await model.generateContent(promptGen);
        } catch (err) {
          const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
          result = await fallbackModel.generateContent(promptGen);
        }
        const text = result?.response?.text?.() || '';
        res.json({ answer: text, citations: [], usedScope: scope, role: role === 'gm' ? 'gm' : 'player' });
        return;
      }

      const candidates = await fetchCandidateDocs({ scope, queryText: question, limit: 24 });
      const system = buildSystemPrompt(role === 'gm' ? 'gm' : 'player');
      const context = makeContextBlocks(candidates);
      const prompt = `${system}\n\nContext:\n${context || '(no matching documents)'}\n\nUser question: ${question}\n\nInstructions:\n- Answer in Markdown (use headings, bullet lists, and tables when helpful).\n- Include a "References" list with titles you used.\n- If context is missing, state limitations.`;

      let result;
      try {
        result = await model.generateContent(prompt);
      } catch (err) {
        const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        result = await fallbackModel.generateContent(prompt);
      }
      const text = result?.response?.text?.() || '';

      res.json({
        answer: text,
        citations: candidates.map((c) => ({ id: c.id, title: c.title, type: c.type, sectionId: c.sectionId || null })),
        usedScope: scope,
        role: role === 'gm' ? 'gm' : 'player',
      });
    } catch (err) {
      console.error('Gemini handler error', err);
      res.status(500).json({ error: 'Internal error' });
    }
  });
});
