import { notFound } from "next/navigation";
import { MandantenAkteView } from "./mandanten-akte-view";
import { getMandantAngeboteList } from "@/lib/angebote/get-mandant-angebote-list";
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
  const [akte, angebote] = await Promise.all([
    getMandantAkte(id),
    getMandantAngeboteList(id),
  ]);

  if (!akte) {
    notFound();
  }

  return (
    <MandantenAkteView
      akte={akte}
      showCreatedInitially={created === "true"}
      angebote={angebote}
    />
  );
}
