import { App } from "./app/App";
import "./ui/styles/theme.css";
import "./ui/styles/base.css";
import "./ui/styles/match.css";
import "./ui/styles/screens.css";

const root = document.getElementById("app");
if (root) new App(root);
