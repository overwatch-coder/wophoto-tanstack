import { vi } from "vitest";

vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();

  function createTestServerFunction() {
    let validate: ((data: unknown) => unknown) | undefined;
    return {
      validator(validator: (data: never) => unknown) {
        validate = validator as (data: unknown) => unknown;
        return this;
      },
      handler(handler: (options: { data: never }) => unknown) {
        return (options?: { data?: unknown }) =>
          handler({ data: (validate ? validate(options?.data) : options?.data) as never });
      },
    };
  }

  return {
    ...actual,
    createServerFn: () => createTestServerFunction(),
  };
});
