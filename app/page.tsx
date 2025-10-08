'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Empresa, Colaborador, EnvioModo } from '@/types/domain';

function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '');
}

// --- Validação CPF/CNPJ (dígitos verificadores) ---
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
function validarTelefoneBR(s: string) {
  const d = onlyDigits(s);
  return d.length === 10 || d.length === 11; // DDD+fixo ou DDD+cel
}

function formatCPF(s: string) {
  const d = onlyDigits(s).slice(0, 11);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 9);
  const p4 = d.slice(9, 11);
  let out = p1;
  if (p2) out += (out ? '.' : '') + p2;
  if (p3) out += '.' + p3;
  if (p4) out += '-' + p4;
  return out;
}

// Normaliza nome para comparar (sem acentos, minúsculo, espaços únicos)
function normName(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function normKey(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function isDataBR(s: string) {
  const m = (s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return d.getFullYear() === Number(yyyy) && d.getMonth() === Number(mm) - 1 && d.getDate() === Number(dd);
}

// Converte número de data do Excel -> dd/mm/aaaa
function excelSerialToBRDate(serial: number) {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Normaliza data de várias formas para dd/mm/aaaa (sem any)
function normalizeDateAny(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) return excelSerialToBRDate(v);
  const s = String(v).trim();
  const rx = [
    /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/, // dd/mm/aaaa ou dd-mm-aaaa
    /^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/, // aaaa-mm-dd
  ];
  for (const r of rx) {
    const m = s.match(r);
    if (m) {
      if (r === rx[0]) {
        const [, dd, mm, yyyy] = m;
        return `${dd}/${mm}/${yyyy}`;
      } else {
        const [, yyyy, mm, dd] = m;
        return `${dd}/${mm}/${yyyy}`;
      }
    }
  }
  return s;
}

function colabCompleto(c: Colaborador) {
  return !!(c.nome && validarCPF(c.cpf) && isDataBR(c.dataNascimento));
}

// Utilitário para setar largura de colunas sem usar "any"
function setSheetCols(ws: object, cols: Array<{ wch: number }>) {
  (ws as Record<string, unknown>)['!cols'] = cols;
}

export default function Home() {
  const [step, setStep] = useState<1 | 2>(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const MAX_PDF_MB = 10;
  const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;

  const [envioModo, setEnvioModo] = useState<EnvioModo>('form');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const pdfOnlyInputRef = useRef<HTMLInputElement | null>(null);
  const [xlsFile, setXlsFile] = useState<File | null>(null);
  const xlsOnlyInputRef = useRef<HTMLInputElement | null>(null);

  // Empresa
  const [empresa, setEmpresa] = useState<Empresa>({
    razaoSocial: '',
    cnpj: '',
    email: '',
    telefone: '',
    cidade: '',
    uf: '',
    cep: '',
    atendente: '',
  });
  const cnpjValido = useMemo(() => validarCNPJ(empresa.cnpj), [empresa.cnpj]);

  // Colaboradores
  const [colabs, setColabs] = useState<Colaborador[]>([
    { nome: '', cpf: '', dataNascimento: '', nomeMae: '' },
  ]);
  const addColab = () =>
    setColabs((prev) => [...prev, { nome: '', cpf: '', dataNascimento: '', nomeMae: '' }]);
  const removeColab = (idx: number) => setColabs((prev) => prev.filter((_, i) => i !== idx));

  // Baixa um modelo Excel (.xlsx) com cabeçalhos e 1 linha de exemplo
  async function downloadXlsxTemplate() {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const rows = [
      ['Nome', 'CPF', 'Data de Nascimento', 'Nome da Mãe'],
      ['JOÃO DA SILVA', '529.982.247-25', '01/02/1990', 'MARIA DA SILVA'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Larguras de coluna (sem any)
    setSheetCols(ws, [{ wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 30 }]);

    XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_colaboradores.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Lê arquivo (xlsx/xls/csv), faz validação e MERGE com a lista atual
  async function handleFileUpload(file: File) {
    if (!file) return;
    const XLSX = await import('xlsx');

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

    if (!rows.length) {
      alert('A planilha está vazia.');
      return;
    }

    // Mapeia cabeçalhos tolerantes
    const mapKey = (obj: Record<string, unknown>, wanted: string[]): string | undefined => {
      const keys = Object.keys(obj);
      for (const k of keys) {
        const nk = normKey(k);
        for (const w of wanted) {
          if (nk === normKey(w)) return k;
        }
      }
      return undefined;
    };

    const sample = rows[0];
    const keyNome = mapKey(sample, ['Nome']);
    const keyCPF = mapKey(sample, ['CPF']);
    const keyDN = mapKey(sample, ['Data de Nascimento', 'Nascimento', 'DataNascimento']);
    const keyMae = mapKey(sample, ['Nome da Mãe', 'Nome da Mae', 'Mae']); // opcional

    if (!keyNome || !keyCPF || !keyDN) {
      alert('Cabeçalhos esperados: Nome, CPF, Data de Nascimento (Nome da Mãe é opcional).');
      return;
    }

    // 1) Validação linha a linha
    const validos: Colaborador[] = [];
    const rejeitados: string[] = [];

    rows.forEach((r, idx) => {
      const lineNo = idx + 2;
      const nome = String((r as Record<string, unknown>)[keyNome] ?? '').trim();
      const cpf = formatCPF(String((r as Record<string, unknown>)[keyCPF] ?? ''));
      const dn = normalizeDateAny((r as Record<string, unknown>)[keyDN] ?? '');
      const mae = keyMae ? String((r as Record<string, unknown>)[keyMae] ?? '').trim() : '';

      const motivos: string[] = [];
      if (!nome) motivos.push('Nome vazio');
      if (!cpf || !validarCPF(cpf)) motivos.push('CPF inválido');
      if (!dn || !isDataBR(dn)) motivos.push('Data inválida (use dd/mm/aaaa)');

      if (motivos.length === 0) {
        validos.push({ nome, cpf, dataNascimento: dn, nomeMae: mae });
      } else {
        rejeitados.push(`Linha ${lineNo}: ${motivos.join('; ')}`);
      }
    });

    if (validos.length === 0) {
      alert('Nenhuma linha válida encontrada.\n\nProblemas:\n- ' + rejeitados.join('\n- '));
      return;
    }

    // 2) MERGE com a lista atual (sem duplicar)
    setColabs((prev) => {
      const isOnlyEmpty =
        prev.length === 1 &&
        !prev[0].nome &&
        !prev[0].cpf &&
        !prev[0].dataNascimento &&
        !prev[0].nomeMae;

      const base = isOnlyEmpty ? ([] as Colaborador[]) : [...prev];

      const cpfIndex = new Map<string, number>();
      const nameIndex = new Map<string, number>();
      base.forEach((c, i) => {
        const cpfK = onlyDigits(c.cpf || '');
        if (cpfK) cpfIndex.set(cpfK, i);
        nameIndex.set(normName(c.nome), i);
      });

      const adicionados: Colaborador[] = [];
      const atualizados: string[] = [];
      const conflitos: string[] = [];

      for (const novo of validos) {
        const cpfK = onlyDigits(novo.cpf);
        const nameK = normName(novo.nome);

        if (cpfK && cpfIndex.has(cpfK)) {
          const idx = cpfIndex.get(cpfK)!;
          const old = base[idx];
          const merged: Colaborador = {
            nome: old.nome || novo.nome,
            cpf: old.cpf || novo.cpf,
            dataNascimento: old.dataNascimento || novo.dataNascimento,
            nomeMae: old.nomeMae || novo.nomeMae,
          };
          base[idx] = merged;
          atualizados.push(`CPF ${novo.cpf} (${novo.nome})`);
          continue;
        }

        if (nameIndex.has(nameK)) {
          const idx = nameIndex.get(nameK)!;
          const old = base[idx];
          const oldCpfK = onlyDigits(old.cpf || '');
          if (!oldCpfK || oldCpfK === cpfK || !cpfK) {
            const merged: Colaborador = {
              nome: old.nome || novo.nome,
              cpf: old.cpf || novo.cpf,
              dataNascimento: old.dataNascimento || novo.dataNascimento,
              nomeMae: old.nomeMae || novo.nomeMae,
            };
            base[idx] = merged;
            if (!oldCpfK && cpfK) cpfIndex.set(cpfK, idx);
            atualizados.push(`Nome ${novo.nome}`);
          } else {
            conflitos.push(`Nome ${novo.nome}: CPF atual ${old.cpf} ≠ importado ${novo.cpf}`);
          }
          continue;
        }

        if (cpfK) cpfIndex.set(cpfK, base.length);
        nameIndex.set(nameK, base.length);
        base.push(novo);
        adicionados.push(novo);
      }

      let msg = `Importação concluída.`;
      if (adicionados.length) msg += `\nAdicionados: ${adicionados.length}`;
      if (atualizados.length) msg += `\nAtualizados: ${atualizados.length}`;
      if (rejeitados.length) msg += `\nIgnorados (inválidos): ${rejeitados.length}`;
      if (conflitos.length) msg += `\nConflitos (mesmo nome com CPF diferente): ${conflitos.length}`;
      if (rejeitados.length || conflitos.length) {
        msg += `\n\nDetalhes:\n`;
        if (rejeitados.length) msg += `- Inválidos:\n  - ${rejeitados.join('\n  - ')}\n`;
        if (conflitos.length) msg += `- Conflitos:\n  - ${conflitos.join('\n  - ')}`;
      }
      alert(msg);

      return base;
    });
  }

  // Auto-preencher cidade/UF/CEP/razão social pelo CNPJ quando válido
  useEffect(() => {
    let abort = false;
    async function fetchCNPJ() {
      if (!cnpjValido) return;
      const url = `/api/cnpj?cnpj=${encodeURIComponent(empresa.cnpj)}`;
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error('Falha ao consultar CNPJ');
        const j: unknown = await r.json();

        if (!abort) {
          const jo = (j as Record<string, unknown>) || {};
          const origem = (jo['origem'] as Record<string, unknown>) || {};
          const bruto = (jo['bruto'] as Record<string, unknown>) || {};

          setEmpresa((e) => ({
            ...e,
            cidade: typeof origem.cidade === 'string' ? origem.cidade : e.cidade,
            uf: typeof origem.uf === 'string' ? origem.uf : e.uf,
            cep: typeof origem.cep === 'string' ? origem.cep : e.cep,
            razaoSocial:
              typeof (bruto as Record<string, unknown>)['razao_social'] === 'string'
                ? String((bruto as Record<string, unknown>)['razao_social'])
                : e.razaoSocial,
            email: e.email, // não sobrescreve
          }));
        }
      } catch {
        // mantém dados manuais
      }
    }
    fetchCNPJ();
    return () => {
      abort = true;
    };
  }, [cnpjValido, empresa.cnpj]);

  // Handlers
  const handleEmpresaChange = <K extends keyof Empresa>(campo: K, valor: Empresa[K]) => {
    setEmpresa((prev) => ({ ...prev, [campo]: valor } as Empresa));
  };
  const handleColabChange = (i: number, k: keyof Colaborador, v: string) =>
    setColabs((prev) => prev.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));

  const podeIrParaStep2 = useMemo(() => {
    return (
      cnpjValido &&
      empresa.razaoSocial.trim().length > 1 &&
      /.+@.+\..+/.test(empresa.email) &&
      validarTelefoneBR(empresa.telefone) &&
      empresa.atendente.trim().length > 1
    );
  }, [cnpjValido, empresa.razaoSocial, empresa.email, empresa.telefone, empresa.atendente]);

  const [tenteiEnviar, setTenteiEnviar] = useState(false);

  const todosCPFsValidos = useMemo(() => {
    return colabs.every((c) => c.cpf && validarCPF(c.cpf));
  }, [colabs]);

  const podeAdicionarColab = useMemo(() => {
    const ultimo = colabs[colabs.length - 1];
    return colabCompleto(ultimo);
  }, [colabs]);

  async function handleSubmit() {
    setTenteiEnviar(true);

    // MODO PDF
    if (envioModo === 'pdf') {
      if (!podeIrParaStep2) {
        alert('Preencha os dados da empresa corretamente.');
        return;
      }
      if (!pdfFile) {
        alert('Selecione um PDF com a lista de colaboradores.');
        return;
      }

      const form = new FormData();
      form.append('modo', 'pdf');
      form.append('empresa', JSON.stringify(empresa));
      form.append('pdf', pdfFile, pdfFile.name);

      const r = await fetch('/api/adesao', { method: 'POST', body: form });

      if (r.ok) {
        alert('PDF enviado! Você receberá a confirmação quando o envio por e-mail estiver ativo.');
        // reset
        setStep(1);
        setEnvioModo('form');
        setPdfFile(null);
        setTenteiEnviar(false);
        if (pdfOnlyInputRef.current) pdfOnlyInputRef.current.value = '';
        setEmpresa({
          razaoSocial: '',
          cnpj: '',
          email: '',
          telefone: '',
          cidade: '',
          uf: '',
          cep: '',
          atendente: '',
        });
        setColabs([{ nome: '', cpf: '', dataNascimento: '', nomeMae: '' }]);
      } else {
        const j = await r.json().catch(() => ({}));
        alert(`Falha ao enviar PDF: ${(j as Record<string, unknown>)?.['error'] ?? r.statusText}`);
      }
      return;
    }

    // MODO EXCEL
    if (envioModo === 'excel') {
      if (!podeIrParaStep2) {
        alert('Preencha os dados da empresa corretamente.');
        return;
      }
      if (!xlsFile) {
        alert('Selecione um Excel (.xlsx ou .xls).');
        return;
      }
      if (xlsFile.size > MAX_PDF_BYTES) {
        alert(`O arquivo tem ${(xlsFile.size / 1024 / 1024).toFixed(1)} MB. O limite é ${MAX_PDF_MB} MB.`);
        return;
      }

      const form = new FormData();
      form.append('modo', 'excel');
      form.append('empresa', JSON.stringify(empresa));
      form.append('xls', xlsFile, xlsFile.name);

      const r = await fetch('/api/adesao', { method: 'POST', body: form });

      if (r.ok) {
        alert('Excel enviado! Você receberá a confirmação por e-mail (quando o envio estiver ativo).');
        // reset
        setStep(1);
        setEnvioModo('form');
        setXlsFile(null);
        setTenteiEnviar(false);
        if (xlsOnlyInputRef.current) xlsOnlyInputRef.current.value = '';
        setEmpresa({
          razaoSocial: '',
          cnpj: '',
          email: '',
          telefone: '',
          cidade: '',
          uf: '',
          cep: '',
          atendente: '',
        });
        setColabs([{ nome: '', cpf: '', dataNascimento: '', nomeMae: '' }]);
      } else {
        const j = await r.json().catch(() => ({}));
        alert(`Falha ao enviar Excel: ${(j as Record<string, unknown>)?.['error'] ?? r.statusText}`);
      }
      return;
    }

    // MODO FORMULÁRIO
    if (!todosCPFsValidos) {
      return;
    }

    const erros: string[] = [];
    if (!podeIrParaStep2) erros.push('Preencha os dados da empresa corretamente.');
    colabs.forEach((c, i) => {
      if (!(c.nome && c.cpf && c.dataNascimento)) {
        erros.push(`Colaborador ${i + 1}: preencha nome, CPF e data de nascimento.`);
      }
      if (c.cpf && !validarCPF(c.cpf)) {
        erros.push(`Colaborador ${i + 1}: CPF inválido.`);
      }
    });
    if (erros.length) {
      alert(erros.join('\n'));
      return;
    }

    const payload = { empresa, colaboradores: colabs };

    const r = await fetch('/api/adesao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (r.ok) {
      alert('Enviado com sucesso! Você receberá o e-mail com os dados (quando o envio estiver ativo).');
      setStep(1);
      setEmpresa({
        razaoSocial: '',
        cnpj: '',
        email: '',
        telefone: '',
        cidade: '',
        uf: '',
        cep: '',
        atendente: '',
      });
      setColabs([{ nome: '', cpf: '', dataNascimento: '', nomeMae: '' }]);
      setTenteiEnviar(false);
    } else {
      const j = await r.json().catch(() => ({}));
      alert(`Falha ao enviar: ${(j as Record<string, unknown>)?.['error'] ?? r.statusText}`);
    }
  }

  return (
    <main style={{ maxWidth: 860, margin: '40px auto', padding: 24 }}>
      <h1>Adesão – HS</h1>
      <p style={{ color: '#555' }}>Preencha os dados abaixo. O envio encaminha para nossa equipe.</p>

      {/* STEP 1 - Empresa */}
      <section style={{ marginTop: 24, padding: 16, border: '1px solid #eee', borderRadius: 12 }}>
        <h2>1) Dados da Empresa</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>
            Razão Social*
            <input
              value={empresa.razaoSocial}
              onChange={(e) => handleEmpresaChange('razaoSocial', e.target.value)}
              placeholder="ACME LTDA"
            />
          </label>
          <label>
            CNPJ* {cnpjValido ? '✅' : ''}
            <input
              value={empresa.cnpj}
              onChange={(e) => handleEmpresaChange('cnpj', e.target.value)}
              placeholder="00.000.000/0001-00"
            />
          </label>
          <label>
            E-mail da empresa*
            <input
              type="email"
              value={empresa.email}
              onChange={(e) => handleEmpresaChange('email', e.target.value)}
              placeholder="contato@empresa.com.br"
            />
          </label>
          <label>
            CEP
            <input
              value={empresa.cep || ''}
              onChange={(e) => handleEmpresaChange('cep', e.target.value)}
              placeholder="00000-000"
              maxLength={9}
            />
          </label>
          <label>
            Telefone*
            <input
              value={empresa.telefone}
              onChange={(e) => handleEmpresaChange('telefone', e.target.value)}
              placeholder="(11) 99999-9999"
            />
            {empresa.telefone && !validarTelefoneBR(empresa.telefone) && (
              <span style={{ color: '#b00', fontSize: 12, marginTop: 4 }}>
                Telefone inválido (use DDD + número).
              </span>
            )}
          </label>
          <label>
            Cidade
            <input
              value={empresa.cidade || ''}
              onChange={(e) => handleEmpresaChange('cidade', e.target.value)}
              placeholder="São José do Rio Preto"
            />
          </label>
          <label>
            UF
            <input
              value={empresa.uf || ''}
              onChange={(e) => handleEmpresaChange('uf', e.target.value.toUpperCase())}
              placeholder="SP"
              maxLength={2}
            />
          </label>
          <label>
            Primeiro Nome*
            <input
              value={empresa.atendente}
              onChange={(e) => handleEmpresaChange('atendente', e.target.value)}
              placeholder="Insira seu nome"
            />
          </label>
        </div>

        <div style={{ marginTop: 16 }}>
          <button disabled={!podeIrParaStep2} onClick={() => setStep(2)} style={{ opacity: podeIrParaStep2 ? 1 : 0.5 }}>
            Prosseguir para colaboradores
          </button>
          {!cnpjValido && <p style={{ color: '#b00', marginTop: 8 }}>Informe um CNPJ válido para continuar.</p>}
        </div>
      </section>

      {/* STEP 2 - Colaboradores */}
      {step === 2 && (
        <section style={{ marginTop: 24, padding: 16, border: '1px solid #eee', borderRadius: 12 }}>
          <h2>2) Colaboradores</h2>

          {/* Seletor de modo de envio */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="radio" name="modo" value="form" checked={envioModo === 'form'} onChange={() => setEnvioModo('form')} />
              Preencher/Importar na tela
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="radio" name="modo" value="pdf" checked={envioModo === 'pdf'} onChange={() => setEnvioModo('pdf')} />
              Anexar PDF com a lista (sem leitura)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="radio" name="modo" value="excel" checked={envioModo === 'excel'} onChange={() => setEnvioModo('excel')} />
              Anexar Excel com a lista (sem leitura)
            </label>
          </div>

          {envioModo === 'pdf' && (
            <>
              <div style={{ border: '1px dashed #bbb', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <strong>Anexar PDF com a lista de colaboradores</strong>
                <p style={{ margin: '6px 0 10px', color: '#555' }}>
                  Selecione um arquivo <strong>.pdf</strong> (máx. {MAX_PDF_MB} MB). O arquivo será enviado em anexo (não faremos leitura do
                  conteúdo).
                </p>

                <input
                  ref={pdfOnlyInputRef}
                  type="file"
                  accept="application/pdf"
                  onClick={(e) => {
                    (e.currentTarget as HTMLInputElement).value = '';
                  }}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && f.size > MAX_PDF_BYTES) {
                      alert(`O PDF tem ${(f.size / 1024 / 1024).toFixed(1)} MB. O limite é ${MAX_PDF_MB} MB.`);
                      setPdfFile(null);
                      (e.currentTarget as HTMLInputElement).value = '';
                      return;
                    }
                    setPdfFile(f);
                  }}
                />

                {pdfFile && (
                  <p style={{ marginTop: 8, fontSize: 12, color: '#444' }}>
                    Selecionado: {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(1)} MB)
                  </p>
                )}
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setStep(1);
                    setTenteiEnviar(false);
                    setPdfFile(null);
                    if (pdfOnlyInputRef.current) pdfOnlyInputRef.current.value = '';
                  }}
                  style={{ background: '#eee' }}
                >
                  Voltar
                </button>

                <button onClick={handleSubmit} disabled={!pdfFile || !podeIrParaStep2}>
                  Enviar PDF
                </button>
              </div>
            </>
          )}

          {envioModo === 'excel' && (
            <>
              <div style={{ border: '1px dashed #bbb', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <strong>Anexar Excel com a lista de colaboradores</strong>
                <p style={{ margin: '6px 0 10px', color: '#555' }}>
                  Selecione um arquivo <strong>.xlsx</strong> ou <strong>.xls</strong> (máx. {MAX_PDF_MB} MB). O arquivo será enviado em
                  anexo (não faremos leitura).
                </p>

                <input
                  ref={xlsOnlyInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onClick={(e) => {
                    (e.currentTarget as HTMLInputElement).value = '';
                  }}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && f.size > MAX_PDF_BYTES) {
                      alert(`O arquivo tem ${(f.size / 1024 / 1024).toFixed(1)} MB. O limite é ${MAX_PDF_MB} MB.`);
                      setXlsFile(null);
                      (e.currentTarget as HTMLInputElement).value = '';
                      return;
                    }
                    const name = (f?.name || '').toLowerCase();
                    const okExt = name.endsWith('.xlsx') || name.endsWith('.xls');
                    if (f && !okExt) {
                      alert('Escolha um arquivo .xlsx ou .xls.');
                      setXlsFile(null);
                      (e.currentTarget as HTMLInputElement).value = '';
                      return;
                    }
                    setXlsFile(f);
                  }}
                />

                {xlsFile && (
                  <p style={{ marginTop: 8, fontSize: 12, color: '#444' }}>
                    Selecionado: {xlsFile.name} ({(xlsFile.size / 1024 / 1024).toFixed(1)} MB)
                  </p>
                )}
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setStep(1);
                    setTenteiEnviar(false);
                    setXlsFile(null);
                    if (xlsOnlyInputRef.current) xlsOnlyInputRef.current.value = '';
                  }}
                  style={{ background: '#eee' }}
                >
                  Voltar
                </button>

                <button onClick={handleSubmit} disabled={!xlsFile || !podeIrParaStep2}>
                  Enviar Excel
                </button>
              </div>
            </>
          )}

          {envioModo === 'form' && (
            <>
              {/* Importação por planilha */}
              <div style={{ border: '1px dashed #bbb', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <strong>Importar colaboradores por planilha</strong>
                <p style={{ margin: '6px 0 10px', color: '#555' }}>
                  Formatos aceitos: <strong>.xlsx</strong>, .xls (também aceitamos .csv). Cabeçalhos:{' '}
                  <em>Nome</em>, <em>CPF</em>, <em>Data de Nascimento</em> (opcional: <em>Nome da Mãe</em>).
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onClick={(e) => {
                    (e.currentTarget as HTMLInputElement).value = '';
                  }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                />

                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button type="button" style={{ background: '#eee', color: '#111' }} onClick={downloadXlsxTemplate}>
                    Baixar modelo XLSX
                  </button>

                  <button
                    type="button"
                    style={{ background: '#eee', color: '#111' }}
                    onClick={() => setColabs([{ nome: '', cpf: '', dataNascimento: '', nomeMae: '' }])}
                  >
                    Limpar lista
                  </button>
                </div>
              </div>

              {colabs.map((c, i) => (
                <div key={i} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginTop: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label>
                      Nome*
                      <input value={c.nome} onChange={(e) => handleColabChange(i, 'nome', e.target.value)} />
                    </label>
                    <label>
                      CPF*
                      <input
                        value={c.cpf}
                        onChange={(e) => handleColabChange(i, 'cpf', formatCPF(e.target.value))}
                        placeholder="000.000.000-00"
                        maxLength={14}
                      />
                      {c.cpf && !validarCPF(c.cpf) && (
                        <span style={{ color: '#b00', fontSize: 12, marginTop: 4 }}>CPF inválido</span>
                      )}
                    </label>
                    <label>
                      Data de Nascimento* (dd/mm/aaaa)
                      <input
                        value={c.dataNascimento}
                        onChange={(e) => handleColabChange(i, 'dataNascimento', e.target.value)}
                        placeholder="01/02/1990"
                      />
                      {c.dataNascimento && !isDataBR(c.dataNascimento) && (
                        <span style={{ color: '#b00', fontSize: 12, marginTop: 4 }}>
                          Data inválida (use dd/mm/aaaa)
                        </span>
                      )}
                    </label>
                    <label>
                      Nome da Mãe
                      <input value={c.nomeMae} onChange={(e) => handleColabChange(i, 'nomeMae', e.target.value)} />
                    </label>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {colabs.length > 1 && (
                      <button onClick={() => removeColab(i)} style={{ background: '#eee' }}>
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 12 }}>
                <button onClick={addColab} disabled={!podeAdicionarColab}>
                  + Adicionar colaborador
                </button>
                {!podeAdicionarColab && (
                  <p style={{ color: '#b00', fontSize: 12, marginTop: 6 }}>
                    Preencha todos os campos do colaborador atual (CPF válido e data em dd/mm/aaaa) para adicionar
                    outro.
                  </p>
                )}
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setStep(1);
                    setTenteiEnviar(false);
                  }}
                  style={{ background: '#eee' }}
                >
                  Voltar
                </button>
                <button onClick={handleSubmit}>Enviar</button>
              </div>

              {tenteiEnviar && !todosCPFsValidos && (
                <p style={{ color: '#b00', marginTop: 8 }}>Corrija os CPFs inválidos para enviar.</p>
              )}
            </>
          )}
        </section>
      )}

      {/* estilos bem simples */}
      <style jsx>{`
        h1 {
          font-size: 26px;
          margin-bottom: 8px;
        }
        h2 {
          font-size: 18px;
          margin-bottom: 8px;
        }
        label {
          display: flex;
          flex-direction: column;
          font-size: 14px;
          gap: 6px;
        }
        input {
          border: 1px solid #ccc;
          border-radius: 8px;
          padding: 10px;
          font-size: 14px;
        }
        button {
          border: 0;
          border-radius: 8px;
          padding: 10px 14px;
          cursor: pointer;
          background: #0ea5e9;
          color: #fff;
        }
        button[disabled] {
          cursor: not-allowed;
        }
      `}</style>
    </main>
  );
}
