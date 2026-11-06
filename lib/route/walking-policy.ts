import type { Tags } from "./types.ts";

type State = "allowed" | "excluded" | "review";
type Access = { state: State; reason: string };
export type WayPolicy = Access & { forward: boolean; backward: boolean };

const allowed = new Set(["yes", "designated", "permissive"]);
const denied = new Set(["no", "private", "use_sidepath"]);
const roads = new Set([
  "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link",
  "tertiary", "tertiary_link", "residential", "unclassified", "service",
  "living_street", "track", "footway", "path", "pedestrian", "steps",
]);
function valuePolicy(value: string): Access {
  if (allowed.has(value)) return { state: "allowed", reason: "explicit pedestrian access" };
  if (denied.has(value)) return { state: "excluded", reason: "access=" + value };
  return { state: "review", reason: "unresolved access=" + value };
}
function accessPolicy(tags: Tags): Access {
  if (Object.keys(tags).some(key => /^(foot|access|oneway:foot|motorroad).*:conditional$/.test(key))) {
    return { state: "review", reason: "conditional access requires review" };
  }
  // Unknown pedestrian variants must survive normalization and cannot silently disappear.
  const supported = new Set(["foot", "foot:forward", "foot:backward"]);
  if (Object.keys(tags).some(key => key.startsWith("foot:") && !supported.has(key))) {
    return { state: "review", reason: "unsupported pedestrian access tag" };
  }
  if (Object.keys(tags).some(key => key.startsWith("access:") || key.startsWith("oneway:foot:") || key.startsWith("motorroad:"))) {
    return { state: "review", reason: "unsupported access/direction variant" };
  }
  if (tags.foot !== undefined) return valuePolicy(tags.foot);
  if (tags.access !== undefined) {
    if (tags.access === "designated") return { state: "review", reason: "access=designated has no pedestrian mode" };
    return valuePolicy(tags.access);
  }
  return { state: "allowed", reason: "default pedestrian candidate; field access unverified" };
}

export function nodePolicy(tags: Tags = {}): Access {
  const access = accessPolicy(tags);
  if (access.state !== "allowed") return access;
  if (tags.barrier && !["no", "entrance", "bollard", "kerb"].includes(tags.barrier)) {
    if (["wall", "fence", "retaining_wall", "block"].includes(tags.barrier)) {
      return { state: "review", reason: "physical barrier requires review even with foot=yes" };
    }
    if (!allowed.has(tags.foot ?? "")) return { state: "review", reason: "barrier access unverified" };
  }
  return access;
}

export function wayPolicy(tags: Tags = {}): WayPolicy {
  const finish = (p: Access, forward = false, backward = false): WayPolicy => ({ ...p, forward, backward });
  if (!tags.highway || tags.area === "yes" || ["construction", "proposed"].includes(tags.highway) || tags.construction || tags.proposed) {
    return finish({ state: "excluded", reason: "not a routable highway line" });
  }
  if (["motorway", "motorway_link"].includes(tags.highway) || tags.motorroad === "yes") {
    return finish({ state: "excluded", reason: "motor-only road (conflicting foot tags do not override)" });
  }
  if (tags.motorroad && tags.motorroad !== "no") {
    return finish({ state: "review", reason: "unresolved motorroad tag" });
  }
  if (denied.has(tags.foot ?? tags.access ?? "") && [tags["foot:forward"], tags["foot:backward"]].some(value => allowed.has(value ?? ""))) {
    return finish({ state: "review", reason: "directional permission conflicts with blanket restriction" });
  }
  const access = nodePolicy(tags);
  if (access.state !== "allowed") return finish(access);
  if (!roads.has(tags.highway) && !allowed.has(tags.foot ?? "")) {
    return finish({ state: "review", reason: "highway class requires explicit pedestrian access" });
  }
  let forward = true;
  let backward = true;
  // Ordinary oneway concerns vehicles; only pedestrian direction tags constrain this graph.
  if (["yes", "1", "true"].includes(tags["oneway:foot"] ?? "")) backward = false;
  else if (tags["oneway:foot"] === "-1") forward = false;
  else if (tags["oneway:foot"] && !["no", "0", "false"].includes(tags["oneway:foot"])) {
    return finish({ state: "review", reason: "unresolved pedestrian direction" });
  }
  for (const [key, direction] of [["foot:forward", "forward"], ["foot:backward", "backward"]] as const) {
    if (tags[key] === undefined) continue;
    const directional = valuePolicy(tags[key]);
    if (directional.state === "allowed" && ((direction === "forward" && !forward) || (direction === "backward" && !backward))) {
      return finish({ state: "review", reason: "conflicting pedestrian direction tags" });
    }
    if (directional.state === "review") return finish(directional);
    // A direction-specific denial is respected; an allowance cannot reopen oneway:foot.
    if (directional.state === "excluded") {
      if (direction === "forward") forward = false;
      else backward = false;
    }
  }
  if (!forward && !backward) return finish({ state: "excluded", reason: "both walking directions closed" });
  return finish(access, forward, backward);
}
