import '@testing-library/jest-dom/vitest'

// jsdom has no matchMedia, and useIsPhone reads it during render. Stub it as
// "no match" so components render at their non-phone defaults; a test that cares
// about the phone layout can override this.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
