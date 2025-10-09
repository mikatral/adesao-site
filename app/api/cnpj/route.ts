// app/api/cnpj/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// ===== Helpers =====
function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '');
}
function formatCEP(s?: string) {
  const d = onlyDigits(s || '');
  if (d.length !== 8) return undefined;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

// CORS opcional por lista de origens (anti-CSRF) via env ALLOWED_ORIGINS="foo.vercel.app,meudominio.com"
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isOriginAllowed(origin: string | null): boolean {
  if (!origin || ALLOWED_ORIGINS.length === 0) return true; // sem restrição
  try {
    const u = new URL(origin);
    const host = u.host.toLowerCase();
    return ALLOWED_ORIGINS.some((o) => host === o.toLowerCase() || host.endsWith(`.${o.toLowerCase()}`));
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  // CORS simples por origem (se configurado)
  const origin = req.headers.get('origin');
  if (!isOriginAllowed(origin)) {
    return NextResponse.json({ error: 'Origin não permitida' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('cnpj') || '';
  const cnpj = onlyDigits(raw);

  if (cnpj.length !== 14) {
    return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 });
  }

  // 1) BrasilAPI
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { cache: 'no-store' });
    if (r.ok) {
      type BrasilApi = {
        municipio?: string;
        uf?: string;
        cep?: string | number;
      };
      const j = (await r.json()) as BrasilApi;
      const resp = NextResponse.json(
        {
          origem: {
            cidade: j?.municipio,
            uf: j?.uf,
            cep: formatCEP(String(j?.cep ?? '')),
          },
          fonte: 'brasilapi',
          bruto: j,
        },
        { status: 200 }
      );
      if (origin) resp.headers.set('Access-Control-Allow-Origin', origin);
      return resp;
    }
  } catch {
    // ignora e tenta fallback
  }

  // 2) Fallback: CNPJ.ws (público: 3 req/min)
  try {
    const r2 = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, { cache: 'no-store' });
    if (r2.ok) {
      type CnpjWs = {
        estabelecimento?: {
          cidade?: { nome?: string };
          estado?: { sigla?: string };
          cep?: string | number;
        };
      };
      const j2 = (await r2.json()) as CnpjWs;
      const resp = NextResponse.json(
        {
          origem: {
            cidade: j2?.estabelecimento?.cidade?.nome,
            uf: j2?.estabelecimento?.estado?.sigla,
            cep: formatCEP(String(j2?.estabelecimento?.cep ?? '')),
          },
          fonte: 'cnpj.ws',
          bruto: j2,
        },
        { status: 200 }
      );
      if (origin) resp.headers.set('Access-Control-Allow-Origin', origin);
      return resp;
    }
  } catch {
    // segue para defaults
  }

  // defaults opcionais se tudo falhar
  const resp = NextResponse.json(
    {
      origem: {
        cidade: process.env.DEFAULT_CIDADE,
        uf: process.env.DEFAULT_UF,
        cep: undefined,
      },
      fonte: 'default',
    },
    { status: 200 }
  );
  if (origin) resp.headers.set('Access-Control-Allow-Origin', origin);
  return resp;
}