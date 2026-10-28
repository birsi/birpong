/** A minimal event source: `on` returns the function that unsubscribes. */
export class Emitter<T = void> {
  private readonly handlers = new Set<(value: T) => void>();

  on(handler: (value: T) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  emit(value: T): void {
    for (const handler of [...this.handlers]) handler(value);
  }
}

/** Values pushed by the network, consumed in order by `next()`; closing rejects waiting readers. */
export class Inbox<T> {
  private readonly queue: T[] = [];
  private readonly waiting: { resolve: (v: T) => void; reject: (e: Error) => void }[] = [];
  private failure: Error | null = null;

  push(value: T): void {
    const reader = this.waiting.shift();
    if (reader) reader.resolve(value);
    else this.queue.push(value);
  }

  next(): Promise<T> {
    if (this.queue.length > 0) return Promise.resolve(this.queue.shift()!);
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => this.waiting.push({ resolve, reject }));
  }

  close(error: Error): void {
    this.failure = error;
    for (const reader of this.waiting.splice(0)) reader.reject(error);
  }
}
