import { startShuilemeSound, stopShuilemeSound, getShuilemeSoundState, SHUILEME_SCENES } from './shuilemeSound';

function fakeAudioContext() {
  const resume = jest.fn().mockResolvedValue(undefined);
  const close = jest.fn();
  const stop = jest.fn();
  const FakeCtx = jest.fn().mockImplementation(() => ({
    resume,
    close,
    state: 'suspended',
    sampleRate: 44100,
    destination: {},
    createBuffer: () => ({
      length: 1024,
      numberOfChannels: 1,
      sampleRate: 44100,
      getChannelData: () => new Float32Array(1024),
    }),
    createBufferSource: () => ({
      connect: jest.fn(),
      start: jest.fn(),
      stop,
      loop: true,
      buffer: null,
    }),
    createGain: () => ({ connect: jest.fn(), gain: { value: 1 } }),
    createBiquadFilter: () => ({
      connect: jest.fn(),
      type: 'lowpass',
      frequency: { value: 800 },
    }),
  }));
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
  return { FakeCtx, resume, close };
}

afterEach(() => {
  stopShuilemeSound();
});

test('shuileme scenes include brown pink rain fan', () => {
  expect(SHUILEME_SCENES).toEqual(expect.arrayContaining(['brown', 'pink', 'rain', 'fan']));
});

test('start reuses one AudioContext, resume is called, hidden does not stop', async () => {
  const { FakeCtx, resume, close } = fakeAudioContext();
  expect(getShuilemeSoundState()).toBe('idle');
  await startShuilemeSound('brown');
  expect(resume).toHaveBeenCalled();
  expect(getShuilemeSoundState()).toBe('playing');
  expect(FakeCtx).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
  resume.mockClear();
  await startShuilemeSound('pink');
  expect(resume).toHaveBeenCalled();
  expect(FakeCtx).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
  document.dispatchEvent(new Event('visibilitychange'));
  expect(close).not.toHaveBeenCalled();
  expect(getShuilemeSoundState()).toBe('playing');
  stopShuilemeSound();
  expect(getShuilemeSoundState()).toBe('idle');
  expect(close).toHaveBeenCalled();
});

test('stale start after stop does not keep a closed context playing', async () => {
  const { resume, close } = fakeAudioContext();
  const pending = startShuilemeSound('brown');
  stopShuilemeSound();
  await pending;
  expect(resume).toHaveBeenCalled();
  expect(getShuilemeSoundState()).toBe('idle');
  expect(close).toHaveBeenCalled();
});
