// app/faq/page.tsx — SERVER COMPONENT
import type { Metadata } from "next";
import FAQClient from "./FAQClient";

export const metadata: Metadata = {
  title: "Perguntas Frequentes (FAQ) – Adesão Contrato Seguros",
  description:
    "Dúvidas sobre vigência da cobertura, emissão de apólice, relação entre boleto e contrato, problemas para abrir o boleto e datas de vencimento.",
  alternates: {
    canonical: "https://adesaocontratoseguros.site/faq",
  },
};

export default function Page({
  searchParams,
}: {
  searchParams: { ok?: string; success?: string };
}) {
  const showSuccess = Boolean(searchParams?.ok || searchParams?.success);
  return <FAQClient showSuccess={showSuccess} />;
}
