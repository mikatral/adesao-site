// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

const TZ = process.env.APP_TZ || 'America/Sao_Paulo';
const PROD_ONLY = false; // deixe true se quiser bloquear só em produção

// Converte "agora" para o fuso TZ e devolve um Date coerente para usar getDay/getHours
function nowInTZ(timeZone: string) {
  // gera uma string no fuso desejado e reconstroi Date nessa "parede"
  const s = new Date().toLocaleString('en-US', { timeZone });
  return new Date(s);
}

function isOpenAtTZ(timeZone: string) {
  const d = nowInTZ(timeZone);
  const dow = d.getDay();   // 0=Dom .. 6=Sáb
  const h = d.getHours();   // 0..23
  const weekday = dow >= 1 && dow <= 5;  // seg..sex
  const business = h >= 8 && h < 18;     // 08:00–17:59
  return weekday && business;
}

function closedHtml() {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Estamos fechados</title>
<style>
  :root { color-scheme: light; }
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

export function middleware(req: NextRequest) {
  if (PROD_ONLY && process.env.NODE_ENV !== 'production') {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // libera assets e arquivos públicos
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.startsWith('/_vercel')
  ) {
    return NextResponse.next();
  }

  const open = isOpenAtTZ(TZ);

  // Em dev/preview, adiciona header de debug para você ver o horário calculado
  if (process.env.NODE_ENV !== 'production') {
    const d = nowInTZ(TZ);
    const res = open ? NextResponse.next() : closedHtml();
    res.headers.set('x-debug-hour', String(d.getHours()));
    res.headers.set('x-debug-dow', String(d.getDay()));
    res.headers.set('x-debug-tz', TZ);
    return res;
  }

  if (open) return NextResponse.next();

  if (pathname.startsWith('/api')) {
    return NextResponse.json(
      { error: 'Serviço disponível de segunda a sexta, das 08:00 às 18:00 (horário de Brasília).' },
      { status: 503 }
    );
  }

  return closedHtml();
}

// aplica em tudo, exceto estáticos óbvios
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
