import { notFound } from "next/navigation";
import { MandantenAkteView } from "./mandanten-akte-view";
import { getMandantAkte } from "@/lib/mandanten/get-mandant-akte";

type MandantenAktePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function MandantenAktePage({
  params,
  searchParams,
}: MandantenAktePageProps) {
  const { id } = await params;
  const { created } = await searchParams;
  const akte = await getMandantAkte(id);

  if (!akte) {
    notFound();
  }

  return (
    <MandantenAkteView
      akte={akte}
      showCreatedInitially={created === "true"}
    />
  );
}
