import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEffects, audioFx } from '../src/utils/audioEffects.js';

test('AudioEffects - Node/SSR Environment Safety', async (t) => {
  await t.test('exports audioFx instance and AudioEffects class', () => {
    assert.ok(AudioEffects);
    assert.ok(audioFx);
    assert.ok(audioFx instanceof AudioEffects);
    assert.strictEqual(typeof audioFx.playCountdownBeep, 'function');
    assert.strictEqual(typeof audioFx.playShutterSound, 'function');
    assert.strictEqual(typeof audioFx.playGiftPopSound, 'function');
  });

  await t.test('handles missing window gracefully without throwing', () => {
    const originalWindow = global.window;
    delete global.window;

    try {
      const fx = new AudioEffects();
      const ctx = fx.getAudioContext();
      assert.strictEqual(ctx, null);

      // Verify methods do not throw in headless / SSR environments
      assert.doesNotThrow(() => fx.playCountdownBeep());
      assert.doesNotThrow(() => fx.playCountdownBeep(true));
      assert.doesNotThrow(() => fx.playShutterSound());
      assert.doesNotThrow(() => fx.playGiftPopSound());
    } finally {
      if (originalWindow !== undefined) {
        global.window = originalWindow;
      }
    }
  });

  await t.test('handles window without AudioContext gracefully', () => {
    const originalWindow = global.window;
    global.window = {};

    try {
      const fx = new AudioEffects();
      const ctx = fx.getAudioContext();
      assert.strictEqual(ctx, null);

      assert.doesNotThrow(() => fx.playCountdownBeep());
      assert.doesNotThrow(() => fx.playShutterSound());
      assert.doesNotThrow(() => fx.playGiftPopSound());
    } finally {
      if (originalWindow !== undefined) {
        global.window = originalWindow;
      } else {
        delete global.window;
      }
    }
  });
});

test('AudioEffects - Browser Mock Environment', async (t) => {
  const originalWindow = global.window;

  function createMockAudioContext() {
    const calls = {
      resumed: false,
      oscillators: [],
      gains: [],
      buffers: [],
      bufferSources: [],
      filters: []
    };

    class MockAudioContext {
      constructor() {
        this.state = 'suspended';
        this.currentTime = 1.5;
        this.sampleRate = 44100;
        this.destination = { name: 'destination' };
      }

      async resume() {
        calls.resumed = true;
        this.state = 'running';
      }

      createOscillator() {
        const osc = {
          type: '',
          frequency: {
            value: 0,
            setValueAtTime(val, time) {
              this.value = val;
              this.setTime = time;
            },
            exponentialRampToValueAtTime(val, time) {
              this.targetValue = val;
              this.targetTime = time;
            }
          },
          connections: [],
          connect(target) {
            this.connections.push(target);
          },
          started: false,
          stopped: false,
          start() {
            this.started = true;
          },
          stop(time) {
            this.stopped = true;
            this.stopTime = time;
          }
        };
        calls.oscillators.push(osc);
        return osc;
      }

      createGain() {
        const gain = {
          gain: {
            value: 1,
            setValueAtTime(val, time) {
              this.value = val;
              this.setTime = time;
            },
            exponentialRampToValueAtTime(val, time) {
              this.targetValue = val;
              this.targetTime = time;
            }
          },
          connections: [],
          connect(target) {
            this.connections.push(target);
          }
        };
        calls.gains.push(gain);
        return gain;
      }

      createBuffer(channels, size, sampleRate) {
        const buffer = {
          channels,
          size,
          sampleRate,
          channelData: new Float32Array(size),
          getChannelData(index) {
            return this.channelData;
          }
        };
        calls.buffers.push(buffer);
        return buffer;
      }

      createBufferSource() {
        const source = {
          buffer: null,
          connections: [],
          connect(target) {
            this.connections.push(target);
          },
          started: false,
          start() {
            this.started = true;
          }
        };
        calls.bufferSources.push(source);
        return source;
      }

      createBiquadFilter() {
        const filter = {
          type: '',
          frequency: { value: 0 },
          connections: [],
          connect(target) {
            this.connections.push(target);
          }
        };
        calls.filters.push(filter);
        return filter;
      }
    }

    return { MockAudioContext, calls };
  }

  await t.test('initializes and resumes AudioContext', async () => {
    const { MockAudioContext, calls } = createMockAudioContext();
    global.window = { AudioContext: MockAudioContext };

    try {
      const fx = new AudioEffects();
      const ctx = fx.getAudioContext();
      assert.ok(ctx);
      assert.strictEqual(calls.resumed, true);

      // Reusing context
      const ctx2 = fx.getAudioContext();
      assert.strictEqual(ctx, ctx2);
    } finally {
      if (originalWindow !== undefined) {
        global.window = originalWindow;
      } else {
        delete global.window;
      }
    }
  });

  await t.test('playCountdownBeep generates intermediate beep', () => {
    const { MockAudioContext, calls } = createMockAudioContext();
    global.window = { AudioContext: MockAudioContext };

    try {
      const fx = new AudioEffects();
      fx.playCountdownBeep(false);

      assert.strictEqual(calls.oscillators.length, 1);
      assert.strictEqual(calls.gains.length, 1);

      const osc = calls.oscillators[0];
      const gain = calls.gains[0];

      assert.strictEqual(osc.type, 'sine');
      assert.strictEqual(osc.frequency.value, 800);
      assert.strictEqual(gain.gain.value, 0.2);
      assert.strictEqual(gain.gain.targetValue, 0.001);
      assert.strictEqual(osc.started, true);
      assert.strictEqual(osc.stopped, true);
    } finally {
      if (originalWindow !== undefined) {
        global.window = originalWindow;
      } else {
        delete global.window;
      }
    }
  });

  await t.test('playCountdownBeep generates higher pitch final beep', () => {
    const { MockAudioContext, calls } = createMockAudioContext();
    global.window = { AudioContext: MockAudioContext };

    try {
      const fx = new AudioEffects();
      fx.playCountdownBeep(true);

      const osc = calls.oscillators[0];
      assert.strictEqual(osc.frequency.value, 1200);
    } finally {
      if (originalWindow !== undefined) {
        global.window = originalWindow;
      } else {
        delete global.window;
      }
    }
  });

  await t.test('playShutterSound synthesizes realistic camera click', () => {
    const { MockAudioContext, calls } = createMockAudioContext();
    global.window = { AudioContext: MockAudioContext };

    try {
      const fx = new AudioEffects();
      fx.playShutterSound();

      assert.strictEqual(calls.buffers.length, 1);
      assert.strictEqual(calls.bufferSources.length, 1);
      assert.strictEqual(calls.filters.length, 1);
      assert.strictEqual(calls.gains.length, 1);

      const filter = calls.filters[0];
      const gain = calls.gains[0];
      const source = calls.bufferSources[0];

      assert.strictEqual(filter.type, 'bandpass');
      assert.strictEqual(filter.frequency.value, 1000);
      assert.strictEqual(gain.gain.value, 0.4);
      assert.strictEqual(source.started, true);
    } finally {
      if (originalWindow !== undefined) {
        global.window = originalWindow;
      } else {
        delete global.window;
      }
    }
  });

  await t.test('playGiftPopSound synthesizes upward pitch chime', () => {
    const { MockAudioContext, calls } = createMockAudioContext();
    global.window = { AudioContext: MockAudioContext };

    try {
      const fx = new AudioEffects();
      fx.playGiftPopSound();

      assert.strictEqual(calls.oscillators.length, 1);
      assert.strictEqual(calls.gains.length, 1);

      const osc = calls.oscillators[0];
      assert.strictEqual(osc.type, 'triangle');
      assert.strictEqual(osc.frequency.value, 300);
      assert.strictEqual(osc.frequency.targetValue, 900);
      assert.strictEqual(osc.started, true);
      assert.strictEqual(osc.stopped, true);
    } finally {
      if (originalWindow !== undefined) {
        global.window = originalWindow;
      } else {
        delete global.window;
      }
    }
  });

  await t.test('catches Web Audio API failures gracefully', () => {
    const { MockAudioContext } = createMockAudioContext();
    MockAudioContext.prototype.createOscillator = () => {
      throw new Error('NotAllowedError: Audio autoplay blocked');
    };
    MockAudioContext.prototype.createBuffer = () => {
      throw new Error('Audio hardware unavailable');
    };

    global.window = { AudioContext: MockAudioContext };

    try {
      const fx = new AudioEffects();
      assert.doesNotThrow(() => fx.playCountdownBeep());
      assert.doesNotThrow(() => fx.playShutterSound());
      assert.doesNotThrow(() => fx.playGiftPopSound());
    } finally {
      if (originalWindow !== undefined) {
        global.window = originalWindow;
      } else {
        delete global.window;
      }
    }
  });
});
