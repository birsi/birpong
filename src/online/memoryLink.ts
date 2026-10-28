import { Emitter } from "./emitter";
import type { PeerId, RoomLink } from "./link";
import type { Message } from "./protocol";

/** Connects any number of in-memory links like one room, for tests. Delivery is asynchronous. */
export class MemoryHub {
  private readonly peers = new Map<PeerId, MemoryPeer>();

  join(id: PeerId): RoomLink {
    const peer = new MemoryPeer(id, this);
    const others = [...this.peers.values()];
    this.peers.set(id, peer);
    // Announce after the caller has had a chance to attach handlers.
    queueMicrotask(() => {
      for (const other of others) {
        other.joins.emit(id);
        peer.joins.emit(other.id);
      }
    });
    return peer.link;
  }

  deliver(from: PeerId, message: Message, to?: PeerId): void {
    // Copy through JSON like a real network would.
    const copy = JSON.parse(JSON.stringify(message)) as Message;
    for (const [id, peer] of this.peers) {
      if (id === from || (to !== undefined && id !== to)) continue;
      queueMicrotask(() => peer.messages.emit({ message: copy, from }));
    }
  }

  remove(id: PeerId): void {
    this.peers.delete(id);
    queueMicrotask(() => {
      for (const peer of this.peers.values()) peer.leaves.emit(id);
    });
  }
}

class MemoryPeer {
  readonly messages = new Emitter<{ message: Message; from: PeerId }>();
  readonly joins = new Emitter<PeerId>();
  readonly leaves = new Emitter<PeerId>();
  readonly link: RoomLink;

  constructor(
    readonly id: PeerId,
    hub: MemoryHub,
  ) {
    this.link = {
      selfId: id,
      send: (message, to) => hub.deliver(id, message, to),
      onMessage: (handler) => this.messages.on(({ message, from }) => handler(message, from)),
      onPeerJoin: (handler) => this.joins.on(handler),
      onPeerLeave: (handler) => this.leaves.on(handler),
      leave: () => hub.remove(id),
    };
  }
}
