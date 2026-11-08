export type RallyEdition = { id: string; revision: string; checkpointIds: readonly string[]; goalStopId: string };
export type CheckpointConfirmation = { checkpointId: string; method: "demo-button"; recordedAt: string };
export type GoalConfirmation = { stopId: string; method: "demo-button"; recordedAt: string };
export type Participation = {
  schemaVersion: 3;
  participationId: string;
  rallyId: string;
  rallyRevision: string;
  startedAt: string;
  achievements: CheckpointConfirmation[];
  completion: GoalConfirmation | null;
};
export type ParticipationState =
  | { status: "empty" | "invalid" | "different-edition" | "unavailable" }
  | { status: "active"; participation: Participation };
export type CheckpointWriteResult =
  | { status: "saved"; participation: Participation; added: boolean }
  | { status: "empty" | "invalid" | "different-edition" | "unavailable" | "different-participation" | "invalid-confirmation" };
export type GoalWriteResult =
  | { status: "finished"; participation: Participation; added: boolean }
  | { status: "incomplete"; participation: Participation; missingCheckpointIds: string[] }
  | { status: "empty" | "invalid" | "different-edition" | "unavailable" | "different-participation" | "invalid-confirmation" };
export type ParticipationStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};
type StorageProvider = () => ParticipationStorage;
type StartSource = { uuid(): string; now(): string };

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const identityFields = ["schemaVersion", "participationId", "rallyId", "rallyRevision", "startedAt"];
const hasFields = (record: Record<string, unknown>, fields: string[]) =>
  Object.keys(record).length === fields.length && fields.every(key => Object.hasOwn(record, key));
function isoDate(value: unknown): value is string {
  try { return typeof value === "string" && new Date(value).toISOString() === value; }
  catch { return false; }
}
export function participationKey(rallyId: string) {
  return "miura-walking-rally:participation:" + rallyId;
}

// These local demo records are untrusted and never establish real attendance or identity.
// Old start-only records are normalized in memory; viewing never writes a migration.
export function decodeParticipation(raw: string | null, edition: RallyEdition): ParticipationState {
  if (raw === null) return { status: "empty" };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "invalid" };
    const record = value as Record<string, unknown>;
    const version = record.schemaVersion, legacy = version === 1;
    if ((version !== 1 && version !== 2 && version !== 3)
      || !hasFields(record, legacy ? identityFields : version === 2 ? [...identityFields, "achievements"] : [...identityFields, "achievements", "completion"])
      || typeof record.participationId !== "string" || !uuidV4.test(record.participationId)
      || typeof record.rallyId !== "string" || !record.rallyId
      || typeof record.rallyRevision !== "string" || !record.rallyRevision
      || !isoDate(record.startedAt)) return { status: "invalid" };
    if (record.rallyId !== edition.id || record.rallyRevision !== edition.revision) return { status: "different-edition" };
    const achievements: CheckpointConfirmation[] = [], seen = new Set<string>();
    if (!legacy) {
      if (!Array.isArray(record.achievements)) return { status: "invalid" };
      for (const item of record.achievements) {
        if (!item || typeof item !== "object" || Array.isArray(item)
          || !hasFields(item, ["checkpointId", "method", "recordedAt"])
          || !edition.checkpointIds.includes(item.checkpointId) || seen.has(item.checkpointId)
          || item.method !== "demo-button" || !isoDate(item.recordedAt)
          || Date.parse(item.recordedAt) < Date.parse(record.startedAt)) return { status: "invalid" };
        seen.add(item.checkpointId);
        achievements.push({checkpointId:item.checkpointId, method:"demo-button", recordedAt:item.recordedAt});
      }
    }
    let completion: GoalConfirmation | null = null;
    if (version === 3 && record.completion !== null) {
      if (!record.completion || typeof record.completion !== "object" || Array.isArray(record.completion)) return {status:"invalid"};
      const goal = record.completion as Record<string, unknown>;
      const latest = Math.max(Date.parse(record.startedAt), ...achievements.map(a=>Date.parse(a.recordedAt)));
      if (!hasFields(goal, ["stopId", "method", "recordedAt"])
        || typeof goal.stopId !== "string" || goal.stopId !== edition.goalStopId || goal.method !== "demo-button"
        || !isoDate(goal.recordedAt) || Date.parse(goal.recordedAt) < latest
        || !edition.checkpointIds.length || !edition.checkpointIds.every(id=>seen.has(id))) return {status:"invalid"};
      completion = {stopId:goal.stopId, method:"demo-button", recordedAt:goal.recordedAt};
    }
    return { status: "active", participation: {
      schemaVersion: 3, participationId: record.participationId, rallyId: record.rallyId,
      rallyRevision: record.rallyRevision, startedAt: record.startedAt, achievements, completion,
    } };
  } catch { return { status: "invalid" }; }
}

export function readParticipation(storage: StorageProvider, edition: RallyEdition): ParticipationState {
  try { return decodeParticipation(storage().getItem(participationKey(edition.id)), edition); }
  catch { return { status: "unavailable" }; }
}

export function startParticipation(
  storage: StorageProvider, edition: RallyEdition, source: StartSource, replaceIncompatible = false,
): ParticipationState {
  try {
    const store = storage(), key = participationKey(edition.id);
    const previous = decodeParticipation(store.getItem(key), edition);
    if (previous.status === "active") return previous;
    if (previous.status !== "empty" && !replaceIncompatible) return previous;
    const raw = JSON.stringify({
      schemaVersion: 3, participationId: source.uuid(), rallyId: edition.id,
      rallyRevision: edition.revision, startedAt: source.now(), achievements: [], completion: null,
    });
    const next = decodeParticipation(raw, edition);
    if (next.status !== "active") return { status: "unavailable" };
    store.setItem(key, raw);
    if (store.getItem(key) !== raw) return { status: "unavailable" };
    return next;
  } catch { return { status: "unavailable" }; }
}

// The recording transition is separate from the way confirmation is obtained.
// Its input participation must have passed the storage decoder.
export function applyCheckpointConfirmation(
  participation: Participation, edition: RallyEdition, confirmation: CheckpointConfirmation,
): CheckpointWriteResult {
  if (participation.rallyId !== edition.id || participation.rallyRevision !== edition.revision) {
    return {status:"different-edition"};
  }
  if (!edition.checkpointIds.includes(confirmation.checkpointId) || confirmation.method !== "demo-button"
    || !isoDate(confirmation.recordedAt) || Date.parse(confirmation.recordedAt) < Date.parse(participation.startedAt)) {
    return {status:"invalid-confirmation"};
  }
  if (participation.achievements.some(a => a.checkpointId === confirmation.checkpointId)) {
    return {status:"saved", participation, added:false};
  }
  return {status:"saved", participation:{...participation, achievements:[...participation.achievements, {...confirmation}]}, added:true};
}

export function saveCheckpointConfirmation(
  storage: StorageProvider, edition: RallyEdition, expectedParticipationId: string, confirmation: CheckpointConfirmation,
): CheckpointWriteResult {
  try {
    const store = storage(), key = participationKey(edition.id);
    const current = decodeParticipation(store.getItem(key), edition);
    if (current.status !== "active") return current;
    if (current.participation.participationId !== expectedParticipationId) return {status:"different-participation"};
    const result = applyCheckpointConfirmation(current.participation, edition, confirmation);
    if (result.status !== "saved" || !result.added) return result;
    const raw = JSON.stringify(result.participation);
    store.setItem(key, raw);
    if (store.getItem(key) !== raw) return {status:"unavailable"};
    return result;
  } catch { return {status:"unavailable"}; }
}

export function applyGoalConfirmation(
  participation: Participation, edition: RallyEdition, confirmation: GoalConfirmation,
): GoalWriteResult {
  if (participation.rallyId !== edition.id || participation.rallyRevision !== edition.revision) return {status:"different-edition"};
  const latest = Math.max(Date.parse(participation.startedAt), ...participation.achievements.map(a=>Date.parse(a.recordedAt)));
  if (!edition.goalStopId || confirmation.stopId !== edition.goalStopId || confirmation.method !== "demo-button"
    || !isoDate(confirmation.recordedAt) || Date.parse(confirmation.recordedAt) < latest || !edition.checkpointIds.length) {
    return {status:"invalid-confirmation"};
  }
  if (participation.completion) return {status:"finished", participation, added:false};
  const missingCheckpointIds = edition.checkpointIds.filter(id=>!participation.achievements.some(a=>a.checkpointId===id));
  if (missingCheckpointIds.length) return {status:"incomplete", participation, missingCheckpointIds};
  return {status:"finished", participation:{...participation, completion:{...confirmation}}, added:true};
}

export function saveGoalConfirmation(
  storage: StorageProvider, edition: RallyEdition, expectedParticipationId: string, confirmation: GoalConfirmation,
): GoalWriteResult {
  try {
    const store = storage(), key = participationKey(edition.id);
    const current = decodeParticipation(store.getItem(key), edition);
    if (current.status !== "active") return current;
    if (current.participation.participationId !== expectedParticipationId) return {status:"different-participation"};
    const result = applyGoalConfirmation(current.participation, edition, confirmation);
    if (result.status !== "finished" || !result.added) return result;
    const raw = JSON.stringify(result.participation);
    store.setItem(key, raw);
    if (store.getItem(key) !== raw) return {status:"unavailable"};
    return result;
  } catch { return {status:"unavailable"}; }
}
