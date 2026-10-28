import { joinRoom, selfId, type JsonValue } from "trystero";
import { Emitter } from "./emitter";
import { parseMessage, type Message } from "./protocol";

export type PeerId = string;

/** A connection to the other browsers in a room. Real (Trystero) or in memory (tests). */
export interface RoomLink {
  readonly selfId: PeerId;
  /** Send to one peer, or to everyone in the room. */
  send(message: Message, to?: PeerId): void;
  onMessage(handler: (message: Message, from: PeerId) => void): () => void;
  onPeerJoin(handler: (peer: PeerId) => void): () => void;
  onPeerLeave(handler: (peer: PeerId) => void): () => void;
  leave(): void;
}

const APP_ID = "birpong";
const ACTION = "msg";

/**
 * Peers find each other through Trystero's public relays and then talk over a WebRTC data
 * channel; no server of ours is involved.
 */
export function joinTrysteroRoom(code: string): RoomLink {
  const room = joinRoom({ appId: APP_ID }, `${APP_ID}-${code}`);
  const action = room.makeAction<JsonValue>(ACTION);
  const messages = new Emitter<{ message: Message; from: PeerId }>();
  const joins = new Emitter<PeerId>();
  const leaves = new Emitter<PeerId>();

  action.onMessage = (data, { peerId }) => {
    const message = parseMessage(data);
    if (message) messages.emit({ message, from: peerId });
  };
  room.onPeerJoin = (peerId) => joins.emit(peerId);
  room.onPeerLeave = (peerId) => leaves.emit(peerId);

  return {
    selfId,
    send: (message, to) =>
      void action.send(message as unknown as JsonValue, to ? { target: to } : undefined),
    onMessage: (handler) => messages.on(({ message, from }) => handler(message, from)),
    onPeerJoin: (handler) => joins.on(handler),
    onPeerLeave: (handler) => leaves.on(handler),
    leave: () => void room.leave(),
  };
}
