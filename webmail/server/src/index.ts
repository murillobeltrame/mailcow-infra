import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import fs from "node:fs";
import { config } from "./config.js";
import { registerAccountRoutes } from "./routes/account.js";
import { registerAdminRoutes, registerDomainRoutes } from "./routes/admin.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerCalendarRoutes } from "./routes/calendar.js";
import { registerMailRoutes } from "./routes/mail.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, credentials: true });
await app.register(cookie, { secret: config.cookieSecret, hook: "onRequest" });

app.get("/health", async () => ({ ok: true, service: "nive-mail-portal" }));

await registerAuthRoutes(app);
await registerMailRoutes(app);
await registerAccountRoutes(app);
await registerAdminRoutes(app);
await registerDomainRoutes(app);
await registerCalendarRoutes(app);

const distPath = config.frontendDist;
if (fs.existsSync(distPath)) {
  await app.register(fastifyStatic, { root: distPath, prefix: "/", wildcard: false });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) return reply.status(404).send({ error: "Rota não encontrada" });
    return reply.sendFile("index.html");
  });
}

await app.listen({ port: config.port, host: config.host });
console.log(`Nive Mail Portal em http://${config.host}:${config.port}`);
