export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const listResult = await env.TAROT.list({ limit: 50 });
    const sortedKeys = listResult.keys
      .map(item => item.name)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 20);

    const values = await Promise.all(sortedKeys.map(key => env.TAROT.get(key)));
    const records = values
      .map((value, index) => {
        if (!value) return null;
        try {
          const data = JSON.parse(value);
          return {
            id: sortedKeys[index],
            question: data.question || '',
            createdAt: data.createdAt,
            cards: Array.isArray(data.cards)
              ? data.cards.map(card => ({
                  name: card.name,
                  reversed: card.reversed,
                  position: card.position
                }))
              : []
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return new Response(JSON.stringify(records), {
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
