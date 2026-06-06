import { spawn, exec, type ChildProcess } from "child_process";
import { promisify } from "util";
import {
  getServerProcess,
  setServerProcess,
  clearServerProcess,
} from "../settings/manager.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type {
  ProcessState,
  ProcessOperationResult,
  ProcessManagerInterface,
} from "./types.js";

const execAsync = promisify(exec);

let systemdServiceChecked = false;
let systemdServiceName: string | null = null;

/**
 * Detect if systemd is managing the OpenCode server.
 * Checks for known service names: opencode-serve, opencode-server, opencode.
 */
async function detectSystemdService(): Promise<string | null> {
  if (systemdServiceChecked) return systemdServiceName;
  systemdServiceChecked = true;

  if (process.platform === "win32") return null;

  const candidates = ["opencode-serve", "opencode-server", "opencode"];
  for (const name of candidates) {
    try {
      const { stdout } = await execAsync(
        `systemctl is-active ${name}.service 2>/dev/null`,
      );
      if (stdout.trim() === "active" || stdout.trim() === "inactive") {
        systemdServiceName = name;
        logger.info(`[ProcessManager] Detected systemd service: ${name}`);
        return name;
      }
    } catch {
      // service not found, try next
    }
  }
  logger.info(
    "[ProcessManager] No systemd service detected, will spawn directly",
  );
  return null;
}

/**
 * Singleton manager for OpenCode server process
 * Handles starting, stopping, and monitoring the server process
 * Persists PID to settings.json for recovery after bot restart
 */
class ProcessManager implements ProcessManagerInterface {
  private state: ProcessState = {
    process: null,
    pid: null,
    startTime: null,
    isRunning: false,
  };

  /**
   * Initialize the manager by restoring state from settings
   * Checks if the stored process is still alive
   */
  async initialize(): Promise<void> {
    const savedProcess = getServerProcess(0);

    if (!savedProcess) {
      logger.debug("[ProcessManager] No saved process found in settings");
      return;
    }

    logger.info(
      `[ProcessManager] Found saved process: PID=${savedProcess.pid}`,
    );

    // Check if the process is still alive
    if (this.isProcessAlive(savedProcess.pid)) {
      logger.info(
        `[ProcessManager] Process PID=${savedProcess.pid} is still alive, restoring state`,
      );

      this.state = {
        process: null, // Cannot recover ChildProcess reference
        pid: savedProcess.pid,
        startTime: new Date(savedProcess.startTime),
        isRunning: true,
      };
    } else {
      logger.warn(
        `[ProcessManager] Process PID=${savedProcess.pid} is dead, cleaning up`,
      );
      clearServerProcess(0);
    }
  }

  /**
   * Start the OpenCode server process
   * Uses systemd if a service is detected, otherwise spawns directly.
   */
  async start(): Promise<ProcessOperationResult> {
    if (this.state.isRunning) {
      return {
        success: false,
        error: "Process already running",
      };
    }

    const serviceName = await detectSystemdService();

    if (serviceName) {
      return this.startViaSystemd(serviceName);
    }

    return this.startDirect();
  }

  private async startViaSystemd(
    serviceName: string,
  ): Promise<ProcessOperationResult> {
    try {
      logger.info(
        `[ProcessManager] Starting via systemd: ${serviceName}.service`,
      );
      await execAsync(`sudo systemctl restart ${serviceName}.service`);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify it started
      const { stdout } = await execAsync(
        `systemctl is-active ${serviceName}.service`,
      );
      if (stdout.trim() !== "active") {
        throw new Error(`systemctl is-active returned: ${stdout.trim()}`);
      }

      // Try to get the PID
      let pid: number | null = null;
      try {
        const { stdout: pidOut } = await execAsync(
          `systemctl show --property MainPID ${serviceName}.service`,
        );
        const match = pidOut.match(/MainPID=(\d+)/);
        if (match && match[1] !== "0") {
          pid = parseInt(match[1], 10);
        }
      } catch {
        // ignore PID lookup failure
      }

      const startTime = new Date();
      this.state = {
        process: null, // Cannot control systemd-managed process directly
        pid,
        startTime,
        isRunning: true,
      };

      logger.info(
        `[ProcessManager] OpenCode server started via systemd (service=${serviceName}, PID=${pid})`,
      );
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error("[ProcessManager] Failed to start via systemd:", err);
      return { success: false, error: errorMessage };
    }
  }

  private async startDirect(): Promise<ProcessOperationResult> {
    try {
      logger.info(
        "[ProcessManager] Starting OpenCode server process directly...",
      );

      const isWindows = process.platform === "win32";

      // Extract port from config API URL so the spawned server matches
      const apiUrlPort = new URL(config.opencode.apiUrl).port;
      const args = isWindows
        ? ["/c", "opencode", "serve", "--port", apiUrlPort]
        : ["serve", "--port", apiUrlPort];
      const command = isWindows ? "cmd.exe" : "opencode";

      // Spawn the process
      // Windows: use cmd.exe to resolve npm-installed global commands
      // Unix-like: run opencode directly (PATH must include /home/anini39/.opencode/bin)
      const childProcess = spawn(command, args, {
        detached: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: isWindows,
      });

      if (!childProcess.pid) {
        throw new Error(
          "Failed to start OpenCode server process. Ensure 'opencode' is installed and available in PATH.",
        );
      }

      // Setup event handlers
      childProcess.on("error", (err) => {
        logger.error("[ProcessManager] Process error:", err);
        this.cleanup();
      });

      childProcess.on("exit", (code, signal) => {
        logger.info(
          `[ProcessManager] Process exited: code=${code}, signal=${signal}`,
        );
        this.cleanup();
      });

      // Log stdout/stderr
      if (childProcess.stdout) {
        childProcess.stdout.on("data", (data) => {
          logger.debug(`[OpenCode Server] ${data.toString().trim()}`);
        });
      }

      if (childProcess.stderr) {
        childProcess.stderr.on("data", (data) => {
          logger.warn(`[OpenCode Server Error] ${data.toString().trim()}`);
        });
      }

      // Save state in memory
      const startTime = new Date();
      this.state = {
        process: childProcess,
        pid: childProcess.pid,
        startTime,
        isRunning: true,
      };

      // Persist to settings.json
      setServerProcess(0, {
        pid: childProcess.pid,
        startTime: startTime.toISOString(),
      });

      logger.info(
        `[ProcessManager] OpenCode server started with PID=${childProcess.pid}`,
      );

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error("[ProcessManager] Failed to start process:", err);
      this.cleanup();
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Stop the OpenCode server process
   * Sends SIGINT (Ctrl+C) and waits for graceful shutdown
   * Falls back to SIGKILL if timeout is exceeded
   * Uses systemd if a service is detected.
   */
  async stop(timeoutMs: number = 5000): Promise<ProcessOperationResult> {
    if (!this.state.isRunning || !this.state.pid) {
      return {
        success: false,
        error: "Process not running",
      };
    }

    // If systemd is managing the service, use systemctl
    if (systemdServiceName) {
      return this.stopViaSystemd(systemdServiceName);
    }

    return this.stopDirect(timeoutMs);
  }

  private async stopViaSystemd(
    serviceName: string,
  ): Promise<ProcessOperationResult> {
    try {
      logger.info(
        `[ProcessManager] Stopping via systemd: ${serviceName}.service`,
      );
      await execAsync(`sudo systemctl stop ${serviceName}.service`);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const { stdout } = await execAsync(
        `systemctl is-active ${serviceName}.service`,
      );
      if (stdout.trim() === "active") {
        throw new Error("Service still active after stop");
      }

      this.cleanup();
      logger.info(
        `[ProcessManager] Service ${serviceName} stopped successfully`,
      );
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error("[ProcessManager] Failed to stop via systemd:", err);
      return { success: false, error: errorMessage };
    }
  }

  private async stopDirect(
    timeoutMs: number = 5000,
  ): Promise<ProcessOperationResult> {
    try {
      const pid = this.state.pid!;
      logger.info(`[ProcessManager] Stopping process PID=${pid}...`);

      // On Windows, use taskkill to kill the entire process tree
      // This is necessary because cmd.exe spawns child processes
      if (process.platform === "win32") {
        try {
          // /F = force terminate, /T = terminate tree, /PID = process id
          logger.debug(
            `[ProcessManager] Using taskkill to terminate process tree for PID=${pid}`,
          );
          await execAsync(`taskkill /F /T /PID ${pid}`);
          logger.info(
            `[ProcessManager] Process tree terminated successfully for PID=${pid}`,
          );
        } catch (err) {
          // taskkill returns error if process not found, which is ok
          const error = err as Error & { code?: number };
          if (error.message?.includes("not found")) {
            logger.debug(
              `[ProcessManager] Process PID=${pid} already terminated`,
            );
          } else {
            logger.warn(`[ProcessManager] taskkill error for PID=${pid}:`, err);
          }
        }

        // Wait a bit for cleanup
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        // Unix-like systems: use SIGINT/SIGKILL
        if (this.state.process) {
          const childProcess = this.state.process;

          // Send SIGINT (Ctrl+C)
          logger.debug(`[ProcessManager] Sending SIGINT to PID=${pid}`);
          childProcess.kill("SIGINT");

          // Wait for graceful shutdown
          const gracefulExit = await this.waitForProcessExit(
            childProcess,
            timeoutMs,
          );

          if (!gracefulExit && this.state.isRunning) {
            logger.warn(
              `[ProcessManager] Graceful shutdown failed, sending SIGKILL to PID=${pid}`,
            );
            childProcess.kill("SIGKILL");
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } else {
          // No ChildProcess reference (recovered from settings)
          logger.debug(`[ProcessManager] Sending SIGTERM to PID=${pid}`);
          try {
            process.kill(pid, "SIGTERM");
          } catch (err) {
            logger.debug(
              `[ProcessManager] Failed to send SIGTERM to PID=${pid}:`,
              err,
            );
          }

          // Wait for process to die
          await new Promise((resolve) => setTimeout(resolve, timeoutMs));

          // Check if still alive
          if (this.isProcessAlive(pid)) {
            logger.warn(
              `[ProcessManager] Graceful shutdown failed, sending SIGKILL to PID=${pid}`,
            );
            try {
              process.kill(pid, "SIGKILL");
            } catch (err) {
              logger.error(
                `[ProcessManager] Failed to send SIGKILL to PID=${pid}:`,
                err,
              );
            }
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      this.cleanup();
      logger.info(`[ProcessManager] Process PID=${pid} stopped successfully`);
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error("[ProcessManager] Failed to stop process:", err);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if the process is running
   * Validates that the process with stored PID is actually alive
   */
  isRunning(): boolean {
    if (!this.state.isRunning || !this.state.pid) {
      return false;
    }

    // Verify that the process is actually alive
    if (!this.isProcessAlive(this.state.pid)) {
      logger.warn(
        `[ProcessManager] Process PID=${this.state.pid} appears dead, cleaning up`,
      );
      this.cleanup();
      return false;
    }

    return true;
  }

  /**
   * Get the process ID of the running server
   */
  getPID(): number | null {
    return this.state.pid;
  }

  /**
   * Get the uptime of the server in milliseconds
   */
  getUptime(): number | null {
    if (!this.state.startTime || !this.state.isRunning) {
      return null;
    }
    return Date.now() - this.state.startTime.getTime();
  }

  /**
   * Check if a process with given PID is alive
   * Uses process.kill(pid, 0) which checks existence without killing
   */
  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for process to exit
   */
  private async waitForProcessExit(
    childProcess: ChildProcess,
    timeoutMs: number,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const exitHandler = () => {
        logger.debug("[ProcessManager] Process exited gracefully");
        resolve(true);
      };

      childProcess.once("exit", exitHandler);

      setTimeout(() => {
        childProcess.removeListener("exit", exitHandler);
        resolve(false);
      }, timeoutMs);
    });
  }

  /**
   * Clean up state and settings
   */
  private cleanup(): void {
    this.state = {
      process: null,
      pid: null,
      startTime: null,
      isRunning: false,
    };
    clearServerProcess(0);
  }
}

// Export singleton instance
export const processManager = new ProcessManager();
