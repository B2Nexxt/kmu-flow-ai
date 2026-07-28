import { notFound } from "next/navigation";

import {
  AnfrageeingangDetailLoadError,
  AnfrageeingangDetailView,
} from "./anfrageeingang-detail-view";
import { loadAnfrageeingangDetail } from "@/lib/anfrageeingang/load-anfrageeingang-detail";

type AnfrageeingangDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hinweis?: string }>;
};

export default async function AnfrageeingangDetailPage({
  params,
  searchParams,
}: AnfrageeingangDetailPageProps) {
  const { id } = await params;
  const { hinweis } = await searchParams;
  const result = await loadAnfrageeingangDetail(id);

  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "error") {
    return <AnfrageeingangDetailLoadError />;
  }

  return (
    <AnfrageeingangDetailView detail={result.detail} successHint={hinweis ?? null} />
  );
}
