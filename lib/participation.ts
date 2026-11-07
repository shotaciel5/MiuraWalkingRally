export type RallyEdition = { id: string; revision: string };
export type Participation = {
  schemaVersion: 1;
  participationId: string;
  rallyId: string;
  rallyRevision: string;
  startedAt: string;
};
export type ParticipationState =
  | { status: "empty" | "invalid" | "different-edition" | "unavailable" }
  | { status: "active"; participation: Participation };
export type ParticipationStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};
type StorageProvider = () => ParticipationStorage;
type StartSource = { uuid(): string; now(): string };

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fields = ["schemaVersion", "participationId", "rallyId", "rallyRevision", "startedAt"];

export function participationKey(rallyId: string) {
  return "miura-walking-rally:participation:" + rallyId;
}

// Browser data is untrusted. A valid demo record never grants identity or achievements.
export function decodeParticipation(raw: string | null, edition: RallyEdition): ParticipationState {
  if (raw === null) return { status: "empty" };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "invalid" };
    const record = value as Record<string, unknown>;
    if (Object.keys(record).length !== fields.length || !fields.every(key => Object.hasOwn(record, key))
      || record.schemaVersion !== 1
      || typeof record.participationId !== "string" || !uuidV4.test(record.participationId)
      || typeof record.rallyId !== "string" || !record.rallyId
      || typeof record.rallyRevision !== "string" || !record.rallyRevision
      || typeof record.startedAt !== "string"
      || new Date(record.startedAt).toISOString() !== record.startedAt) return { status: "invalid" };
    if (record.rallyId !== edition.id || record.rallyRevision !== edition.revision) {
      return { status: "different-edition" };
    }
    return { status: "active", participation: {
      schemaVersion: 1, participationId: record.participationId, rallyId: record.rallyId,
      rallyRevision: record.rallyRevision, startedAt: record.startedAt,
    } };
  } catch { return { status: "invalid" }; }
}

export function readParticipation(storage: StorageProvider, edition: RallyEdition): ParticipationState {
  try { return decodeParticipation(storage().getItem(participationKey(edition.id)), edition); }
  catch { return { status: "unavailable" }; }
}

// Read again when clicked: navigation and repeated clicks must reuse an existing start.
// Incompatible records are replaced only by the explicit "new demo" action.
export function startParticipation(
  storage: StorageProvider, edition: RallyEdition, source: StartSource, replaceIncompatible = false,
): ParticipationState {
  try {
    const store = storage(), key = participationKey(edition.id);
    const previous = decodeParticipation(store.getItem(key), edition);
    if (previous.status === "active") return previous;
    if (previous.status !== "empty" && !replaceIncompatible) return previous;
    const raw = JSON.stringify({
      schemaVersion: 1, participationId: source.uuid(), rallyId: edition.id,
      rallyRevision: edition.revision, startedAt: source.now(),
    });
    const next = decodeParticipation(raw, edition);
    if (next.status !== "active") return { status: "unavailable" };
    store.setItem(key, raw);
    // Do not report a successful start unless the exact record can be read back.
    if (store.getItem(key) !== raw) return { status: "unavailable" };
    return next;
  } catch { return { status: "unavailable" }; }
}
