import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIpFromRequest, pickForwardedClientIp } from "./client-ip.js";

test("pickForwardedClientIp ignora o primeiro hop forjável e usa a entrada pública mais à direita", () => {
  assert.equal(pickForwardedClientIp("6.6.6.6, 203.0.113.5"), "203.0.113.5");
  assert.equal(pickForwardedClientIp("203.0.113.5, 10.0.0.2"), "203.0.113.5");
});

test("conexão direta pública: ignora X-Forwarded-For", () => {
  const ip = clientIpFromRequest({
    ip: "198.51.100.7",
    socket: { remoteAddress: "198.51.100.7" },
    headers: { "x-forwarded-for": "1.2.3.4", "cf-connecting-ip": "1.2.3.4" },
  });
  assert.equal(ip, "198.51.100.7");
});

test("atrás de proxy privado/loopback: usa CF-Connecting-IP, depois XFF (direita)", () => {
  assert.equal(
    clientIpFromRequest({
      socket: { remoteAddress: "172.18.0.1" },
      headers: { "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "6.6.6.6" },
    }),
    "203.0.113.9",
  );
  assert.equal(
    clientIpFromRequest({
      socket: { remoteAddress: "::ffff:127.0.0.1" },
      headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.5" },
    }),
    "203.0.113.5",
  );
});
