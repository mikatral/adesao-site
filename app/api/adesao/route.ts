import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function onlyDigits(s: string) { return (s || '').replace(/\D/g, ''); }
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
    const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const dv1 = dvCalc(n.slice(0, 12), pesos1);
    const dv2 = dvCalc(n.slice(0, 12).concat(dv1), pesos2);
    return n[12] === dv1 && n[13] === dv2;
}

function saudacaoSP() {
    const fmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false });
    const h = Number(fmt.format(new Date()));
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
}

function emailHtml({ empresa, colaboradores }: any) {
    const sdc = saudacaoSP();
    const rows = colaboradores.map((c: any, idx: number) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${c.nome}</td>
      <td>${c.cpf}</td>
      <td>${c.dataNascimento}</td>
      <td>${c.nomeMae}</td>
    </tr>
  `).join('');

    return `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
    <p>${sdc} a todos,</p>

    <p><strong>${empresa.atendente || 'Atendente'}</strong>,<br/>
    Obrigado pelo envio dos dados. A Equipe HS que está em cópia irá realizar o cadastro da empresa no site e encaminhar o boleto de adesão.</p>

    <p><strong>Equipe HS</strong>,<br/>
    Por favor, cadastrar a empresa <strong>${empresa.razaoSocial}</strong> no plano completo de <strong>${empresa.cidade || ''}${empresa.uf ? ' - ' + empresa.uf : ''}</strong> e encaminhar o boleto de adesão.</p>

    <h3 style="margin:24px 0 8px">Empresa</h3>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
      <tr><td><b>Razão Social</b></td><td>${empresa.razaoSocial}</td></tr>
      <tr><td><b>CNPJ</b></td><td>${empresa.cnpj}</td></tr>
      <tr><td><b>E-mail</b></td><td>${empresa.email}</td></tr>
      ${empresa.telefone ? `<tr><td><b>Telefone</b></td><td>${empresa.telefone}</td></tr>` : ''}
      ${(empresa.cidade || empresa.uf) ? `<tr><td><b>Cidade/UF</b></td><td>${empresa.cidade || ''}${empresa.uf ? ' - ' + empresa.uf : ''}</td></tr>` : ''}
      ${empresa.cep ? `<tr><td><b>CEP</b></td><td>${empresa.cep}</td></tr>` : ''}
    </table>

    <h3 style="margin:24px 0 8px">Colaboradores (${colaboradores.length})</h3>
    <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse">
      <thead>
        <tr><th>#</th><th>Nome</th><th>CPF</th><th>Nascimento</th><th>Mãe</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <p style="margin-top:24px">Atenciosamente,<br/>${empresa.atendente || ''}</p>
  </div>
  `;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const empresa = body?.empresa;
        const colaboradores = body?.colaboradores || [];

        // validações
        const erros: string[] = [];
        if (!empresa?.razaoSocial) erros.push('Razão Social é obrigatória.');
        if (!empresa?.cnpj || !validarCNPJ(empresa.cnpj)) erros.push('CNPJ inválido.');
        if (!empresa?.email || !/.+@.+\..+/.test(empresa.email)) erros.push('E-mail da empresa inválido.');
        colaboradores.forEach((c: any, i: number) => {
            if (!(c?.nome && c?.cpf && c?.dataNascimento)) {
                erros.push(`Colaborador ${i + 1}: preencha nome, CPF e data de nascimento.`);
            }
            if (c?.cpf && !validarCPF(c.cpf)) {
                erros.push(`Colaborador ${i + 1}: CPF inválido.`);
            }
        });
        if (erros.length) {
            return NextResponse.json({ error: erros.join(' ') }, { status: 400 });
        }

        const subject = `Adesão – ${empresa.razaoSocial} – Plano ${empresa.cidade || ''}${empresa.uf ? ' - ' + empresa.uf : ''}`;

        const to = process.env.ADESAO_TO!;
        const cc = process.env.ADESAO_CC || '';
        const from = process.env.ADESAO_FROM!;

        if (!process.env.RESEND_API_KEY || !to || !from) {
            return NextResponse.json({ error: 'Configuração de e-mail ausente.' }, { status: 500 });
        }

        const html = emailHtml({ empresa, colaboradores });
        const { error } = await resend.emails.send({
            from,
            to,
            cc: cc ? [cc] : undefined,
            subject,
            html,
        });

        if (error) {
            return NextResponse.json({ error: 'Falha ao enviar e-mail.' }, { status: 502 });
        }
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: 'Erro inesperado.' }, { status: 500 });
    }
}
