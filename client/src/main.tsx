import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./pdfSetup";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(<App />);
