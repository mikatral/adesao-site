// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

const TZ = process.env.APP_TZ || 'America/Sao_Paulo';
const PROD_ONLY = false; // mude para false se quiser testar em preview/dev

/** Hora (0–23) e dia da semana (0=Dom..6=Sáb) no fuso informado */
function zonedHourAndWeekday(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    weekday: 'short', // Sun..Sat
  });
  const parts = fmt.formatToParts(date);
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const wd = (parts.find(p => p.type === 'weekday')?.value ?? 'Sun') as
    'Sun'|'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat';
  const map: Record<typeof wd, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  return { hour, dow: map[wd] };
}

function isOpenAt(date: Date, timeZone: string) {
  const { hour, dow } = zonedHourAndWeekday(date, timeZone);
  const weekday = dow >= 1 && dow <= 5;       // seg..sex
  const businessHours = hour >= 8 && hour < 14; // 08:00–17:59
  return weekday && businessHours;
}

export function middleware(req: NextRequest) {
  const isProd = process.env.NODE_ENV === 'production';
  if (PROD_ONLY && !isProd) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // libera assets/infra
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.startsWith('/_vercel')
  ) {
    return NextResponse.next();
  }

  if (isOpenAt(new Date(), TZ)) return NextResponse.next();

  // API recebe JSON 503
  if (pathname.startsWith('/api')) {
    return NextResponse.json(
      { error: 'Serviço disponível de segunda a sexta, das 08:00 às 18:00 (horário de Brasília).' },
      { status: 503 }
    );
  }

  // Página de "fechado"
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

// aplica em tudo, exceto estáticos óbvios
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
