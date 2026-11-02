const http = require("node:http");
const path = require("node:path");
const apiHandler = require("../api/[...path].js");

async function start() {
  const { createServer } = await import("vite");
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  let vite;
  const httpServer = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      apiHandler(request, response);
      return;
    }

    vite.middlewares(request, response, error => {
      if (error) {
        if (!response.headersSent) {
          response.statusCode = 500;
          response.end("Internal server error.");
        }
        return;
      }
      if (!response.writableEnded) {
        response.statusCode = 404;
        response.end("Not found.");
      }
    });
  });

  vite = await createServer({
    configFile: path.resolve(__dirname, "../vite.config.js"),
    appType: "spa",
    server: {
      middlewareMode: true,
      host: "127.0.0.1",
      hmr: { server: httpServer },
      watch: { ignored: ["**/*credentials*.env"] },
    },
  });

  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, "127.0.0.1", resolve);
  });

  console.log(`Local app and API ready at http://127.0.0.1:${port}`);

  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await vite.close();
    await new Promise(resolve => httpServer.close(resolve));
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

start().catch(error => {
  console.error("Could not start the local app and API.", error.message);
  process.exitCode = 1;
});
