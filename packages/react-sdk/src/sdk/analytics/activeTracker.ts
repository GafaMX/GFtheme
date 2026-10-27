import type { TrackInput } from "./events";

type TrackFn = (input: TrackInput) => void;

let bound: TrackFn | null = null;

/** El tracker activo de esta pestaña. Los widgets emiten aquí, no a cada pixel. */
export function bindActiveTracker(track: TrackFn | null): void {
  bound = track;
}

export function trackSdkEvent(input: TrackInput): void {
  try {
    bound?.(input);
  } catch {
    // un widget nunca debe romper por analytics
  }
}
