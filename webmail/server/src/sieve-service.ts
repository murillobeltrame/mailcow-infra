import net from "node:net";
import { config } from "./config.js";

function sieveCommand(tag: string, cmd: string) {
  return `${tag} ${cmd}\r\n`;
}

async function sieveTalk(
  email: string,
  password: string,
  handler: (send: (cmd: string) => void, lines: string[]) => Promise<void>,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    let buffer = "";
    let tag = 0;
    const socket = net.connect(config.sievePort, config.sieveHost);

    const send = (cmd: string) => {
      tag += 1;
      socket.write(sieveCommand(`a${String(tag).padStart(3, "0")}`, cmd));
    };

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const parts = buffer.split("\r\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        if (line) lines.push(line);
      }
    });

    socket.on("error", reject);

    socket.on("connect", async () => {
      try {
        await new Promise((r) => setTimeout(r, 200));
        send(`LOGIN "${email.replace(/"/g, '\\"')}" "${password.replace(/"/g, '\\"')}"`);
        await new Promise((r) => setTimeout(r, 300));
        await handler(send, lines);
        socket.end();
        resolve(lines);
      } catch (e) {
        socket.destroy();
        reject(e);
      }
    });
  });
}

export async function listSieveScripts(email: string, password: string) {
  const lines = await sieveTalk(email, password, async (send) => {
    send("LISTSCRIPTS");
  });
  const scripts: { name: string; active: boolean }[] = [];
  for (const line of lines) {
    const m = line.match(/^"([^"]+)"( ACTIVE)?/);
    if (m) scripts.push({ name: m[1]!, active: Boolean(m[2]) });
  }
  return scripts;
}

export async function getActiveSieveScript(email: string, password: string): Promise<string> {
  const scripts = await listSieveScripts(email, password);
  const active = scripts.find((s) => s.active)?.name ?? scripts[0]?.name;
  if (!active) return "";
  const lines = await sieveTalk(email, password, async (send) => {
    send(`GETSCRIPT "${active.replace(/"/g, '\\"')}"`);
  });
  const start = lines.findIndex((l) => l.startsWith("{"));
  if (start === -1) return lines.join("\n");
  return lines.slice(start + 1).join("\n");
}

export async function putSieveScript(email: string, password: string, name: string, content: string) {
  await sieveTalk(email, password, async (send) => {
    const bytes = Buffer.byteLength(content, "utf8");
    send(`PUTSCRIPT "${name.replace(/"/g, '\\"')}" {${bytes}+}\r\n${content}`);
    send(`SETACTIVE "${name.replace(/"/g, '\\"')}"`);
  });
}
