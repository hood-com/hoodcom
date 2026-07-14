/** Small observable store with reducer-compatible dispatch. */
export const createStore = (initialState = {}, reducer = (state) => state) => {
  let state = { ...initialState };
  const subscribers = new Set();

  const getState = () => state;
  const setState = (update) => {
    const patch = typeof update === 'function' ? update(state) : update;
    if (patch === undefined || patch === null) return state;
    const next = typeof patch === 'object' && !Array.isArray(patch) ? { ...state, ...patch } : patch;
    if (Object.is(next, state)) return state;
    const previous = state;
    state = next;
    subscribers.forEach((subscriber) => {
      try { subscriber(state, previous); } catch (error) { console.error('[store] subscriber failed', error); }
    });
    return state;
  };
  const subscribe = (subscriber) => {
    if (typeof subscriber !== 'function') throw new TypeError('Subscriber must be a function');
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  };
  const dispatch = (action) => {
    if (!action || typeof action.type !== 'string') throw new TypeError('Action requires a string type');
    return setState(reducer(getState(), action));
  };

  return Object.freeze({ getState, setState, subscribe, dispatch });
};

export const combineReducers = (reducers = {}) => (state = {}, action) => Object.entries(reducers).reduce((next, [key, reducer]) => {
  next[key] = reducer(state[key], action);
  return next;
}, {});

export default Object.freeze({ createStore, combineReducers });
