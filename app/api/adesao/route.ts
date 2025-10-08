// app/api/adesao/route.ts
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import type { Empresa, Colaborador } from '@/types/domain';
import { isEmpresa } from '@/types/domain';

export const runtime = 'nodejs';

// ===== Config =====
const MAX_PDF_MB = Number(process.env.MAX_PDF_MB || 10);
const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;

const EXCEL_MIMES = new Set<string>([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
]);

// ===== Helpers (sem any/sem sobras) =====
function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '');
}
function dvCalc(nums: number[], pesos: number[]) {
  const s = nums.reduce((acc, n, i) => acc + n * pesos[i], 0);
  const r = s % 11;
  return r < 2 ? 0 : 11 - r;
}
function validarCPF(cpf: string) {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const n = d.split('').map(Number);
  const dv1 = dvCalc(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = dvCalc(n.slice(0, 9).concat(dv1), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return n[9] === dv1 && n[10] === dv2;
}
function validarCNPJ(cnpj: string) {
  const d = onlyDigits(cnpj);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const n = d.split('').map(Number);
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv1 = dvCalc(n.slice(0, 12), p1);
  const dv2 = dvCalc(n.slice(0, 12).concat(dv1), p2);
  return n[12] === dv1 && n[13] === dv2;
}
function validarTelefoneBR(s: string) {
  const d = onlyDigits(s);
  return d.length === 10 || d.length === 11; // DDD+fixo ou DDD+cel
}

function emailHtml(empresa: Empresa, colaboradores: Colaborador[] = []) {
  const cidadeUf = [empresa?.cidade, empresa?.uf].filter(Boolean).join(' - ');
  const colaboradoresTable = colaboradores.length
    ? `<h3>Colaboradores (${colaboradores.length})</h3>
       <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;border:1px solid #eee">
         <tr><th align="left">Nome</th><th align="left">CPF</th><th align="left">Nascimento</th><th align="left">Mãe</th></tr>
         ${colaboradores
           .map(
             (c: Colaborador) => `
          <tr>
            <td>${c.nome || ''}</td>
            <td>${c.cpf || ''}</td>
            <td>${c.dataNascimento || ''}</td>
            <td>${c.nomeMae || ''}</td>
          </tr>`
           )
           .join('')}
       </table>`
    : '<p><em>Nenhum colaborador listado (PDF/Excel em anexo).</em></p>';

  const saudacao = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  return `
  <div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
    <p>${saudacao} a todos,</p>
    <p>${empresa?.atendente || 'Atendimento'}, obrigado pelo envio dos dados.</p>
    <p>A Equipe HS em cópia irá realizar o cadastro da empresa no site e encaminhar o boleto de adesão.</p>
    <p><strong>Equipe HS</strong>, por favor cadastrar a empresa no plano completo de <strong>${empresa?.cidade || ''}</strong> e encaminhar o boleto de adesão.</p>

    <h3>Empresa</h3>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;border:1px solid #eee">
      <tr><td><b>Razão Social</b></td><td>${empresa?.razaoSocial || ''}</td></tr>
      <tr><td><b>CNPJ</b></td><td>${empresa?.cnpj || ''}</td></tr>
      <tr><td><b>E-mail</b></td><td>${empresa?.email || ''}</td></tr>
      ${empresa?.telefone ? `<tr><td><b>Telefone</b></td><td>${empresa.telefone}</td></tr>` : ''}
      ${cidadeUf ? `<tr><td><b>Cidade/UF</b></td><td>${cidadeUf}</td></tr>` : ''}
      ${empresa?.cep ? `<tr><td><b>CEP</b></td><td>${empresa.cep}</td></tr>` : ''}
      ${empresa?.atendente ? `<tr><td><b>Atendente</b></td><td>${empresa.atendente}</td></tr>` : ''}
    </table>

    ${colaboradoresTable}
  </div>`;
}

// SMTP
function makeTransport() {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export async function POST(req: Request) {
  try {
    const from = process.env.MAIL_FROM!;
    const to = (process.env.MAIL_TO || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const cc = (process.env.MAIL_CC || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const transporter = makeTransport();

    const ctype = req.headers.get('content-type') || '';

    // ========== MULTIPART (PDF ou EXCEL, sem leitura) ==========
    if (ctype.includes('multipart/form-data')) {
      const form = await req.formData();
      const modo = String(form.get('modo') || '');
      const empresaStr = String(form.get('empresa') || '{}');

      // Parse seguro + type guard
      const raw: unknown = (() => {
        try {
          return JSON.parse(empresaStr);
        } catch {
          return null;
        }
      })();

      if (!isEmpresa(raw)) {
        return NextResponse.json(
          {
            error:
              'Objeto "empresa" inválido. Campos obrigatórios: razão social, CNPJ, e-mail, telefone e atendente.',
          },
          { status: 400 }
        );
      }
      const empresa: Empresa = raw;

      // Validações complementares (regras de negócio)
      const erros: string[] = [];
      if (!validarCNPJ(empresa.cnpj)) erros.push('CNPJ inválido.');
      if (!/.+@.+\..+/.test(empresa.email)) erros.push('E-mail da empresa inválido.');
      if (!validarTelefoneBR(empresa.telefone)) erros.push('Telefone inválido.');
      if (!empresa.atendente.trim()) erros.push('Atendente é obrigatório.');
      if (erros.length) {
        return NextResponse.json({ error: erros.join(' ') }, { status: 400 });
      }

      // ----- PDF -----
      if (modo === 'pdf') {
        const rawPdf = form.get('pdf');
        if (!(rawPdf instanceof File))
          return NextResponse.json({ error: 'Selecione um arquivo PDF.' }, { status: 400 });
        const pdf: File = rawPdf;

        if (pdf.type !== 'application/pdf')
          return NextResponse.json({ error: 'Arquivo precisa ser PDF.' }, { status: 400 });
        if (pdf.size > MAX_PDF_BYTES) {
          return NextResponse.json(
            {
              error: `PDF muito grande (${(pdf.size / 1024 / 1024).toFixed(
                1
              )} MB). Limite: ${MAX_PDF_MB} MB.`,
            },
            { status: 413 }
          );
        }

        const bytes = new Uint8Array(await pdf.arrayBuffer());
        const html = emailHtml(empresa, []);
        const subject = `Adesão (${empresa.razaoSocial}) – PDF de colaboradores`;

        const info = await transporter.sendMail({
          from,
          to: to.length ? to : [empresa.email],
          cc: cc.length ? cc : undefined,
          subject,
          html,
          attachments: [
            {
              filename: pdf.name || 'colaboradores.pdf',
              content: Buffer.from(bytes),
              contentType: 'application/pdf',
            },
          ],
        });

        return NextResponse.json({ ok: true, messageId: info.messageId });
      }

      // ----- EXCEL -----
      if (modo === 'excel') {
        const rawXls = form.get('xls');
        if (!(rawXls instanceof File))
          return NextResponse.json({ error: 'Selecione um arquivo Excel.' }, { status: 400 });
        const xls: File = rawXls;

        const name = (xls.name || '').toLowerCase();
        const okExt = name.endsWith('.xlsx') || name.endsWith('.xls');
        const okMime = EXCEL_MIMES.has(xls.type);
        if (!okExt && !okMime) {
          return NextResponse.json(
            { error: 'Arquivo precisa ser .xlsx ou .xls.' },
            { status: 400 }
          );
        }
        if (xls.size > MAX_PDF_BYTES) {
          return NextResponse.json(
            {
              error: `Arquivo muito grande (${(xls.size / 1024 / 1024).toFixed(
                1
              )} MB). Limite: ${MAX_PDF_MB} MB.`,
            },
            { status: 413 }
          );
        }

        const bytes = new Uint8Array(await xls.arrayBuffer());
        const html = emailHtml(empresa, []); // sem lista; Excel vai anexo
        const subject = `Adesão (${empresa.razaoSocial}) – Excel de colaboradores`;

        const info = await transporter.sendMail({
          from,
          to: to.length ? to : [empresa.email],
          cc: cc.length ? cc : undefined,
          subject,
          html,
          attachments: [
            {
              filename: xls.name || 'colaboradores.xlsx',
              content: Buffer.from(bytes),
              contentType:
                xls.type ||
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
          ],
        });

        return NextResponse.json({ ok: true, messageId: info.messageId });
      }

      // modo inválido
      return NextResponse.json({ error: 'Modo inválido (use pdf ou excel).' }, { status: 400 });
    }

    // ========== JSON (formulário) ==========
    const bodyUnknown = (await req.json().catch(() => null)) as unknown;
    if (!bodyUnknown || typeof bodyUnknown !== 'object') {
      return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
    }
    const b = bodyUnknown as Record<string, unknown>;

    const empresaRaw = b.empresa;
    if (!isEmpresa(empresaRaw)) {
      return NextResponse.json({ error: 'Empresa inválida.' }, { status: 400 });
    }
    const empresa = empresaRaw as Empresa;

    const colaboradoresRaw = Array.isArray(b.colaboradores) ? (b.colaboradores as unknown[]) : [];
    const colaboradores: Colaborador[] = colaboradoresRaw
      .filter((x) => typeof x === 'object' && x !== null)
      .map((x) => {
        const o = x as Record<string, unknown>;
        return {
          nome: String(o.nome ?? ''),
          cpf: String(o.cpf ?? ''),
          dataNascimento: String(o.dataNascimento ?? ''),
          nomeMae: String(o.nomeMae ?? ''),
        };
      });

    const errs: string[] = [];
    if (!empresa?.razaoSocial) errs.push('Razão Social é obrigatória.');
    if (!empresa?.cnpj || !validarCNPJ(empresa.cnpj)) errs.push('CNPJ inválido.');
    if (!empresa?.email || !/.+@.+\..+/.test(empresa.email))
      errs.push('E-mail da empresa inválido.');
    if (!empresa?.telefone || !validarTelefoneBR(empresa.telefone)) errs.push('Telefone inválido.');
    if (!empresa?.atendente || !empresa.atendente.trim()) errs.push('Atendente é obrigatório.');
    colaboradores.forEach((c: Colaborador, i: number) => {
      if (!(c?.nome && c?.cpf && c?.dataNascimento))
        errs.push(`Colaborador ${i + 1}: preencha nome, CPF e data de nascimento.`);
      if (c?.cpf && !validarCPF(c.cpf)) errs.push(`Colaborador ${i + 1}: CPF inválido.`);
    });
    if (errs.length) return NextResponse.json({ error: errs.join(' ') }, { status: 400 });

    const html = emailHtml(empresa, colaboradores);
    const subject = `Adesão (${empresa.razaoSocial}) – ${colaboradores.length} colaborador(es)`;

    const info = await transporter.sendMail({
      from,
      to: to.length ? to : [empresa.email],
      cc: cc.length ? cc : undefined,
      subject,
      html,
    });

    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return NextResponse.json({ error: 'Erro inesperado.' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/adesao' });
}
