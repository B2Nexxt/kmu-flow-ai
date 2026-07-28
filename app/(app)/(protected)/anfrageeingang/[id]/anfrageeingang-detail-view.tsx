import Link from "next/link";

import { VerwerfeAnfrageeingangPanel } from "./verwerfe-anfrageeingang-panel";
import { ArchiviereAnfrageeingangPanel } from "./archiviere-anfrageeingang-panel";
import {
  getAnfrageeingangDetailCreateHintMessage,
} from "@/lib/anfrageeingang/create-anfrageeingang-messages";
import {
  VERWERFE_ANFRAGEEINGANG_ALREADY_DISCARDED_MESSAGE,
  VERWERFE_ANFRAGEEINGANG_SUCCESS_MESSAGE,
} from "@/lib/anfrageeingang/verwerfe-anfrageeingang-messages";
import type { AnfrageeingangDetailViewModel } from "@/lib/anfrageeingang/types";

const sectionClassName =
  "rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";

const sectionTitleClassName =
  "text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

const labelClassName = "text-sm text-zinc-500 dark:text-zinc-400";

const valueClassName = "text-sm text-zinc-900 dark:text-zinc-50";

const jsonPreClassName =
  "mt-2 overflow-x-auto rounded-md bg-zinc-50 p-3 font-mono text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200";

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={labelClassName}>{label}</dt>
      <dd className={`${valueClassName} mt-1`}>{value}</dd>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={sectionClassName}>
      <h2 className={sectionTitleClassName}>{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function JsonBlock({ json }: { json: string }) {
  return <pre className={jsonPreClassName}>{json}</pre>;
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
      {label}
    </span>
  );
}

function DringlichkeitBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
      {label}
    </span>
  );
}

function AbsenderContactField({
  label,
  value,
  hrefPrefix,
}: {
  label: string;
  value: string | null;
  hrefPrefix: "mailto" | "tel";
}) {
  if (!value) {
    return <DetailField label={label} value="Nicht angegeben" />;
  }

  const href = hrefPrefix === "mailto" ? `mailto:${value}` : `tel:${value}`;

  return (
    <div>
      <dt className={labelClassName}>{label}</dt>
      <dd className="mt-1">
        <a
          href={href}
          className="text-sm text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-50 dark:decoration-zinc-600"
        >
          {value}
        </a>
      </dd>
    </div>
  );
}

export function AnfrageeingangDetailView({
  detail,
  successHint,
}: {
  detail: AnfrageeingangDetailViewModel;
  successHint?: string | null;
}) {
  const successMessage =
    getAnfrageeingangDetailCreateHintMessage(successHint) ??
    (successHint === "bereits-verworfen"
      ? VERWERFE_ANFRAGEEINGANG_ALREADY_DISCARDED_MESSAGE
      : successHint === "verworfen"
        ? VERWERFE_ANFRAGEEINGANG_SUCCESS_MESSAGE
        : null);

  return (
    <div className="p-4 sm:p-8">
      <Link
        href="/anfrageeingang"
        className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Zurück zum Anfrageeingang
      </Link>

      {successMessage ? (
        <div
          role="status"
          className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100"
        >
          {successMessage}
        </div>
      ) : null}

      <header className="mt-6 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {detail.eingangsnummer}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {detail.betreffLabel}
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge label={detail.statusLabel} />
          <DringlichkeitBadge label={detail.dringlichkeitLabel} />
        </div>
      </header>

      <div className="mt-8 space-y-6">
        <DetailSection title="Anfrage">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Empfangen am" value={detail.empfangenAmLabel} />
            <DetailField label="Kanal" value={detail.kanalLabel} />
            <DetailField label="Betreff" value={detail.betreffLabel} />
          </dl>
          <div className="mt-4">
            <dt className={labelClassName}>Rohinhalt</dt>
            <dd className={`${valueClassName} mt-2 whitespace-pre-wrap rounded-md bg-zinc-50 p-4 dark:bg-zinc-950`}>
              {detail.rohinhaltLabel}
            </dd>
          </div>
        </DetailSection>

        <DetailSection title="Absender">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Name" value={detail.absenderNameLabel} />
            <AbsenderContactField
              label="E-Mail"
              value={detail.absenderEmail}
              hrefPrefix="mailto"
            />
            <AbsenderContactField
              label="Telefon"
              value={detail.absenderTelefon}
              hrefPrefix="tel"
            />
          </dl>
        </DetailSection>

        <DetailSection title="Bearbeitungsstatus">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Status" value={detail.statusLabel} />
            <DetailField label="Zuordnungsstatus" value={detail.zuordnungsstatusLabel} />
            <DetailField label="Vollständigkeit" value={detail.vollstaendigkeitsstatusLabel} />
            <DetailField label="Dringlichkeit" value={detail.dringlichkeitLabel} />
            <DetailField
              label="Manuelle Prüfung erforderlich"
              value={detail.manuellePruefungLabel}
            />
            <DetailField label="Zuletzt bearbeitet" value={detail.zuletztBearbeitetAmLabel} />
            <DetailField label="Beendet am" value={detail.beendetAmLabel} />
          </dl>
        </DetailSection>

        <DetailSection title="Strukturierte Daten">
          {detail.strukturierteDatenEmpty ? (
            <p className={valueClassName}>Noch keine strukturierten Daten vorhanden</p>
          ) : detail.strukturierteDatenJson ? (
            <JsonBlock json={detail.strukturierteDatenJson} />
          ) : (
            <p className={valueClassName}>Noch keine strukturierten Daten vorhanden</p>
          )}
        </DetailSection>

        <DetailSection title="Fehlende Angaben">
          {detail.fehlendeAngabenEmpty ? (
            <p className={valueClassName}>Keine fehlenden Angaben erfasst</p>
          ) : (
            <ul className="list-disc space-y-2 pl-5">
              {detail.fehlendeAngabenItems.map((item, index) => (
                <li key={`${index}-${item.slice(0, 24)}`} className={`${valueClassName} whitespace-pre-wrap`}>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </DetailSection>

        <DetailSection title="Zuordnungsbewertung">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField
              label="Confidence Score"
              value={detail.confidenceScoreLabel ?? "Nicht angegeben"}
            />
          </dl>
          <div className="mt-4 space-y-4">
            <div>
              <p className={labelClassName}>Zuordnungsgrund</p>
              {detail.zuordnungsgrundJson ? (
                <JsonBlock json={detail.zuordnungsgrundJson} />
              ) : (
                <p className={`${valueClassName} mt-2`}>Nicht angegeben</p>
              )}
            </div>
            <div>
              <p className={labelClassName}>Zuordnungskandidaten</p>
              {detail.zuordnungskandidatenJson ? (
                <JsonBlock json={detail.zuordnungskandidatenJson} />
              ) : (
                <p className={`${valueClassName} mt-2`}>Nicht angegeben</p>
              )}
            </div>
          </div>
        </DetailSection>

        <DetailSection title="Bestehende Verknüpfungen">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField
              label="Kunde zugeordnet"
              value={detail.kundeZugeordnet ? "Ja" : "Nein"}
            />
            <DetailField
              label="Gebäude zugeordnet"
              value={detail.gebaeudeZugeordnet ? "Ja" : "Nein"}
            />
            <DetailField
              label="Einheit zugeordnet"
              value={detail.einheitZugeordnet ? "Ja" : "Nein"}
            />
            <DetailField
              label="Vorgang zugeordnet"
              value={detail.vorgangZugeordnet ? "Ja" : "Nein"}
            />
          </dl>
        </DetailSection>
      </div>

      <ArchiviereAnfrageeingangPanel anfrageeingangId={detail.id} />

      {detail.canVerwerfen ? (
        <VerwerfeAnfrageeingangPanel anfrageeingangId={detail.id} />
      ) : null}
    </div>
  );
}

export function AnfrageeingangDetailLoadError() {
  return (
    <div className="p-4 sm:p-8">
      <Link
        href="/anfrageeingang"
        className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Zurück zum Anfrageeingang
      </Link>
      <div
        role="alert"
        className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
      >
        Der Anfrageeingang konnte nicht geladen werden.
      </div>
    </div>
  );
}
