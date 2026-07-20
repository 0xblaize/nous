// Shared mutable signals for the reactive scene — written every frame by the
// audio analyser and mouse handlers, read by canvases. Kept outside React
// state on purpose: these change 60×/s and must not cause re-renders.

export const reactivity = {
  /** 0..1 smoothed loudness of the playing episode (0 when nothing plays) */
  audioLevel: 0,
  /** raw frequency bins (0..255) from the analyser, if playing */
  spectrum: null as Uint8Array | null,
  /** -1..1 pointer position, smoothed by consumers */
  mouseX: 0,
  mouseY: 0,
};
