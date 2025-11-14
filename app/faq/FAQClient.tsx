"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";

export default function FAQClient({ showSuccess = false }: { showSuccess?: boolean }) {
  const [query, setQuery] = useState("");
  const [showBanner, setShowBanner] = useState(showSuccess);


  // ---- Conteúdo (Q&A) -------------------------------------------------------
  const faqs = useMemo(
    () => [
      {
        q: "Quando inicia a cobertura do seguro de vida?",
        a:
          "A cobertura do seguro de vida começa no dia seguinte ao pagamento do boleto de adesão.",
      },
      {
        q: "Quando começa a utilizar a telemedicina?",
        a:
          "A utilização da telemedicina começa no mês seguinte ao pagamento do boleto de adesão (ou do boleto que incluiu o novo funcionário).\n\n" +
          "📅 Exemplo:\n" +
          "Se o boleto vence em 15/07, o colaborador pode usar a telemedicina a partir de 15/08.\n\n" +
          "A data do boleto é sempre a referência para o início da cobertura.",
      },
      {
        q: "Quando começa a utilizar o plano odontológico?",
        a:
          "O plano odontológico pode ser utilizado a partir do mês seguinte ao pagamento do boleto de adesão (ou do boleto que incluiu o novo funcionário).\n\n" +
          "📅 Exemplo:\n" +
          "Se o boleto vence em 15/07, a cobertura odontológica começa em 15/08.\n\n" +
          "A data do boleto é sempre a referência para o início da vigência do convênio.",
      },
      {
        q: "Qual a data dos próximos vencimentos?",
        a:
          "Os boletos vencem todo dia 15 de cada mês.\n\n" +
          "💡 Após o primeiro pagamento (que representa a adesão), os próximos vencimentos serão sempre no dia 15 dos meses seguintes — e os boletos costumam ser enviados por e-mail pela HS Assessoria todo dia 11.",
      },
      {
        q: "Quando é emitida a apólice do seguro?",
        a:
          "A apólice é emitida no mês subsequente ao pagamento e será enviada diretamente pela seguradora ao e-mail cadastrado no momento da adesão.",
      },
      {
        q: "Como faço para retirar os próximos boletos?",
        a:
          "Você pode acessar o sistema de gestão de cobrança pelo [link da HS] ou entrar em contato com a HS Assessoria pelo WhatsApp ou e-mail.\n\n" +
          "Caso não haja movimentação de colaboradores, o boleto será enviado automaticamente todo dia 11 de cada mês para o e-mail cadastrado.",
      },
      {
        q: "Como faço para incluir ou excluir colaboradores?",
        a:
          "As movimentações podem ser realizadas diretamente pelo sistema da HS Assessoria (www.hsassessoria.com.br/app) ou entrando em contato pelos canais abaixo:\n\n" +
          "📧 E-mail: atendimento@hsassessoria.com.br\n" +
          "📱 WhatsApp: (11) 2898-3999\n\n" +
          "O período para realizar inclusões e exclusões é do dia 20 ao dia 09 de cada mês, referente ao boleto com vencimento no dia 15.",
      },
      {
        q: "Como solicitar cópia da apólice?",
        a:
          "A apólice será enviada diretamente pela seguradora para o e-mail cadastrado em até 30 dias após o pagamento.\n\n" +
          "Caso precise do documento antes, por motivo de REPIS, solicite uma Declaração de Adesão pelo nosso WhatsApp e envie o comprovante de pagamento.",
      },
      {
        q: "Como meus funcionários têm acesso ao plano odontológico?",
        a:
          "O plano odontológico pode ser utilizado conforme a necessidade de cada funcionário.\n\n" +
          "Para saber quais clínicas e procedimentos estão disponíveis, basta seguir as orientações completas no guia do plano odontológico.",
      },

      {
        q: "Como meus funcionários têm acesso à Telemedicina?",
        a:
          "O acesso à telemedicina varia conforme a convenção coletiva da empresa.\n\n" +
          "📍 Convenções Coletivas de Ribeirão, Barretos, Araraquara, Campos do Jordão, São José dos Campos e Itapeva:\n" +
          "O acesso é feito pela Infinity, conforme previsto em convenção coletiva.\n\n" +
          "📍 Demais Convenções Coletivas:\n" +
          "O acesso é realizado através do aplicativo Vida Class.",
      },

      {
        q: "Não consigo incluir ou excluir funcionários. O que fazer?",
        a:
          "Favor entrar em contato com a HS Assessoria pelos canais abaixo:\n\n" +
          "📱 WhatsApp: (11) 2898-3999\n" +
          "📧 E-mail: atendimento@hsassessoria.com.br",
      },
      {
        q: "Tenho parcelas em aberto. Como pagar?",
        a:
          "Favor entrar em contato conosco pelos canais abaixo para regularização dos boletos:\n\n" +
          "📱 WhatsApp: (11) 9 3237-1093",
      },
    ],
    []
  );



  // ---- Busca ---------------------------------------------------------------
  const normalize = (s: string) =>
    s.normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase();

  const filtered = useMemo(() => {
    if (!query) return faqs;
    const q = normalize(query);
    return faqs.filter(({ q: question, a }) =>
      (question + " " + a).split(/\s+/).some((chunk) => normalize(chunk).includes(q))
    );
  }, [query, faqs]);

  // ---- JSON-LD -------------------------------------------------------------
  const faqJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a.replace(/\n/g, "<br/>") },
      })),
    }),
    [faqs]
  );

  // ---- Efeitos do banner ---------------------------------------------------
  useEffect(() => {
    if (!showBanner) return;
    const t = setTimeout(() => setShowBanner(false), 3500);
    return () => clearTimeout(t);
  }, [showBanner]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {/* JSON-LD via next/script */}
      <Script
        id="faq-ld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Banner de confirmação sobreposto */}
      {showBanner && (
        <div className="banner-wrapper" aria-live="polite" aria-atomic>
          <div className="banner">
            <strong>Dados enviados com sucesso</strong>
          </div>
        </div>
      )}

      <div className={showBanner ? "content dimming" : "content"}>
        <h1 className="text-2xl font-semibold tracking-tight">Perguntas Frequentes</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Dúvidas sobre vigência, apólice, boleto e datas de vencimento.
        </p>

        <div className="mt-6">
          <label htmlFor="faq-search" className="sr-only">
            Buscar nas perguntas
          </label>
          <input
            id="faq-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por palavra-chave (ex.: vigência, apólice, boleto)"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none ring-0 focus:border-neutral-400"
            aria-describedby="faq-search-help"
          />
          <div id="faq-search-help" className="mt-1 text-xs text-neutral-500">
            Dica: digite parte do termo para filtrar.
          </div>
        </div>

        <div className="mt-8 divide-y divide-neutral-200">
          {filtered.length === 0 && (
            <p className="py-6 text-sm text-neutral-600">
              Nada encontrado. Tente outros termos.
            </p>
          )}

          {filtered.map(({ q, a }, idx) => (
            <details key={idx} className="group py-4" aria-label={`Pergunta ${idx + 1}`}>
              <summary className="cursor-pointer list-none pr-8 text-base font-medium outline-none">
                <span className="inline-flex items-start gap-2">
                  <span className="mt-0.5 inline-block h-5 w-5 shrink-0 rounded-full border border-neutral-300 text-center text-xs leading-5 text-neutral-500">
                    {idx + 1}
                  </span>
                  {q}
                </span>
                <span className="float-right ml-2 select-none text-neutral-400 transition-transform group-open:rotate-180">
                  ▼
                </span>
              </summary>

              <div className="mt-3 pl-7 text-sm leading-6 text-neutral-700 whitespace-pre-line">
                {a}

                {q === "Como meus funcionários têm acesso ao plano odontológico?" && (
                  <>
                    {"\n\n"}
                    📎{" "}
                    <a
                      href="/downloads/odonto/guia"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Clique aqui para baixar o PDF de orientações do plano odontológico
                    </a>
                  </>
                )}

                {q === "Como meus funcionários têm acesso à Telemedicina?" && (
                  <>
                    {"\n\n"}
                    📎{" "}
                    <a
                      href="/downloads/telemedicina/infinity"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Clique aqui para baixar o PDF de orientações da Telemedicina – Infinity
                    </a>
                    {"\n"}
                    📎{" "}
                    <a
                      href="/downloads/telemedicina/vida-class"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Clique aqui para baixar o PDF de orientações da Telemedicina – Vida Class
                    </a>
                  </>
                )}
              </div>
            </details>
          ))}

        </div>

        <hr className="my-10" />

        <section aria-labelledby="ajuda">
          <h2 id="ajuda" className="text-lg font-semibold">
            Ainda com dúvidas?
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Fale com nosso time: <a className="underline" href="mailto:atendimento@contratoseguros.com.br">atendimento@contratoseguros.com.br</a> ·
            <a className="underline ml-1" href="https://wa.me/551128983999" target="_blank" rel="noopener noreferrer">WhatsApp (11) 2898-3999</a>
          </p>
        </section>
      </div>

      <style jsx>{`
        /* Overlay que não bloqueia interação de fundo */
        .banner-wrapper {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          pointer-events: none; /* permite navegar no FAQ por baixo */
          z-index: 50;
          animation: backdropFade 220ms ease-out;
        }
        .banner {
          pointer-events: none;
          background: rgba(0, 0, 0, 0.8);
          color: #fff;
          padding: 24px 28px;
          border-radius: 16px;
          font-size: 22px;
          font-weight: 600;
          text-align: center;
          letter-spacing: 0.2px;
          box-shadow: 0 10px 40px rgba(0,0,0,.35);
          animation: bannerFade 1800ms ease forwards;
        }
        .content { opacity: 1; transition: opacity 420ms ease; }
        .content.dimming { opacity: 0.35; animation: contentFadeIn 800ms ease 400ms forwards; }

        @keyframes bannerFade {
          0% { opacity: 0; transform: translateY(6px) scale(0.99); }
          12% { opacity: 1; transform: translateY(0) scale(1); }
          70% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-6px) scale(0.985); }
        }
        @keyframes contentFadeIn {
          0% { opacity: 0.35; }
          100% { opacity: 1; }
        }
        @keyframes backdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </main>
  );
}
