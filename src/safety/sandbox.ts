import { spawn, execSync } from "child_process";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { logger } from "../utils/logger.js";
import { sanitizeEnv } from "./env-sanitizer.js";

export interface SandboxOptions {
  allowNetwork?: boolean;
  timeoutMs?: number;
  workingDir?: string;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  securityReport: SecurityReport;
}

export interface SecurityReport {
  sensitiveAccess: string[];
  networkAttempts: string[];
  fileAccesses: string[];
}

const SENSITIVE_PATTERNS = [
  { pattern: /\/etc\/shadow/, type: "sensitive_file" },
  { pattern: /\/etc\/passwd/, type: "sensitive_file" },
  { pattern: /\.ssh\//, type: "sensitive_dir" },
  { pattern: /\/home\//, type: "home_access" },
  { pattern: /\.aws\//, type: "credentials" },
  { pattern: /\.docker\/config\.json/, type: "credentials" },
  { pattern: /\/root\//, type: "root_access" },
  { pattern: /\/proc\/\d+\/environ/, type: "process_env" },
  { pattern: /\/proc\/self\/environ/, type: "process_env" },
  { pattern: /keyring\//, type: "keyring" },
  { pattern: /credentials\//, type: "credentials" },
];

const NETWORK_PATTERNS = [
  { pattern: /curl\s+http/, type: "http_request" },
  { pattern: /wget\s+http/, type: "http_request" },
  { pattern: /fetch\s+http/, type: "http_request" },
  { pattern: /\s+--connect-to:/, type: "proxy_connection" },
  { pattern: /telnet\s+/, type: "telnet" },
  { pattern: /nc\s+(-[el]|--exec)/, type: "netcat_shell" },
  { pattern: /ncat\s+/, type: "ncat" },
  { pattern: /socat\s+/, type: "socat" },
  { pattern: /\bcurl\b/, type: "curl" },
  { pattern: /\bwget\b/, type: "wget" },
  { pattern: /\bfetch\b/, type: "fetch" },
];

function analyzeSecurityRisks(command: string, stdout: string, stderr: string): SecurityReport {
  const combined = `${command} ${stdout} ${stderr}`;
  const sensitiveAccess: string[] = [];
  const networkAttempts: string[] = [];
  const fileAccesses: string[] = [];

  for (const { pattern, type } of SENSITIVE_PATTERNS) {
    if (pattern.test(combined)) {
      sensitiveAccess.push(type);
    }
  }

  for (const { pattern, type } of NETWORK_PATTERNS) {
    if (pattern.test(command)) {
      networkAttempts.push(type);
    }
  }

  if (/access|read|open|cat\s+\/etc/.test(combined)) {
    fileAccesses.push("filesystem_probe");
  }

  return {
    sensitiveAccess: [...new Set(sensitiveAccess)],
    networkAttempts: [...new Set(networkAttempts)],
    fileAccesses: [...new Set(fileAccesses)],
  };
}

export function isBwrapAvailable(): boolean {
  try {
    execSync("which bwrap", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export async function runInSandbox(
  command: string,
  options: SandboxOptions = {}
): Promise<SandboxResult> {
  const { allowNetwork = false, timeoutMs = 30000 } = options;

  if (!isBwrapAvailable()) {
    logger.warn("[Sandbox] bubblewrap not available, running without sandbox");
    return runDirect(command, timeoutMs);
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sandbox-"));
  const sandboxHome = path.join(tmpDir, "home");

  try {
    await fs.mkdir(sandboxHome, { mode: 0o755 });
  } catch {
    // ignore
  }

  const bwrapArgs = [
    "--die-with-parent",
    "--as-pid-1",
    "--new-session",
    "--unshare-pid",
    "--unshare-user",
    "--unshare-ipc",
    "--unshare-uts",
    "--chdir", sandboxHome,
    "--clearenv", // Environment is already stripped by bubblewrap
    "--setenv", "HOME", sandboxHome,
    "--setenv", "TMPDIR", "/tmp",
    "--setenv", "PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "--tmpfs", "/tmp",
    "--tmpfs", "/var/tmp",
    "--proc", "/proc",
    "--dev", "/dev",
    "--ro-bind-try", "/bin", "/bin",
    "--ro-bind-try", "/lib", "/lib",
    "--ro-bind-try", "/lib64", "/lib64",
    "--ro-bind-try", "/usr", "/usr",
    "--ro-bind-try", "/etc/alternatives", "/etc/alternatives",
    "--dir", sandboxHome,
  ];

  if (!allowNetwork) {
    bwrapArgs.push("--unshare-net");
  }

  bwrapArgs.push("--");
  bwrapArgs.push("/bin/sh", "-c", command);

  return new Promise<SandboxResult>((resolve) => {
    const startTime = Date.now();
    let timedOut = false;
    let stdout = "";
    let stderr = "";

    logger.debug(`[Sandbox] Starting bubblewrap sandbox: ${command}`);

    const proc = spawn("bwrap", bwrapArgs, {
      cwd: sandboxHome,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      logger.warn(`[Sandbox] Command timed out after ${timeoutMs}ms: ${command}`);
      proc.kill("SIGKILL");
    }, timeoutMs);

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      const elapsed = Date.now() - startTime;

      logger.debug(`[Sandbox] Command finished in ${elapsed}ms with code ${code}`);

      const securityReport = analyzeSecurityRisks(command, stdout, stderr);

      if (securityReport.sensitiveAccess.length > 0) {
        logger.warn(`[Sandbox] Sensitive access detected: ${securityReport.sensitiveAccess.join(", ")}`);
      }

      if (securityReport.networkAttempts.length > 0) {
        logger.warn(`[Sandbox] Network attempts detected: ${securityReport.networkAttempts.join(", ")}`);
      }

      resolve({
        stdout,
        stderr,
        exitCode: code,
        timedOut,
        securityReport,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      logger.error(`[Sandbox] Process error: ${err.message}`);

      resolve({
        stdout,
        stderr: stderr + `\nSandbox error: ${err.message}`,
        exitCode: null,
        timedOut,
        securityReport: analyzeSecurityRisks(command, stdout, stderr),
      });
    });
  });
}

async function runDirect(command: string, timeoutMs: number): Promise<SandboxResult> {
  return new Promise<SandboxResult>((resolve) => {
    let timedOut = false;
    let stdout = "";
    let stderr = "";

    // Use sanitized environment - strip sensitive credentials
    const safeEnv = sanitizeEnv();

    const proc = spawn("/bin/sh", ["-c", command], {
      stdio: ["ignore", "pipe", "pipe"],
      env: safeEnv,
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, timeoutMs);

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr,
        exitCode: code,
        timedOut,
        securityReport: analyzeSecurityRisks(command, stdout, stderr),
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr: stderr + `\nError: ${err.message}`,
        exitCode: null,
        timedOut,
        securityReport: analyzeSecurityRisks(command, stdout, stderr),
      });
    });
  });
}

export function formatSecurityPreview(report: SecurityReport): string {
  const parts: string[] = [];

  if (report.sensitiveAccess.length > 0) {
    const emojis = report.sensitiveAccess.map((access) => {
      if (access.includes("credential") || access.includes("keyring")) return "🔐";
      if (access.includes("shadow") || access.includes("passwd")) return "🔒";
      return "⚠️";
    });
    parts.push(`${emojis.join("")} <b>Access to sensitive resources:</b>\n  ${report.sensitiveAccess.join(", ")}`);
  }

  if (report.networkAttempts.length > 0) {
    const emojis = report.networkAttempts.map(() => "🌐");
    parts.push(`${emojis.join("")} <b>Network activity detected:</b>\n  ${report.networkAttempts.join(", ")}`);
  }

  if (report.fileAccesses.length > 0) {
    parts.push(`📁 <b>Filesystem probing detected:</b>\n  ${report.fileAccesses.join(", ")}`);
  }

  if (parts.length === 0) {
    parts.push("✅ <b>No suspicious activity detected</b>");
  }

  return parts.join("\n\n");
}

export function shouldUseSandbox(command: string): boolean {
  const scriptPatterns = [
    /\.sh$/,
    /bash\s+/,
    /sh\s+-c/,
    /source\s+/,
    /exec\s+/,
    /curl\s+.*\|/,
    /wget\s+.*\|/,
    /\|\s*sh/,
    /\|\s*bash/,
  ];

  const urlPatterns = [
    /https?:\/\//,
    /ftp:\/\//,
  ];

  for (const pattern of scriptPatterns) {
    if (pattern.test(command)) {
      return true;
    }
  }

  for (const pattern of urlPatterns) {
    if (pattern.test(command)) {
      return true;
    }
  }

  return false;
}

export async function runScriptSafely(
  script: string,
  options: SandboxOptions = {}
): Promise<SandboxResult> {
  const scriptPath = path.join(os.tmpdir(), `sandbox-script-${Date.now()}.sh`);

  try {
    await fs.writeFile(scriptPath, script, { mode: 0o755 });

    const shellCommand = `/bin/sh "${scriptPath}"`;
    const result = await runInSandbox(shellCommand, options);

    return result;
  } finally {
    try {
      await fs.unlink(scriptPath);
    } catch {
      // ignore cleanup errors
    }
  }
}

export async function downloadAndAnalyzeUrl(
  url: string,
  options: SandboxOptions = {}
): Promise<SandboxResult> {
  const allowNetwork = options.allowNetwork ?? true;

  if (!allowNetwork) {
    logger.warn("[Sandbox] Cannot download URL without network access");
    return {
      stdout: "",
      stderr: "Network access is required to download URLs but sandbox network is disabled",
      exitCode: 1,
      timedOut: false,
      securityReport: {
        sensitiveAccess: [],
        networkAttempts: ["url_download_blocked"],
        fileAccesses: [],
      },
    };
  }

  const command = `curl -sL -A "SandboxAnalysis/1.0" "${url}" 2>&1 || wget -qO- "${url}" 2>&1`;
  const result = await runInSandbox(command, { ...options, allowNetwork: true });

  return result;
}
