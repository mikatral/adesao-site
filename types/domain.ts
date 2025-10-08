export type EnvioModo = 'form' | 'pdf' | 'excel';


// types/domain.ts
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
  nomeMae?: string;
};

// Validações mínimas em runtime (para tipar com segurança após parse de JSON)
export function isEmpresa(x: unknown): x is Empresa {
  if (!x || typeof x !== 'object') return false;
  const e = x as Partial<Empresa>;
  return !!(
    e.razaoSocial &&
    e.cnpj &&
    e.email &&
    e.telefone &&
    e.atendente
  );
}
