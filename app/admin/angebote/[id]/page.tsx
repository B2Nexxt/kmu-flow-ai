import { notFound } from "next/navigation";
import { AngebotsAkteView } from "@/app/admin/angebote/[id]/angebots-akte-view";
import { getAngebotAkte } from "@/lib/angebote/get-angebot-akte";

type AngebotsAktePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function AngebotsAktePage({
  params,
  searchParams,
}: AngebotsAktePageProps) {
  const { id } = await params;
  const { created } = await searchParams;
  const akte = await getAngebotAkte(id);

  if (!akte) {
    notFound();
  }

  return (
    <AngebotsAkteView
      akte={akte}
      showCreatedInitially={created === "true"}
    />
  );
}
