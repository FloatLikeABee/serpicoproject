export const SHUILEME_SCENES = ['brown', 'pink', 'rain', 'fan'] as const;
export type ShuilemeScene = (typeof SHUILEME_SCENES)[number];

type AudioCtx = AudioContext;

let ctx: AudioCtx | null = null;
let source: AudioBufferSourceNode | null = null;
let generation = 0;

function audioCtor(): { new (): AudioCtx } | undefined {
  const w = window as unknown as {
    AudioContext?: { new (): AudioCtx };
    webkitAudioContext?: { new (): AudioCtx };
  };
  return w.AudioContext || w.webkitAudioContext;
}

function fillScene(data: Float32Array, scene: ShuilemeScene): void {
  if (scene === 'brown') {
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = Math.max(-1, Math.min(1, last * 3.5));
    }
    return;
  }
  if (scene === 'pink') {
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.052691;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.1848) * 0.11));
    }
    return;
  }
  if (scene === 'rain') {
    for (let i = 0; i < data.length; i += 1) {
      const hiss = (Math.random() * 2 - 1) * 0.22;
      const drop = Math.random() > 0.992 ? (Math.random() * 2 - 1) * 0.45 : 0;
      data[i] = hiss + drop;
    }
    return;
  }
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.015 * white) / 1.015;
    const wobble = 0.08 * Math.sin((i / data.length) * Math.PI * 8);
    data[i] = Math.max(-1, Math.min(1, last * 2.8 + wobble));
  }
}

function closeCtx(open: AudioCtx | null) {
  try {
    open?.close();
  } catch {
    /* already closed */
  }
}

export async function startShuilemeSound(scene: ShuilemeScene | string): Promise<void> {
  const name = (SHUILEME_SCENES as readonly string[]).includes(scene) ? (scene as ShuilemeScene) : 'brown';
  stopShuilemeSound();
  const Ctor = audioCtor();
  if (!Ctor) return;
  const my = generation;
  const next = new Ctor();
  ctx = next;
  try {
    if (typeof next.resume === 'function') {
      await next.resume();
    }
    if (my !== generation || ctx !== next) {
      closeCtx(next);
      return;
    }
    const seconds = 2;
    const rate = next.sampleRate || 44100;
    const length = Math.max(1024, Math.floor(rate * seconds));
    const buffer = next.createBuffer(1, length, rate);
    fillScene(buffer.getChannelData(0), name);
    const src = next.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = next.createBiquadFilter();
    filter.type = name === 'rain' ? 'highpass' : 'lowpass';
    filter.frequency.value = name === 'rain' ? 900 : name === 'fan' ? 280 : 800;
    const gain = next.createGain();
    gain.gain.value = 0.28;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(next.destination);
    src.start();
    if (my !== generation || ctx !== next) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      closeCtx(next);
      return;
    }
    source = src;
  } catch {
    if (ctx === next) {
      stopShuilemeSound();
    } else {
      closeCtx(next);
    }
  }
}

export function stopShuilemeSound(): void {
  generation += 1;
  const playing = source;
  const open = ctx;
  source = null;
  ctx = null;
  try {
    playing?.stop();
  } catch {
    /* already stopped */
  }
  closeCtx(open);
}
