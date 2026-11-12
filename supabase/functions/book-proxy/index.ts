// supabase/functions/book-proxy/index.ts
// Supabase Edge Function — 도서 검색·표지 이미지·목차(TOC) 프록시
// 배포 명령어: supabase functions deploy book-proxy --no-verify-jwt

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let path = '';
    if (req.method === 'GET') {
      const url = new URL(req.url);
      path = url.searchParams.get('path') || '';
    } else {
      const body = await req.json().catch(() => ({}));
      path = body.path || '';
    }

    if (
      !path ||
      (!path.startsWith('/Product/Search') &&
        !path.startsWith('/Product/Goods/') &&
        !path.startsWith('/product/goods/'))
    ) {
      return new Response(JSON.stringify({ error: 'Invalid path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetUrl = `https://www.yes24.com${path}`;
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
    });

    const html = await upstream.text();
    return new Response(JSON.stringify({ html, status: upstream.status }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
