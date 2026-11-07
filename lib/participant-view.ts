import type {ParticipantCourse} from "./participant-course.ts";

// Select an occurrence by order, never by a node that may be revisited.
// This projection has no participation/storage writes or achievement transitions.
export function participantFrame(course: ParticipantCourse, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= course.cards.length) {
    throw new RangeError("Invalid participant koma index");
  }
  const card = course.cards[index];
  const stops = card.stopIds.map(id => {
    const spot = course.stops.find(s => s.id === id);
    if (!spot) throw new Error("Unknown participant stop: " + id);
    return spot;
  });
  return {card, stops};
}
