#!/usr/bin/env node
import { randomBytes } from "node:crypto";

function secret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

console.log("# Cole em deploy/.env.deploy (NÃO commitar)\n");
console.log(`MAILCOW_PASS=${secret(24)}`);
console.log(`MAILCOW_API_KEY=${secret(32)}`);
