import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

export const FUTURE_ROUTER_CONFIG = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

export function renderWithFutureRouter(ui, { initialEntries = ["/"] } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries} future={FUTURE_ROUTER_CONFIG}>
      {ui}
    </MemoryRouter>,
  );
}
