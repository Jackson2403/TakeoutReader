type Listener = (s: UpdateState) => void;

export interface UpdateState {
  ready: boolean;
}

let state: UpdateState = { ready: false };
let updateSWImpl: (reloadPage?: boolean) => Promise<void> = async () => {
  /* no-op until registerSW provides it */
};

const listeners = new Set<Listener>();

export function setUpdateState(next: UpdateState) {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
}

export function getUpdateState(): UpdateState {
  return state;
}

export function subscribeUpdate(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

/** Called by main with the updateSW function returned from registerSW. */
export function bindUpdateSW(fn: (reloadPage?: boolean) => Promise<void>): void {
  updateSWImpl = fn;
}

/** Take the pending update now (reloads with the fresh service worker). */
export function applyUpdate(): void {
  void updateSWImpl(true).catch(() => {
    window.location.reload();
  });
  setUpdateState({ ready: false });
}