// frontend/src/lib/eventBus.ts
export type Unsubscribe = () => void;

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<Handler<any>>>();

  on<T = any>(event: string, handler: Handler<T>): Unsubscribe {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler as Handler<any>);
    return () => this.off(event, handler);
  }

  off<T = any>(event: string, handler: Handler<T>) {
    this.handlers.get(event)?.delete(handler as Handler<any>);
  }

  emit<T = any>(event: string, payload: T) {
    this.handlers.get(event)?.forEach((h) => {
      try { (h as Handler<T>)(payload); } catch {}
    });
  }
}

export const bus = new EventBus();

