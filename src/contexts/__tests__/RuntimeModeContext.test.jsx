import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

import { RuntimeModeProvider, useRuntimeMode } from "../RuntimeModeContext";

function RuntimeProbe() {
  const runtime = useRuntimeMode();
  return <div>{runtime.loading ? "Loading" : "Ready"}</div>;
}

function renderAt(pathname) {
  window.history.pushState({}, "", pathname);
  return render(
    <RuntimeModeProvider>
      <RuntimeProbe />
    </RuntimeModeProvider>,
  );
}

describe("RuntimeModeProvider", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("does not fetch runtime mode on public routes", async () => {
    renderAt("/");

    await screen.findByText("Ready");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("fetches runtime mode on protected routes", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ demo_mode: true }),
    });

    renderAt("/dashboard");

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/system/runtime-mode",
      expect.objectContaining({ method: "GET" }),
    ));
  });
});
