import { NextResponse } from 'next/server';



// ===== Segurança & Config =====
const MAX_PDF_MB = Number(process.env.MAX_PDF_MB || 10);
const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;

const isProd = process.env.NODE_ENV === 'production';
function logDev(...args: any[]) { if (!isProd) logDev(...args); }

// Lista de hosts permitidos na origem da requisição (anti-CSRF).
// Em produção, troque para o seu domínio/vercel app.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
// Ex.: na Vercel, defina ALLOWED_ORIGINS="seuapp.vercel.app,www.seudominio.com"

// Escapa HTML para evitar quebra/injeção no corpo do e-mail
function esc(s: any) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}


export const runtime = 'nodejs';

function onlyDigits(s: string) { return (s || '').replace(/\D/g, ''); }
function formatCEP(s?: string) {
  const d = onlyDigits(s || '');
  if (d.length !== 8) return undefined;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export async function GET(req: Request) {
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
      const j = await r.json();
      return NextResponse.json({
        origem: {
          cidade: j?.municipio,
          uf: j?.uf,
          cep: formatCEP(j?.cep),
        },
        fonte: 'brasilapi',
        bruto: j,
      });
    }
  } catch { }

  // 2) Fallback: CNPJ.ws (público: 3 req/min)
  try {
    const r2 = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, { cache: 'no-store' });
    if (r2.ok) {
      const j2 = await r2.json();
      return NextResponse.json({
        origem: {
          cidade: j2?.estabelecimento?.cidade?.nome,
          uf: j2?.estabelecimento?.estado?.sigla,
          cep: formatCEP(j2?.estabelecimento?.cep), // <- aqui vem o CEP
        },
        fonte: 'cnpj.ws',
        bruto: j2,
      });
    }
  } catch { }

  // defaults opcionais se tudo falhar
  return NextResponse.json({
    origem: {
      cidade: process.env.DEFAULT_CIDADE,
      uf: process.env.DEFAULT_UF,
      cep: undefined,
    },
    fonte: 'default',
  }, { status: 200 });
}
