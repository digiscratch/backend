import { AddressInfo } from "net";
import { createServer, type Server } from "http";
import { createApp } from "../../../src/app";

export interface StartedServer {
  server: Server;
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<StartedServer> {
  const app = createApp();
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    server,
    baseUrl,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      })
  };
}
