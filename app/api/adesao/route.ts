// app/api/adesao/route.ts
import { NextResponse } from 'next/server';
import * as nodemailer from 'nodemailer';

export const runtime = 'nodejs';

// ===== Config =====
const MAX_PDF_MB = Number(process.env.MAX_PDF_MB || 10);
const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;

const EXCEL_MIMES = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
]);

// ===== Helpers =====
function esc(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function onlyDigits(s: string) { return (s || '').replace(/\D/g, ''); }
function dvCalc(nums: number[], pesos: number[]) {
    const s = nums.reduce((acc, n, i) => acc + n * pesos[i], 0);
    const r = s % 11; return r < 2 ? 0 : 11 - r;
}
function validarCPF(cpf: string) {
    const d = onlyDigits(cpf);
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    const n = d.split('').map(Number);
    const dv1 = dvCalc(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const dv2 = dvCalc(n.slice(0, 9).concat(dv1), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return n[9] === dv1 && n[10] === dv2;
}
const APP_TZ = process.env.APP_TZ || 'America/Sao_Paulo';

function horaAtualTZ(tz: string) {
    const fmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', hour12: false, timeZone: tz });
    const hStr = fmt.format(new Date()); // "07", "13", "19"...
    const h = parseInt(hStr, 10);
    return Number.isNaN(h) ? new Date().getUTCHours() : h;
}

function saudacaoBR(tz = APP_TZ) {
    const h = horaAtualTZ(tz);
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
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

function emailHtml(empresa: any, colaboradores: any[] = []) {
    const cidadeUfRaw = [empresa?.cidade, empresa?.uf].filter(Boolean).join(' - ');
    const cidadeUfEsc = esc(cidadeUfRaw);
    const saudacao = saudacaoBR()

    const colaboradoresTable = colaboradores.length
        ? `<h3>Colaboradores (${colaboradores.length})</h3>
       <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;border:1px solid #eee">
         <tr><th align="left">Nome</th><th align="left">CPF</th><th align="left">Nascimento</th><th align="left">Mãe</th></tr>
         ${colaboradores.map((c: any) => `
          <tr>
            <td>${esc(c?.nome)}</td>
            <td>${esc(c?.cpf)}</td>
            <td>${esc(c?.dataNascimento)}</td>
            <td>${esc(c?.nomeMae)}</td>
          </tr>`).join('')}
       </table>`
        : '<p><em>Nenhum colaborador listado (anexo).</em></p>';

    return `
  <div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
    <p>${saudacao} a todos,</p>
    <p>${esc(empresa?.atendente) || 'Atendimento'}, obrigado pelo envio dos dados.</p>
    <p>A Equipe HS em cópia irá realizar o cadastro da empresa no site e encaminhar o boleto de adesão.</p>
    <p><strong>Equipe HS</strong>, por favor cadastrar a empresa no plano completo de <strong>${esc(empresa?.cidade)}</strong> e encaminhar o boleto de adesão.</p>

    <h3>Empresa</h3>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;border:1px solid #eee">
      <tr><td><b>Razão Social</b></td><td>${esc(empresa?.razaoSocial)}</td></tr>
      <tr><td><b>CNPJ</b></td><td>${esc(empresa?.cnpj)}</td></tr>
      <tr><td><b>E-mail</b></td><td>${esc(empresa?.email)}</td></tr>
      ${empresa?.telefone ? `<tr><td><b>Telefone</b></td><td>${esc(empresa.telefone)}</td></tr>` : ''}
      ${cidadeUfRaw ? `<tr><td><b>Cidade/UF</b></td><td>${cidadeUfEsc}</td></tr>` : ''}
      ${empresa?.cep ? `<tr><td><b>CEP</b></td><td>${esc(empresa.cep)}</td></tr>` : ''}
      ${empresa?.atendente ? `<tr><td><b>Atendente</b></td><td>${esc(empresa.atendente)}</td></tr>` : ''}
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
        secure: (process.env.SMTP_SECURE === 'true') || port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
}

export async function POST(req: Request) {
    try {
        const from = process.env.MAIL_FROM!;
        const to = (process.env.MAIL_TO || '').split(',').map(s => s.trim()).filter(Boolean);
        const cc = (process.env.MAIL_CC || '').split(',').map(s => s.trim()).filter(Boolean);
        const transporter = makeTransport();

        const ctype = req.headers.get('content-type') || '';

        // ========== MULTIPART (PDF ou EXCEL, sem leitura) ==========
        if (ctype.includes('multipart/form-data')) {
            const form = await req.formData();
            const modo = String(form.get('modo') || '');
            const empresaStr = String(form.get('empresa') || '{}');

            let empresaObj: any = {};
            try { empresaObj = JSON.parse(empresaStr); } catch { }

            // valida empresa
            const erros: string[] = [];
            if (!empresaObj?.razaoSocial) erros.push('Razão Social é obrigatória.');
            if (!empresaObj?.cnpj || !validarCNPJ(empresaObj.cnpj)) erros.push('CNPJ inválido.');
            if (!empresaObj?.email || !/.+@.+\..+/.test(empresaObj.email)) erros.push('E-mail da empresa inválido.');
            if (!empresaObj?.telefone || !validarTelefoneBR(empresaObj.telefone)) erros.push('Telefone inválido.');
            if (!empresaObj?.atendente || !empresaObj.atendente.trim()) erros.push('Atendente é obrigatório.');
            if (erros.length) return NextResponse.json({ error: erros.join(' ') }, { status: 400 });

            // ----- PDF -----
            if (modo === 'pdf') {
                const rawPdf = form.get('pdf');
                if (!(rawPdf instanceof File)) return NextResponse.json({ error: 'Selecione um arquivo PDF.' }, { status: 400 });
                const pdf: File = rawPdf;

                if (pdf.type !== 'application/pdf') return NextResponse.json({ error: 'Arquivo precisa ser PDF.' }, { status: 400 });
                if (pdf.size > MAX_PDF_BYTES) {
                    return NextResponse.json(
                        { error: `PDF muito grande (${(pdf.size / 1024 / 1024).toFixed(1)} MB). Limite: ${MAX_PDF_MB} MB.` },
                        { status: 413 }
                    );
                }

                const bytes = new Uint8Array(await pdf.arrayBuffer());
                const html = emailHtml(empresaObj, []);
                const subject = `Adesão (${empresaObj.razaoSocial}) – PDF de colaboradores`;

                const info = await transporter.sendMail({
                    from,
                    to: to.length ? to : [empresaObj.email],
                    cc: cc.length ? cc : undefined,
                    subject,
                    html,
                    attachments: [{
                        filename: pdf.name || 'colaboradores.pdf',
                        content: Buffer.from(bytes),
                        contentType: 'application/pdf',
                    }],
                });

                return NextResponse.json({ ok: true, messageId: info.messageId });
            }

            // ----- EXCEL -----
            if (modo === 'excel') {
                const rawXls = form.get('xls');
                if (!(rawXls instanceof File)) return NextResponse.json({ error: 'Selecione um arquivo Excel.' }, { status: 400 });
                const xls: File = rawXls;

                const name = (xls.name || '').toLowerCase();
                const okExt = name.endsWith('.xlsx') || name.endsWith('.xls');
                const okMime = EXCEL_MIMES.has(xls.type);
                if (!okExt && !okMime) {
                    return NextResponse.json({ error: 'Arquivo precisa ser .xlsx ou .xls.' }, { status: 400 });
                }
                if (xls.size > MAX_PDF_BYTES) {
                    return NextResponse.json(
                        { error: `Arquivo muito grande (${(xls.size / 1024 / 1024).toFixed(1)} MB). Limite: ${MAX_PDF_MB} MB.` },
                        { status: 413 }
                    );
                }

                const bytes = new Uint8Array(await xls.arrayBuffer());
                const html = emailHtml(empresaObj, []); // sem lista; Excel vai anexo
                const subject = `Adesão (${empresaObj.razaoSocial}) – Excel de colaboradores`;

                const info = await transporter.sendMail({
                    from,
                    to: to.length ? to : [empresaObj.email],
                    cc: cc.length ? cc : undefined,
                    subject,
                    html,
                    attachments: [{
                        filename: xls.name || 'colaboradores.xlsx',
                        content: Buffer.from(bytes),
                        contentType: xls.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    }],
                });

                return NextResponse.json({ ok: true, messageId: info.messageId });
            }

            // modo inválido
            return NextResponse.json({ error: 'Modo inválido (use pdf ou excel).' }, { status: 400 });
        }

        // ========== JSON (formulário) ==========
        const body = await req.json().catch(() => null) as any;
        const empresa = body?.empresa;
        const colaboradores = body?.colaboradores || [];

        const errs: string[] = [];
        if (!empresa?.razaoSocial) errs.push('Razão Social é obrigatória.');
        if (!empresa?.cnpj || !validarCNPJ(empresa.cnpj)) errs.push('CNPJ inválido.');
        if (!empresa?.email || !/.+@.+\..+/.test(empresa.email)) errs.push('E-mail da empresa inválido.');
        if (!empresa?.telefone || !validarTelefoneBR(empresa.telefone)) errs.push('Telefone inválido.');
        if (!empresa?.atendente || !empresa.atendente.trim()) errs.push('Atendente é obrigatório.');
        colaboradores.forEach((c: any, i: number) => {
            if (!(c?.nome && c?.cpf && c?.dataNascimento)) errs.push(`Colaborador ${i + 1}: preencha nome, CPF e data de nascimento.`);
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
        console.error(e);
        return NextResponse.json({ error: 'Erro inesperado.' }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ ok: true, route: '/api/adesao' });
}
