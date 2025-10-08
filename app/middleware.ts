// middleware.ts
import { NextResponse, NextRequest } from 'next/server';

const TZ = process.env.APP_TZ || 'America/Sao_Paulo';

// converte "agora" para o fuso especificado de forma confiável
function nowInTZ(timeZone: string) {
  // toLocaleString com timeZone e depois new Date() nesse string
  // (funciona bem no runtime edge da Vercel)
  const s = new Date().toLocaleString('en-US', { timeZone });
  return new Date(s);
}

function isOpen(d: Date) {
  // 0=Dom, 1=Seg ... 6=Sáb
  const dow = d.getDay();
  const hour = d.getHours(); // 0..23
  const weekday = dow >= 1 && dow <= 5;
  const businessHours = hour >= 8 && hour < 18; // 08:00 inclusive até 17:59
  return weekday && businessHours;
}

export function middleware(req: NextRequest) {
  // Em dev/preview não bloqueia (muda se quiser testar também em preview)
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // libera assets internos e arquivos públicos comuns
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap') ||
    pathname.startsWith('/_vercel') // health/analytics
  ) {
    return NextResponse.next();
  }

  const now = nowInTZ(TZ);

  if (isOpen(now)) {
    return NextResponse.next();
  }

  // Se for rota de API, responde JSON
  if (pathname.startsWith('/api')) {
    return NextResponse.json(
      { error: 'Serviço disponível de segunda a sexta, das 08:00 às 18:00 (horário de Brasília).' },
      { status: 503 }
    );
  }

  // Página simples para o site
  const html = `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>Estamos fechados</title>
      <style>
        body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue','Noto Sans',Arial,'Apple Color Emoji','Segoe UI Emoji';background:#f7fafc;color:#1a202c}
        .wrap{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px}
        .card{max-width:720px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.06);padding:28px;text-align:center}
        h1{font-size:22px;margin:0 0 8px}
        p{margin:8px 0 0;color:#4a5568}
        .time{margin-top:12px;font-weight:600}
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          <h1>Estamos fechados no momento</h1>
          <p>Nosso atendimento funciona de <strong>segunda a sexta</strong>, das <strong>08:00 às 18:00</strong> (horário de Brasília).</p>
          <p class="time">Tente novamente dentro do horário comercial. Obrigado!</p>
        </div>
      </div>
    </body>
  </html>`;

  return new NextResponse(html, {
    status: 503,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

// Aplica o middleware em tudo, menos arquivos estáticos comuns
export const config = {
  matcher: [
    // todas as rotas, exceto assets gerados e arquivos estáticos óbvios
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
