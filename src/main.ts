import "./ui/theme.css";
import "./ui/base.css";
import "./ui/match.css";
import { mountMatch } from "./ui/match";

const app = document.getElementById("app");
if (app) mountMatch(app);
