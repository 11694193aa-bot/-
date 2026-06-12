export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return new Response('Invalid JSON payload', { status: 400 });
  }

  const { question = '', cards, summary = '', createdAt, apiKey = '' } = body;
  if (!Array.isArray(cards) || typeof createdAt !== 'number') {
    return new Response('Invalid payload', { status: 400 });
  }

  const record = {
    question: String(question).trim(),
    cards: cards.map(c => ({
      name: String(c.name || ''),
      reversed: Boolean(c.reversed),
      position: String(c.position || '')
    })),
    summary: String(summary),
    createdAt,
    aiSummary: null
  };

  try {
    const stored = await augmentAI(record, String(apiKey).trim());
    const key = String(Date.now());
    await env.TAROT.put(key, JSON.stringify(stored));
    await pruneOldRecords(env);
    return new Response(JSON.stringify(stored), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function augmentAI(record, apiKey) {
  if (!apiKey) {
    record.aiSummary = record.summary;
    return record;
  }

  const prompt = `请基于以下塔罗牌占卜结果，为提问者生成一段简洁且温暖的个性化解读。\n提问：${record.question || '无具体问题'}\n牌阵：${record.cards.map(c => `${c.position} ${c.name}${c.reversed ? '（逆位）' : ''}`).join('，')}\n综合分析：${record.summary}`;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 180,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      record.aiSummary = record.summary;
      return record;
    }

    const data = await response.json();
    const aiText = data?.choices?.[0]?.message?.content?.trim();
    record.aiSummary = aiText || record.summary;
  } catch (error) {
    record.aiSummary = record.summary;
  }

  return record;
}

async function pruneOldRecords(env) {
  const listResult = await env.TAROT.list({ limit: 100 });
  const keys = listResult.keys.map(item => item.name).sort((a, b) => a.localeCompare(b));
  if (keys.length <= 50) {
    return;
  }
  const toDelete = keys.slice(0, keys.length - 50);
  await Promise.all(toDelete.map(key => env.TAROT.delete(key)));
}
