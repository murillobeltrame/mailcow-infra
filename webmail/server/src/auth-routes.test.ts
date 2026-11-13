import assert from "node:assert/strict";
import { test } from "node:test";
import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { registerAuthRoutes } from "./routes/auth.js";

test("não existe rota que crie sessão sem credenciais (antigo fido2-session)", async () => {
  const app = Fastify();
  await app.register(cookie);
  await registerAuthRoutes(app);

  const res = await app.inject({
    method: "POST",
    url: "/api/auth/fido2-session",
    payload: { subject: "admin", role: "admin" },
  });

  assert.equal(res.statusCode, 404);
  assert.equal(res.headers["set-cookie"], undefined);
  await app.close();
});
