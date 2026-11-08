import {getDemoRally} from "./demo-rally.ts";
import {createMisakiReviewPoc} from "./misaki-review.ts";

export function getParticipantCourse() {
  const rally = getDemoRally(), poc = createMisakiReviewPoc();
  return {
    rally: {id:rally.id, revision:rally.revision, title:rally.title, href:rally.href, checkpointIds:rally.checkpointIds, goalStopId:rally.goalStopId},
    stops: rally.stops,
    cards: poc.koma.map(({map, context, stops}) => ({map, context, stopIds:stops.map(s => s.id)})),
  };
}
export type ParticipantCourse = ReturnType<typeof getParticipantCourse>;
export type ParticipantSpot = ParticipantCourse["stops"][number];
