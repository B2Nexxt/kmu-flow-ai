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
import type {
  AnfrageeingangKundendatenDisplay,
  AnfrageeingangZuordnungsbewertungDisplay,
  KundendatenAnsprechpartnerDisplay,
  KundendatenContactValue,
  ZuordnungskandidatDisplay,
} from "@/lib/anfrageeingang/types";

const sectionClassName =
  "rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";

const sectionTitleClassName =
  "text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

const labelClassName = "text-sm text-zinc-500 dark:text-zinc-400";

const valueClassName = "text-sm text-zinc-900 dark:text-zinc-50";

const subsectionTitleClassName =
  "text-sm font-medium text-zinc-800 dark:text-zinc-200";

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

function ZuordnungskandidatCard({ kandidat }: { kandidat: ZuordnungskandidatDisplay }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950">
      <dl className="grid gap-3 sm:grid-cols-2">
        <DetailField label="Typ" value={kandidat.typ} />
        <DetailField label="Name" value={kandidat.name} />
        <DetailField label="Adresse" value={kandidat.adresse} />
        <DetailField label="Confidence" value={kandidat.confidenceLabel} />
      </dl>
    </div>
  );
}

function ZuordnungsbewertungSection({
  bewertung,
}: {
  bewertung: AnfrageeingangZuordnungsbewertungDisplay;
}) {
  if (bewertung.isEmpty) {
    return (
      <DetailSection title="Zuordnungsbewertung">
        <p className={valueClassName}>Keine Zuordnungsbewertung vorhanden.</p>
      </DetailSection>
    );
  }

  return (
    <DetailSection title="Zuordnungsbewertung">
      <dl className="grid gap-4 sm:grid-cols-2">
        <DetailField label="Confidence" value={bewertung.confidenceLabel} />
        <DetailField label="Zuordnungsstatus" value={bewertung.zuordnungsstatusLabel} />
        <DetailField
          label="Vollständigkeitsstatus"
          value={bewertung.vollstaendigkeitsstatusLabel}
        />
      </dl>

      <div className="mt-6">
        <p className={labelClassName}>Fehlende Angaben</p>
        {bewertung.fehlendeAngabenItems.length > 0 ? (
          <ul className="mt-2 list-disc space-y-2 pl-5">
            {bewertung.fehlendeAngabenItems.map((item) => (
              <li key={item} className={valueClassName}>
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className={`${valueClassName} mt-2`}>Keine fehlenden Angaben.</p>
        )}
      </div>

      {bewertung.grundPunkte.length > 0 ? (
        <div className="mt-6">
          <p className={labelClassName}>Grund</p>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            {bewertung.grundPunkte.map((punkt) => (
              <li key={punkt} className={valueClassName}>
                {punkt}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {bewertung.kandidaten.length > 0 ? (
        <div className="mt-6 space-y-3">
          <h3 className={subsectionTitleClassName}>Zuordnungskandidaten</h3>
          <div className="space-y-3">
            {bewertung.kandidaten.map((kandidat, index) => (
              <ZuordnungskandidatCard
                key={`${kandidat.typ}-${kandidat.name}-${index}`}
                kandidat={kandidat}
              />
            ))}
          </div>
        </div>
      ) : null}
    </DetailSection>
  );
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

function KundendatenContactField({
  label,
  contact,
}: {
  label: string;
  contact: KundendatenContactValue;
}) {
  if (!contact.href) {
    return <DetailField label={label} value={contact.display} />;
  }

  return (
    <div>
      <dt className={labelClassName}>{label}</dt>
      <dd className="mt-1">
        <a
          href={contact.href}
          className="text-sm text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-50 dark:decoration-zinc-600"
        >
          {contact.display}
        </a>
      </dd>
    </div>
  );
}

function KundendatenAnsprechpartnerBlock({
  ansprechpartner,
}: {
  ansprechpartner: KundendatenAnsprechpartnerDisplay;
}) {
  return (
    <div className="mt-6 space-y-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
      <h3 className={subsectionTitleClassName}>Ansprechpartner</h3>
      <dl className="grid gap-4 sm:grid-cols-2">
        <DetailField label="Vorname" value={ansprechpartner.vorname} />
        <DetailField label="Nachname" value={ansprechpartner.nachname} />
        <KundendatenContactField label="Telefonnummer" contact={ansprechpartner.telefon} />
        <KundendatenContactField label="Mobilnummer" contact={ansprechpartner.mobil} />
        <KundendatenContactField label="E-Mail-Adresse" contact={ansprechpartner.email} />
      </dl>
    </div>
  );
}

function KundendatenSection({ kundendaten }: { kundendaten: AnfrageeingangKundendatenDisplay }) {
  if (kundendaten.layout === "privatperson") {
    return (
      <DetailSection title="Kundendaten">
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Typ" value={kundendaten.typ} />
          <DetailField label="Anrede" value={kundendaten.anrede} />
          <DetailField label="Vorname" value={kundendaten.vorname} />
          <DetailField label="Nachname" value={kundendaten.nachname} />
          <DetailField label="Straße" value={kundendaten.strasse} />
          <DetailField label="Hausnummer" value={kundendaten.hausnummer} />
          <DetailField label="PLZ" value={kundendaten.plz} />
          <DetailField label="Ort" value={kundendaten.ort} />
          <KundendatenContactField label="Telefonnummer" contact={kundendaten.telefon} />
          <KundendatenContactField label="Mobilnummer" contact={kundendaten.mobil} />
          <KundendatenContactField label="E-Mail-Adresse" contact={kundendaten.email} />
        </dl>
      </DetailSection>
    );
  }

  if (kundendaten.layout === "unternehmen") {
    return (
      <DetailSection title="Kundendaten">
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Typ" value={kundendaten.typ} />
          <DetailField label="Firmenname" value={kundendaten.firmenname} />
          <DetailField label="Straße" value={kundendaten.strasse} />
          <DetailField label="Hausnummer" value={kundendaten.hausnummer} />
          <DetailField label="PLZ" value={kundendaten.plz} />
          <DetailField label="Ort" value={kundendaten.ort} />
          <KundendatenContactField label="Telefonnummer" contact={kundendaten.telefon} />
          <KundendatenContactField label="E-Mail-Adresse" contact={kundendaten.email} />
        </dl>
        {kundendaten.ansprechpartner ? (
          <KundendatenAnsprechpartnerBlock ansprechpartner={kundendaten.ansprechpartner} />
        ) : null}
      </DetailSection>
    );
  }

  if (kundendaten.layout === "unbekannt") {
    return (
      <DetailSection title="Kundendaten">
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Typ" value={kundendaten.typ} />
          <DetailField label="Name" value={kundendaten.name} />
          <KundendatenContactField label="Telefonnummer" contact={kundendaten.telefon} />
          <KundendatenContactField label="Mobilnummer" contact={kundendaten.mobil} />
          <KundendatenContactField label="E-Mail-Adresse" contact={kundendaten.email} />
        </dl>
      </DetailSection>
    );
  }

  return (
    <DetailSection title="Kundendaten">
      <dl className="grid gap-4 sm:grid-cols-2">
        <DetailField label="Name" value={kundendaten.name} />
        <KundendatenContactField label="E-Mail-Adresse" contact={kundendaten.email} />
        <KundendatenContactField label="Telefonnummer" contact={kundendaten.telefon} />
      </dl>
    </DetailSection>
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

        <KundendatenSection kundendaten={detail.kundendaten} />

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

        <ZuordnungsbewertungSection bewertung={detail.zuordnungsbewertung} />

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
