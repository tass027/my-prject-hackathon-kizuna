import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const langues = {
  fr: 'français',
  en: 'English',
  ar: 'arabe tunisien',
} as const;

function empreinteClient(req: Request) {
  const adresse =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',').pop()?.trim();
  return adresse || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const cleOpenAI = Deno.env.get('OPENAI_API_KEY');
  const urlSupabase = Deno.env.get('SUPABASE_URL');
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!cleOpenAI || !urlSupabase || !cleService) {
    console.error('Configuration manquante pour aaddad-assistant.');
    return json({ error: 'L’assistant IA n’est pas encore configuré sur le serveur.' }, 503);
  }

  let payload: { messages?: unknown; langue?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Requête JSON invalide.' }, 400);
  }

  if (!payload || typeof payload !== 'object') return json({ error: 'Requête invalide.' }, 400);
  const langue = payload.langue as keyof typeof langues;
  const messages = payload.messages;
  if (!langues[langue] || !Array.isArray(messages) || messages.length < 1 || messages.length > 8) {
    return json({ error: 'Conversation ou langue invalide.' }, 400);
  }
  if (messages.some((message) =>
    !message ||
    typeof message.content !== 'string' ||
    message.content.trim().length === 0 ||
    message.content.length > 2000 ||
    !['user', 'assistant'].includes(message.role)
  ) || messages[messages.length - 1].role !== 'user') {
    return json({ error: 'Message invalide.' }, 400);
  }

  const adresse = empreinteClient(req);
  if (!adresse) {
    console.error('Adresse réseau absente; quota Aaddad non appliqué.');
    return json({ error: 'Impossible de vérifier la limite quotidienne. Réessaie plus tard.' }, 503);
  }

  const empreinteBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${cleService}:${adresse}`),
  );
  const empreinte = Array.from(new Uint8Array(empreinteBuffer), (octet) => octet.toString(16).padStart(2, '0')).join('');
  const supabase = createClient(urlSupabase, cleService);
  const { data: quotaAccepte, error: erreurQuota } = await supabase.rpc('consume_aaddad_ai_quota', {
    p_client_hash: empreinte,
    p_daily_limit: 20,
  });
  if (erreurQuota) {
    console.error('Vérification du quota Aaddad impossible:', erreurQuota.message);
    return json({ error: 'Le service de l’assistant est temporairement indisponible.' }, 503);
  }
  if (!quotaAccepte) return json({ error: 'La limite de 20 messages par jour est atteinte. Réessaie demain.' }, 429);

  const systemPrompt = `Tu es Aaddad, l’assistant bienveillant de Mieru, une application tunisienne de suivi de consommation électrique. Réponds en ${langues[langue]} et de façon claire, concise et chaleureuse. Aide sur les économies d’énergie à la maison et l’utilisation de Mieru. Ne prétends pas connaître le compteur, les relevés ou le compte de l’utilisateur : ces données ne te sont pas communiquées. N’invente pas de tarifs, de mesures ou de règles de la STEG ; indique quand une information doit être vérifiée. Ne donne pas d’instructions pour réparer une installation électrique ; conseille un électricien qualifié en cas de problème.`;

  let reponseOpenAI: Response;
  try {
    reponseOpenAI = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleOpenAI}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 320,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    console.error('Appel OpenAI impossible:', error instanceof Error ? error.message : 'erreur inconnue');
    return json({ error: 'Impossible de joindre le service IA. Réessaie dans un instant.' }, 502);
  }

  if (!reponseOpenAI.ok) {
    console.error('OpenAI a répondu avec le statut', reponseOpenAI.status);
    return json({ error: 'Le service IA a rencontré un problème. Réessaie dans un instant.' }, 502);
  }

  let resultat: { choices?: { message?: { content?: unknown } }[] };
  try {
    resultat = await reponseOpenAI.json();
  } catch {
    console.error('Réponse OpenAI JSON invalide.');
    return json({ error: 'Le service IA a renvoyé une réponse invalide. Réessaie.' }, 502);
  }
  const reply = resultat.choices?.[0]?.message?.content;
  if (typeof reply !== 'string' || !reply.trim()) {
    console.error('Réponse OpenAI vide ou invalide.');
    return json({ error: 'Le service IA n’a pas fourni de réponse. Réessaie.' }, 502);
  }
  return json({ reply: reply.trim() });
});
