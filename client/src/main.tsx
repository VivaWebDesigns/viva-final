import { createRoot } from "react-dom/client";
import App from "./App";
import MotionProvider from "@/components/MotionProvider";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <MotionProvider>
    <App />
  </MotionProvider>,
);
