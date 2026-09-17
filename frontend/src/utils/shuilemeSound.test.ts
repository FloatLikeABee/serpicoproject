import { startShuilemeSound, stopShuilemeSound, SHUILEME_SCENES } from './shuilemeSound';

test('shuileme scenes include brown pink rain fan', () => {
  expect(SHUILEME_SCENES).toEqual(expect.arrayContaining(['brown', 'pink', 'rain', 'fan']));
});

test('startShuilemeSound resumes context; stop closes it; hidden does not stop', async () => {
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
  await startShuilemeSound('brown');
  expect(resume).toHaveBeenCalled();
  document.dispatchEvent(new Event('visibilitychange'));
  expect(close).not.toHaveBeenCalled();
  stopShuilemeSound();
  expect(close).toHaveBeenCalled();
});
