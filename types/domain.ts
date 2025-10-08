// app/types/domain.ts

// Modo de envio usado na página (formulário na tela, PDF ou Excel)
export type EnvioModo = 'form' | 'pdf' | 'excel';

export type Empresa = {
  razaoSocial: string;
  cnpj: string;
  email: string;
  telefone: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  atendente: string;
};

export type Colaborador = {
  nome: string;
  cpf: string;
  dataNascimento: string; // dd/mm/aaaa
  nomeMae: string;        // pode ser vazio ("")
};

// ---------- Type guards (runtime) ----------

function isString(x: unknown): x is string {
  return typeof x === 'string';
}
function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.trim().length > 0;
}

export function isEmpresa(x: unknown): x is Empresa {
  if (!x || typeof x !== 'object') return false;
  const e = x as Partial<Record<keyof Empresa, unknown>>;

  // obrigatórios devem ser string não vazia
  if (!isNonEmptyString(e.razaoSocial)) return false;
  if (!isNonEmptyString(e.cnpj)) return false;
  if (!isNonEmptyString(e.email)) return false;
  if (!isNonEmptyString(e.telefone)) return false;
  if (!isNonEmptyString(e.atendente)) return false;

  // opcionais, se presentes, precisam ser string
  if (e.cidade != null && !isString(e.cidade)) return false;
  if (e.uf != null && !isString(e.uf)) return false;
  if (e.cep != null && !isString(e.cep)) return false;

  return true;
}

export function isColaborador(x: unknown): x is Colaborador {
  if (!x || typeof x !== 'object') return false;
  const c = x as Partial<Record<keyof Colaborador, unknown>>;
  // todos são string; nomeMae pode ser vazio
  return (
    isNonEmptyString(c.nome) &&
    isNonEmptyString(c.cpf) &&
    isNonEmptyString(c.dataNascimento) &&
    isString(c.nomeMae)
  );
}

// Payload do POST /api/adesao (modo formulário)
export type AdesaoPayload = {
  empresa: Empresa;
  colaboradores: Colaborador[];
};

export function isAdesaoPayload(x: unknown): x is AdesaoPayload {
  if (!x || typeof x !== 'object') return false;
  const p = x as Partial<AdesaoPayload>;
  if (!isEmpresa(p.empresa)) return false;
  if (!Array.isArray(p.colaboradores)) return false;
  for (const item of p.colaboradores) {
    if (!isColaborador(item)) return false;
  }
  return true;
}
