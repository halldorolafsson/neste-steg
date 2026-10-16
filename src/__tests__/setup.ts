import "@testing-library/jest-dom/vitest";

// Ensure React act() works in test environment
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;
