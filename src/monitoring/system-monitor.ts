import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";
import { Bot, Context } from "grammy";

const execAsync = promisify(exec);

interface SystemMetrics {
  diskUsage: number; // percentage
  memoryUsage: number; // percentage
  memoryUsedGB: number; // absolute GB used
  memoryTotalGB: number; // absolute GB total
  loadAverage: number; // 1-minute load average
  cpuTemp: number | null; // Celsius, null if not available
  diskHealth: DiskHealth | null; // disk SMART status
}

interface DiskHealth {
  name: string;
  status: "ok" | "warning" | "critical";
  message: string;
}

interface AlertThresholds {
  diskWarning: number; // 90%
  diskCritical: number; // 95%
  memoryWarning: number; // 85% (kept for backward compat, not used for alert generation)
  memoryCritical: number; // 95% (kept for backward compat, not used for alert generation)
  memoryWarningGB: number; // 12.5 GB absolute
  memoryCriticalGB: number; // 14.0 GB absolute
  loadWarning: number; // number of CPUs
  cpuTempWarning: number; // 80C
  cpuTempCritical: number; // 90C
}

interface SystemAlert {
  type: "disk" | "memory" | "load" | "cpu_temp" | "disk_health";
  level: "warning" | "critical";
  message: string;
  value: number;
  threshold: number;
}

let botInstance: Bot<Context> | null = null;
let userId: number | null = null;
let checkInterval: NodeJS.Timeout | null = null;
const lastAlertTime: Map<string, number> = new Map();
const sustainedAlertStart: Map<string, number> = new Map();
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes between same alert type
const SUSTAIN_THRESHOLD_MS = 15_000; // alert must persist 15s before firing

const DEFAULT_THRESHOLDS: AlertThresholds = {
  diskWarning: 90,
  diskCritical: 95,
  memoryWarning: 85,
  memoryCritical: 95,
  memoryWarningGB: 12.5,
  memoryCriticalGB: 14.0,
  loadWarning: 4, // Will be adjusted based on CPU count
  cpuTempWarning: 80,
  cpuTempCritical: 90,
};

export interface MonitoringOptions {
  userId: number;
  diskWarning?: number;
  diskCritical?: number;
  memoryWarning?: number;
  memoryCritical?: number;
  memoryWarningGB?: number;
  memoryCriticalGB?: number;
  checkIntervalMinutes?: number;
}

export function initializeSystemMonitoring(bot: Bot<Context>): void {
  botInstance = bot;
  logger.info("[SystemMonitor] Initialized");
}

export function startSystemMonitoring(options: MonitoringOptions): void {
  if (checkInterval) {
    logger.warn("[SystemMonitor] Already running, stopping first");
    stopSystemMonitoring();
  }
  
  userId = options.userId;
  const thresholds: AlertThresholds = {
    diskWarning: options.diskWarning ?? DEFAULT_THRESHOLDS.diskWarning,
    diskCritical: options.diskCritical ?? DEFAULT_THRESHOLDS.diskCritical,
    memoryWarning: options.memoryWarning ?? DEFAULT_THRESHOLDS.memoryWarning,
    memoryCritical: options.memoryCritical ?? DEFAULT_THRESHOLDS.memoryCritical,
    memoryWarningGB: options.memoryWarningGB ?? DEFAULT_THRESHOLDS.memoryWarningGB,
    memoryCriticalGB: options.memoryCriticalGB ?? DEFAULT_THRESHOLDS.memoryCriticalGB,
    loadWarning: DEFAULT_THRESHOLDS.loadWarning,
    cpuTempWarning: DEFAULT_THRESHOLDS.cpuTempWarning,
    cpuTempCritical: DEFAULT_THRESHOLDS.cpuTempCritical,
  };
  
  const intervalMs = (options.checkIntervalMinutes ?? 5) * 60 * 1000;
  
  logger.info(`[SystemMonitor] Started with ${intervalMs}ms interval`);
  
  // Run first check after a short delay
  setTimeout(() => {
    void checkSystemHealth(thresholds);
  }, 10000);
  
  // Schedule periodic checks
  checkInterval = setInterval(() => {
    void checkSystemHealth(thresholds);
  }, intervalMs);
}

export function stopSystemMonitoring(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  logger.info("[SystemMonitor] Stopped");
}

export function isSystemMonitoringRunning(): boolean {
  return checkInterval !== null;
}

async function checkSystemHealth(thresholds: AlertThresholds): Promise<void> {
  if (!botInstance || !userId) {
    return;
  }
  
  try {
    const metrics = await getSystemMetrics();
    const alerts = generateAlerts(metrics, thresholds);

    // disk_health alerts bypass the gate — SMART failures are persistent, alert immediately
    const diskHealthAlerts = alerts.filter(a => a.type === "disk_health");
    for (const alert of diskHealthAlerts) {
      await sendAlert(alert);
    }

    // All other alert types enter the 15-second persistence gate
    const gatedAlerts = alerts.filter(a => a.type !== "disk_health");
    const activeKeys = new Set(gatedAlerts.map(a => `${a.type}-${a.level}`));

    let hasNewAlerts = false;
    for (const alert of gatedAlerts) {
      const key = `${alert.type}-${alert.level}`;
      if (!sustainedAlertStart.has(key)) {
        sustainedAlertStart.set(key, Date.now());
        hasNewAlerts = true;
      }
    }

    // Clear entries for conditions that are no longer active
    for (const key of [...sustainedAlertStart.keys()]) {
      if (!activeKeys.has(key)) {
        sustainedAlertStart.delete(key);
      }
    }

    // Schedule confirmation for newly detected alerts
    if (hasNewAlerts) {
      setTimeout(() => void confirmAndSendAlerts(thresholds), SUSTAIN_THRESHOLD_MS);
    }
  } catch (err) {
    logger.error("[SystemMonitor] Error checking system health:", err);
  }
}

async function confirmAndSendAlerts(thresholds: AlertThresholds): Promise<void> {
  if (!botInstance || !userId) {
    return;
  }

  try {
    const metrics = await getSystemMetrics();
    const alerts = generateAlerts(metrics, thresholds);
    const now = Date.now();
    const activeKeys = new Set(alerts.map(a => `${a.type}-${a.level}`));

    for (const alert of alerts.filter(a => a.type !== "disk_health")) {
      const key = `${alert.type}-${alert.level}`;
      const startTime = sustainedAlertStart.get(key);
      if (startTime !== undefined && now - startTime >= SUSTAIN_THRESHOLD_MS) {
        await sendAlert(alert);
      }
    }

    // Clean up entries for conditions that cleared before confirmation
    for (const key of [...sustainedAlertStart.keys()]) {
      if (!activeKeys.has(key)) {
        sustainedAlertStart.delete(key);
      }
    }
  } catch (err) {
    logger.error("[SystemMonitor] Error in confirmAndSendAlerts:", err);
  }
}

async function getSystemMetrics(): Promise<SystemMetrics> {
  let diskUsage = 0;
  let memoryUsage = 0;
  let memoryUsedGB = 0;
  let memoryTotalGB = 0;
  let loadAverage = 0;

  try {
    const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'");
    diskUsage = parseInt(stdout.trim(), 10) || 0;
  } catch (err) {
    logger.warn("[SystemMonitor] Failed to read disk usage:", err);
  }

  try {
    const { stdout } = await execAsync("free -b | grep Mem");
    const parts = stdout.trim().split(/\s+/);
    // free -b columns: Mem: total used free shared buff/cache available
    const totalBytes = parseInt(parts[1], 10) || 0;
    const usedBytes = parseInt(parts[2], 10) || 0;
    if (totalBytes > 0) {
      memoryUsage = Math.round((usedBytes / totalBytes) * 100);
      memoryUsedGB = usedBytes / (1024 ** 3);
      memoryTotalGB = totalBytes / (1024 ** 3);
    }
  } catch (err) {
    logger.warn("[SystemMonitor] Failed to read memory usage:", err);
  }

  try {
    const { stdout } = await execAsync("cat /proc/loadavg | awk '{print $1}'");
    loadAverage = parseFloat(stdout.trim()) || 0;
  } catch (err) {
    logger.warn("[SystemMonitor] Failed to read load average:", err);
  }

  const cpuTemp = await getCpuTemperature();
  const diskHealth = await getDiskHealth();

  return {
    diskUsage,
    memoryUsage,
    memoryUsedGB,
    memoryTotalGB,
    loadAverage,
    cpuTemp,
    diskHealth,
  };
}

async function getCpuTemperature(): Promise<number | null> {
  try {
    const { stdout } = await execAsync(
      "sensors 2>/dev/null | grep 'Core 0' | awk '{print $3}' | sed 's/+//' | sed 's/°C//'"
    );
    const temp = parseFloat(stdout.trim());
    if (!isNaN(temp) && temp > 0) return temp;

    const { stdout: stdout2 } = await execAsync(
      "sensors 2>/dev/null | grep 'Package id 0' | awk '{print $4}' | sed 's/+//' | sed 's/°C//'"
    );
    const temp2 = parseFloat(stdout2.trim());
    return !isNaN(temp2) && temp2 > 0 ? temp2 : null;
  } catch {
    return null;
  }
}

async function getDiskHealth(): Promise<DiskHealth | null> {
  try {
    const { stdout: diskStdout } = await execAsync(
      "lsblk -d -n -o NAME,TYPE | grep disk | head -1 | awk '{print $1}'"
    );
    const diskName = diskStdout.trim() || "sda";

    let smartOutput = "";
    try {
      const { stdout } = await execAsync(
        `smartctl -H /dev/${diskName} 2>/dev/null | grep -E 'SMART overall-health|PASSED|FAILED' | head -3`
      );
      smartOutput = stdout.trim();
    } catch {
      // smartctl not installed or permission denied
    }

    if (smartOutput.toLowerCase().includes("failed") || smartOutput.toLowerCase().includes("critical")) {
      return {
        name: diskName,
        status: "critical",
        message: "Disk has critical SMART errors. Consider backup and replacement.",
      };
    }

    let reallocOutput = "";
    try {
      const { stdout } = await execAsync(
        `smartctl -A /dev/${diskName} 2>/dev/null | grep -E 'Reallocated_Sector|Current_Pending_Sector' | head -2`
      );
      reallocOutput = stdout.trim();
    } catch {
      // ignore
    }

    const hasRealloc = /Sector.*[1-9]/.test(reallocOutput);
    if (hasRealloc) {
      return {
        name: diskName,
        status: "warning",
        message: `Disk has reallocated sectors. Backup recommended.`,
      };
    }

    if (smartOutput.toLowerCase().includes("passed") || smartOutput.toLowerCase().includes("smart overall-health")) {
      return {
        name: diskName,
        status: "ok",
        message: "Disk health OK",
      };
    }

    return {
      name: diskName,
      status: "ok",
      message: "Disk health check not available",
    };
  } catch {
    return null;
  }
}

function generateAlerts(
  metrics: SystemMetrics,
  thresholds: AlertThresholds
): SystemAlert[] {
  const alerts: SystemAlert[] = [];
  
  // Disk alerts
  if (metrics.diskUsage >= thresholds.diskCritical) {
    alerts.push({
      type: "disk",
      level: "critical",
      message: `🚨 <b>CRITICAL:</b> Disk usage is at <b>${metrics.diskUsage}%</b>!\n\nFree up space immediately to prevent system issues.`,
      value: metrics.diskUsage,
      threshold: thresholds.diskCritical,
    });
  } else if (metrics.diskUsage >= thresholds.diskWarning) {
    alerts.push({
      type: "disk",
      level: "warning",
      message: `⚠️ <b>Warning:</b> Disk usage is at <b>${metrics.diskUsage}%</b>.\n\nConsider cleaning up old files.`,
      value: metrics.diskUsage,
      threshold: thresholds.diskWarning,
    });
  }
  
  // Memory alerts (GB-based)
  if (metrics.memoryUsedGB >= thresholds.memoryCriticalGB) {
    alerts.push({
      type: "memory",
      level: "critical",
      message: `🚨 <b>CRITICAL:</b> Memory usage is at <b>${metrics.memoryUsedGB.toFixed(1)} GB / ${metrics.memoryTotalGB.toFixed(1)} GB</b> (${metrics.memoryUsage}%)!\n\nClose unnecessary applications or restart services.`,
      value: metrics.memoryUsedGB,
      threshold: thresholds.memoryCriticalGB,
    });
  } else if (metrics.memoryUsedGB >= thresholds.memoryWarningGB) {
    alerts.push({
      type: "memory",
      level: "warning",
      message: `⚠️ <b>Warning:</b> Memory usage is at <b>${metrics.memoryUsedGB.toFixed(1)} GB / ${metrics.memoryTotalGB.toFixed(1)} GB</b> (${metrics.memoryUsage}%).\n\nMonitor for memory leaks.`,
      value: metrics.memoryUsedGB,
      threshold: thresholds.memoryWarningGB,
    });
  }
  
  // Load average alerts
  if (metrics.loadAverage >= thresholds.loadWarning * 1.5) {
    alerts.push({
      type: "load",
      level: "critical",
      message: `🚨 <b>CRITICAL:</b> System load is very high: <b>${metrics.loadAverage}</b>\n\nCheck for runaway processes.`,
      value: metrics.loadAverage,
      threshold: thresholds.loadWarning * 1.5,
    });
  } else if (metrics.loadAverage >= thresholds.loadWarning) {
    alerts.push({
      type: "load",
      level: "warning",
      message: `⚠️ <b>Warning:</b> System load is elevated: <b>${metrics.loadAverage}</b>`,
      value: metrics.loadAverage,
      threshold: thresholds.loadWarning,
    });
  }
  
  // CPU temperature alerts
  if (metrics.cpuTemp !== null) {
    if (metrics.cpuTemp >= thresholds.cpuTempCritical) {
      alerts.push({
        type: "cpu_temp",
        level: "critical",
        message: `🚨 <b>CRITICAL:</b> CPU temperature is at <b>${metrics.cpuTemp}°C</b>!\n\nThermal throttling or damage risk. Shut down immediately.`,
        value: metrics.cpuTemp,
        threshold: thresholds.cpuTempCritical,
      });
    } else if (metrics.cpuTemp >= thresholds.cpuTempWarning) {
      alerts.push({
        type: "cpu_temp",
        level: "warning",
        message: `⚠️ <b>Warning:</b> CPU temperature is at <b>${metrics.cpuTemp}°C</b>.\n\nCheck cooling and fans.`,
        value: metrics.cpuTemp,
        threshold: thresholds.cpuTempWarning,
      });
    }
  }
  
  // Disk health alerts
  if (metrics.diskHealth && metrics.diskHealth.status === "critical") {
    alerts.push({
      type: "disk_health",
      level: "critical",
      message: `🚨 <b>CRITICAL:</b> Disk <b>/dev/${metrics.diskHealth.name}</b> SMART status is critical!\n\n${metrics.diskHealth.message}`,
      value: 0,
      threshold: 0,
    });
  } else if (metrics.diskHealth && metrics.diskHealth.status === "warning") {
    alerts.push({
      type: "disk_health",
      level: "warning",
      message: `⚠️ <b>Warning:</b> Disk <b>/dev/${metrics.diskHealth.name}</b> SMART status is concerning.\n\n${metrics.diskHealth.message}`,
      value: 0,
      threshold: 0,
    });
  }
  
  return alerts;
}

async function sendAlert(alert: SystemAlert): Promise<void> {
  if (!botInstance || !userId) {
    return;
  }
  
  const alertKey = `${alert.type}-${alert.level}`;
  const lastTime = lastAlertTime.get(alertKey);
  const now = Date.now();
  
  if (lastTime && now - lastTime < ALERT_COOLDOWN_MS) {
    logger.debug(`[SystemMonitor] Alert ${alertKey} skipped (cooldown)`);
    return;
  }
  
  try {
    await botInstance.api.sendMessage(userId, alert.message, {
      parse_mode: "HTML",
      disable_notification: alert.level === "warning",
    });
    
    lastAlertTime.set(alertKey, now);
    logger.info(`[SystemMonitor] Sent ${alert.level} alert: ${alert.type}`);
  } catch (err) {
    logger.error("[SystemMonitor] Failed to send alert:", err);
  }
}

export async function manualHealthCheck(_chatId: number): Promise<string> {
  try {
    const metrics = await getSystemMetrics();
    
    const lines = [
      "📊 <b>System Health Check</b>",
      "",
      `💾 Disk Usage: ${metrics.diskUsage}%`,
      `🧠 Memory: ${metrics.memoryUsedGB.toFixed(1)} GB / ${metrics.memoryTotalGB.toFixed(1)} GB (${metrics.memoryUsage}%)`,
      `⚡ Load Average: ${metrics.loadAverage}`,
      "",
    ];
    
    if (metrics.cpuTemp !== null) {
      lines.push(`🌡️ CPU Temperature: ${metrics.cpuTemp}°C`);
    } else {
      lines.push(`🌡️ CPU Temperature: N/A (sensors not available)`);
    }
    
    if (metrics.diskHealth) {
      const healthIcon = metrics.diskHealth.status === "ok" ? "✅" : metrics.diskHealth.status === "warning" ? "⚠️" : "🚨";
      lines.push(`${healthIcon} Disk /dev/${metrics.diskHealth.name}: ${metrics.diskHealth.status.toUpperCase()}`);
      if (metrics.diskHealth.status !== "ok") {
        lines.push(`   ${metrics.diskHealth.message}`);
      }
    } else {
      lines.push(`💿 Disk Health: N/A (smartctl not available)`);
    }
    
    lines.push("");
    lines.push(metrics.diskUsage > 90 ? "⚠️ Disk space is low!" : "✅ Disk space OK");
    lines.push(metrics.memoryUsedGB > DEFAULT_THRESHOLDS.memoryWarningGB ? "⚠️ Memory usage is high!" : "✅ Memory usage OK");
    lines.push(metrics.loadAverage > 4 ? "⚠️ System load is high!" : "✅ System load OK");
    
    if (metrics.cpuTemp !== null) {
      lines.push(metrics.cpuTemp > 80 ? "⚠️ CPU temperature is high!" : "✅ CPU temperature OK");
    }
    
    return lines.join("\n");
  } catch (err) {
    logger.error("[SystemMonitor] Manual health check failed:", err);
    return "❌ Failed to check system health.";
  }
}
