declare module 'cors' {
  import type { RequestHandler } from 'express';
  const cors: (options?: unknown) => RequestHandler;
  export default cors;
}

declare module 'ws' {
  export class WebSocketServer {
    constructor(options?: unknown);
    on(event: 'connection', listener: (ws: unknown, req: unknown) => void): this;
  }
}
