export const SHUILEME_SCENES = ['brown', 'pink', 'rain', 'fan'] as const;
export type ShuilemeScene = (typeof SHUILEME_SCENES)[number];

type AudioCtx = AudioContext;

let ctx: AudioCtx | null = null;
let source: AudioBufferSourceNode | null = null;
let fallback: HTMLAudioElement | null = null;
let generation = 0;
let playing = false;

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

function stopSourceOnly() {
  const playingSrc = source;
  source = null;
  try {
    playingSrc?.stop();
  } catch {
    /* already stopped */
  }
  if (fallback) {
    try {
      fallback.pause();
      fallback.src = '';
    } catch {
      /* already stopped */
    }
    fallback = null;
  }
}

function startFallback(scene: ShuilemeScene): void {
  stopSourceOnly();
  try {
    const el = new Audio(`/shuileme/sounds/${scene}.wav`);
    el.loop = true;
    const play = el.play();
    if (play && typeof play.catch === 'function') {
      play.catch(() => undefined);
    }
    fallback = el;
    playing = true;
  } catch {
    playing = false;
  }
}

export function getShuilemeSoundState(): 'idle' | 'playing' {
  return playing ? 'playing' : 'idle';
}

export async function startShuilemeSound(scene: ShuilemeScene | string): Promise<void> {
  const name = (SHUILEME_SCENES as readonly string[]).includes(scene) ? (scene as ShuilemeScene) : 'brown';
  stopSourceOnly();
  playing = false;
  const Ctor = audioCtor();
  if (!Ctor) {
    startFallback(name);
    return;
  }
  const mine = generation;
  if (!ctx) {
    ctx = new Ctor();
  }
  const open = ctx;
  try {
    if (typeof open.resume === 'function') {
      const resumed = open.resume();
      if (resumed && typeof (resumed as Promise<void>).then === 'function') {
        await resumed;
      }
    }
    if (mine !== generation || ctx !== open) {
      if (ctx !== open) closeCtx(open);
      return;
    }
    const seconds = 2;
    const rate = open.sampleRate || 44100;
    const length = Math.max(1024, Math.floor(rate * seconds));
    const buffer = open.createBuffer(1, length, rate);
    fillScene(buffer.getChannelData(0), name);
    const src = open.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = open.createBiquadFilter();
    filter.type = name === 'rain' ? 'highpass' : 'lowpass';
    filter.frequency.value = name === 'rain' ? 900 : name === 'fan' ? 280 : 800;
    const gain = open.createGain();
    gain.gain.value = 0.45;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(open.destination);
    src.start();
    if (mine !== generation || ctx !== open) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      if (ctx !== open) closeCtx(open);
      return;
    }
    source = src;
    playing = true;
  } catch {
    if (mine !== generation) {
      if (ctx === open) {
        /* stop already owns teardown */
      } else {
        closeCtx(open);
      }
      return;
    }
    startFallback(name);
  }
}

export function stopShuilemeSound(): void {
  generation += 1;
  playing = false;
  stopSourceOnly();
  const open = ctx;
  ctx = null;
  closeCtx(open);
}
