import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import App from "./App.tsx";

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
    expect(document.querySelector("div")).toBeInTheDocument();
  });

  it("renders an empty div", () => {
    const { container } = render(<App />);
    const divs = container.querySelectorAll("div");
    expect(divs.length).toBeGreaterThan(0);
  });
});
