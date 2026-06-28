function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toFixed(0)} MB`;
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

type HostRaw = {
  cpu?: { cores?: number; usage?: number };
  memory?: { total?: number; usage?: number };
  uptime?: number;
  system_time?: string;
  architecture?: string;
};

type VmailRaw = {
  disk?: string;
  used?: string;
  total?: string;
  used_percent?: string;
};

type ContainerRaw = Record<
  string,
  { container?: string; state?: string; image?: string; started_at?: string }
>;

export type AdminDashboard = {
  cpu: { cores: number; usagePercent: number };
  memory: {
    totalBytes: number;
    usagePercent: number;
    totalLabel: string;
    usedLabel: string;
  };
  disk: { used: string; total: string; usedPercent: string; device?: string };
  version: string;
  uptime: string;
  systemTime: string;
  architecture: string;
  containers: { name: string; state: string; image?: string }[];
  containersRunning: number;
  containersTotal: number;
};

export function buildAdminDashboard(
  host: HostRaw,
  vmail: VmailRaw,
  version: { version?: string },
  containers: ContainerRaw,
): AdminDashboard {
  const memTotal = Number(host.memory?.total ?? 0);
  const memUsagePct = Number(host.memory?.usage ?? 0);
  const memUsedBytes = memTotal > 0 ? (memTotal * memUsagePct) / 100 : 0;

  const containerList = Object.values(containers ?? {}).map((c) => ({
    name: c.container ?? "—",
    state: c.state ?? "unknown",
    image: c.image,
  }));

  return {
    cpu: {
      cores: Number(host.cpu?.cores ?? 0),
      usagePercent: Number(host.cpu?.usage ?? 0),
    },
    memory: {
      totalBytes: memTotal,
      usagePercent: memUsagePct,
      totalLabel: formatBytes(memTotal),
      usedLabel: formatBytes(memUsedBytes),
    },
    disk: {
      used: vmail.used ?? "—",
      total: vmail.total ?? "—",
      usedPercent: vmail.used_percent ?? "—",
      device: vmail.disk,
    },
    version: String(version.version ?? "—"),
    uptime: formatUptime(Number(host.uptime ?? 0)),
    systemTime: String(host.system_time ?? "—"),
    architecture: String(host.architecture ?? "—"),
    containers: containerList.sort((a, b) => a.name.localeCompare(b.name)),
    containersRunning: containerList.filter((c) => c.state === "running").length,
    containersTotal: containerList.length,
  };
}
