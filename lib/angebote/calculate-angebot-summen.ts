import type { AngebotAktePosition } from "@/lib/angebote/get-angebot-akte";

export type PositionAmounts = {
  nettoNachRabattCents: number;
  ustCents: number;
  bruttoCents: number;
};

export type AngebotTotals = {
  nettoCents: number;
  ustCents: number;
  bruttoCents: number;
};

export function calculatePositionAmounts(
  position: AngebotAktePosition,
): PositionAmounts {
  const nettoVorRabattCents = Math.round(
    position.menge * position.einzelpreisNettoCents,
  );
  const rabattbetragCents = Math.round(
    (nettoVorRabattCents * position.rabattProzent) / 100,
  );
  const nettoNachRabattCents = nettoVorRabattCents - rabattbetragCents;
  const ustCents = Math.round(
    (nettoNachRabattCents * position.umsatzsteuerSatz) / 100,
  );
  const bruttoCents = nettoNachRabattCents + ustCents;

  return {
    nettoNachRabattCents,
    ustCents,
    bruttoCents,
  };
}

export function calculateAngebotTotals(
  positionen: AngebotAktePosition[],
): AngebotTotals {
  return positionen.reduce(
    (totals, position) => {
      const amounts = calculatePositionAmounts(position);
      totals.nettoCents += amounts.nettoNachRabattCents;
      totals.ustCents += amounts.ustCents;
      totals.bruttoCents += amounts.bruttoCents;
      return totals;
    },
    { nettoCents: 0, ustCents: 0, bruttoCents: 0 },
  );
}
