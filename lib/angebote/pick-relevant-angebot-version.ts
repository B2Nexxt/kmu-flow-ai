export type AngebotVersionPickRow = {
  version_nr: number;
  ist_eingefroren: boolean;
};

export function pickRelevantAngebotVersion<T extends AngebotVersionPickRow>(
  versions: T[],
): T | null {
  if (versions.length === 0) {
    return null;
  }

  const openVersion = versions.find((version) => !version.ist_eingefroren);
  if (openVersion) {
    return openVersion;
  }

  return versions.reduce((latest, version) =>
    version.version_nr > latest.version_nr ? version : latest,
  );
}
