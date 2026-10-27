import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { preloadAllMonsterIcons } from "./data/monsterPNGIcons";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

// Precarica in background tutte le icone dei mostri (prima quelle della home)
preloadAllMonsterIcons(["gattojella", "sovranozucca", "criofante"]);
