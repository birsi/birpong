import { MatchController } from "./match/MatchController";
import "./ui/styles/theme.css";
import "./ui/styles/base.css";
import "./ui/styles/match.css";

const root = document.getElementById("app");
if (root) new MatchController(root, Date.now());
