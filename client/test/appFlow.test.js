  const stateMap = new Map();
  let stateIndex = 0;

  function render(currentProps = props) {
    stateIndex = 0;
    const prevDispatcher =
      React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current;

    React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = {
      useState: (initial) => {
        const idx = stateIndex++;
        if (!stateMap.has(idx)) {
          stateMap.set(idx, typeof initial === 'function' ? initial() : initial);
        }
        const setState = (next) => {
          const current = stateMap.get(idx);
          const val = typeof next === 'function' ? next(current) : next;
          stateMap.set(idx, val);
        };
        return [stateMap.get(idx), setState];
      },
      useEffect: (effect) => {
        // Safe no-op or invoke for test harness
      }
    };

    try {
      return Component(currentProps);
    } finally {
      React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current =
        prevDispatcher;
    }
  }
