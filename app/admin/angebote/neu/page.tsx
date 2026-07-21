import Link from "next/link";
import { NeuesAngebotForm } from "@/app/admin/angebote/neu/neues-angebot-form";
import { getOrganizationSelectOptions } from "@/lib/angebote/get-organization-select-options";

export const dynamic = "force-dynamic";

const buttonSecondaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 px-6 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

type NeuesAngebotPageProps = {
  searchParams: Promise<{ organizationId?: string }>;
};

export default async function NeuesAngebotPage({
  searchParams,
}: NeuesAngebotPageProps) {
  const { organizationId } = await searchParams;
  const organizations = await getOrganizationSelectOptions();
  const normalizedOrganizationId = organizationId?.trim();
  const initialOrganizationId =
    normalizedOrganizationId &&
    organizations.some((organization) => organization.id === normalizedOrganizationId)
      ? normalizedOrganizationId
      : undefined;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-8 py-5 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          KMU Flow AI
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Plattform-Admin
        </h1>
      </header>

      <main className="p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Neues Angebot
              </h2>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                Angebotsentwurf für einen Mandanten anlegen.
              </p>
            </div>
            <Link href="/admin" className={buttonSecondaryClassName}>
              Zurück zum Dashboard
            </Link>
          </div>

          <NeuesAngebotForm
            organizations={organizations}
            initialOrganizationId={initialOrganizationId}
          />
        </div>
      </main>
    </div>
  );
}
