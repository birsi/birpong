import { App } from "./app/App";
import { roomCodeFromSearch } from "./online/roomCode";
import "./ui/styles/theme.css";
import "./ui/styles/base.css";
import "./ui/styles/match.css";
import "./ui/styles/screens.css";

const root = document.getElementById("app");
if (root) {
  const app = new App(root);
  // An invite link (?r=K7QM) goes straight into that room.
  const code = roomCodeFromSearch(location.search);
  if (code) app.joinRoom(code);
}
