// Fixes React DevTools crashing when a custom renderer (e.g. R3F) reports an empty version string.
declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevtoolsHook;
  }
}

type DevtoolsRenderer = { version?: string };

type DevtoolsHook = {
  renderers?: Map<number, DevtoolsRenderer>;
  registerRenderer?: (renderer: DevtoolsRenderer) => void;
  __vtPatched?: boolean;
};

const normalizeRendererVersion = (renderer?: DevtoolsRenderer) => {
  if (!renderer) return;
  if (typeof renderer.version !== 'string' || renderer.version.trim() === '') {
    renderer.version = '0.0.0';
  }
};

const patchDevtoolsHook = (hook?: DevtoolsHook) => {
  if (!hook || hook.__vtPatched) return false;
  hook.__vtPatched = true;
  hook.renderers?.forEach((renderer) => normalizeRendererVersion(renderer));
  if (typeof hook.registerRenderer === 'function') {
    const original = hook.registerRenderer;
    hook.registerRenderer = (renderer) => {
      normalizeRendererVersion(renderer);
      return original(renderer);
    };
  }
  return true;
};

if (typeof window !== 'undefined') {
  if (!patchDevtoolsHook(window.__REACT_DEVTOOLS_GLOBAL_HOOK__)) {
    const interval = window.setInterval(() => {
      if (patchDevtoolsHook(window.__REACT_DEVTOOLS_GLOBAL_HOOK__)) {
        window.clearInterval(interval);
      }
    }, 500);
  }
}

export {};
