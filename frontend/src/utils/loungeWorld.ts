const LOUNGE_WORLDS = ['synth-world', 'fr-world', 'll-world', 'sm-world'] as const;

export type LoungeWorld = 'fr-world' | 'll-world' | 'sm-world';

export function enterLoungeWorld(world: LoungeWorld) {
  const root = document.documentElement;
  LOUNGE_WORLDS.forEach((name) => root.classList.remove(name));
  root.classList.add(world);
}

export function leaveLoungeWorld() {
  const root = document.documentElement;
  LOUNGE_WORLDS.forEach((name) => root.classList.remove(name));
  root.classList.add('synth-world');
}
