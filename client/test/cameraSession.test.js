// Helper to simulate browser mediaDevices mock
function mockMediaDevices(mockImpl = {}) {
  const mediaDevicesImpl = {
    getUserMedia: mockImpl.getUserMedia || (async () => ({
      getTracks: () => [{ stop: () => {} }]
    }))
  };
  const orig = Object.getOwnPropertyDescriptor(globalThis.navigator, 'mediaDevices');
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: mediaDevicesImpl,
    configurable: true,
    writable: true
  });
  return () => {
    if (orig) {
      Object.defineProperty(globalThis.navigator, 'mediaDevices', orig);
    } else {
      delete globalThis.navigator.mediaDevices;
    }
  };
}
