const express = require("express");
const router = express.Router();
const executeSSHCommand = require("../sshClient");
const {runShellCommand} = require("../sshShell");
// const { runShellCommand } = require("./sshShell"); // updated import (named export now)

/**
 * Extracts SSH config dynamically from request.
 * Priority: Authorization header (base64 JSON) > request body > query params
 *
 * Clients should send SSH credentials via the X-SSH-Config header as a base64-encoded JSON:
 * X-SSH-Config: base64({ host, port, username, password })
 *
 * OR via the request body (for POST routes):
 * { sshConfig: { host, port, username, password }, ...otherFields }
 */
function getSSHConfig(req) {
  // 1. Try X-SSH-Config header (base64 encoded JSON)
  const headerConfig = req.headers["x-ssh-config"];
  if (headerConfig) {
    try {
      const decoded = Buffer.from(headerConfig, "base64").toString("utf-8");
      const config = JSON.parse(decoded);
      if (config.host && config.username) return config;
    } catch (e) {
      // fall through
    }
  }

  // 2. Try Authorization Bearer token (base64 encoded JSON)
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const decoded = Buffer.from(token, "base64").toString("utf-8");
      const config = JSON.parse(decoded);
      if (config.host && config.username) return config;
    } catch (e) {
      // fall through
    }
  }

  // 3. Try request body sshConfig field (POST requests)
  if (req.body && req.body.sshConfig) {
    const { host, port, username, password, privateKey } = req.body.sshConfig;
    if (host && username) {
      return { host, port: port || 22, username, password, privateKey };
    }
  }

  // 4. Try query params (GET requests, less secure — only for dev/testing)
  const { ssh_host, ssh_port, ssh_user, ssh_pass } = req.query;
  if (ssh_host && ssh_user) {
    return {
      host: ssh_host,
      port: parseInt(ssh_port) || 22,
      username: ssh_user,
      password: ssh_pass,
    };
  }

  throw new Error(
    "SSH configuration missing. Provide credentials via X-SSH-Config header (base64 JSON), Authorization Bearer token, or request body sshConfig field."
  );
}

// ─── GET /system ────────────────────────────────────────────────────────────
router.get("/system", async (req, res) => {
    try {
      const sshConfig = getSSHConfig(req);
  
      const [cpuRaw, ramRaw, diskRaw, uptime] = await Promise.all([
        executeSSHCommand("top -bn1 | grep 'Cpu'", sshConfig),
        executeSSHCommand("free -m", sshConfig),
        executeSSHCommand("df -h /", sshConfig),
        executeSSHCommand("uptime -p", sshConfig),
      ]);
  
      // CPU %
      const cpuMatch = cpuRaw.match(/(\d+\.\d+)\s*id/);
      const cpuUsage = cpuMatch ? (100 - parseFloat(cpuMatch[1])).toFixed(1) : "0";
  
      // RAM %
      const ramLine = ramRaw.split("\n")[1].split(/\s+/);
      const totalRam = parseFloat(ramLine[1]);
      const usedRam = parseFloat(ramLine[2]);
      const ramUsage = ((usedRam / totalRam) * 100).toFixed(1);
  
      // Disk %
      const diskLine = diskRaw.split("\n")[1].split(/\s+/);
      const diskUsage = diskLine[4];
  
      res.json({
        cpu: `${cpuUsage}%`,
        ram: `${ramUsage}%`,
        disk: diskUsage,
        uptime: uptime.trim(),
      });
  
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

// ─── POST /execute ───────────────────────────────────────────────────────────

router.post("/execute", async (req, res) => {
  try {
    const sshConfig = getSSHConfig(req);
    const { command } = req.body;

    if (!command)
      return res.status(400).json({ error: "command is required" });

    const result = await runShellCommand(command, sshConfig);

    const cleanOutput = (raw) =>
      (raw || "")
        .replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, "")  // ANSI escape codes
        .replace(/\x1B\][0-9];.*?\x07/g, "")       // OSC sequences
        .replace(/\r/g, "")                         // carriage returns
        .trim();

    if (result.requiresInput) {
      // Shell is waiting for a password / yes-no / etc.
      return res.json({
        output: cleanOutput(result.output),
        requiresInput: true,
        prompt: result.prompt,
        isPassword: result.isPassword,
      });
    }

    // Normal completed command
    return res.json({
      output: cleanOutput(result.output),
      requiresInput: false,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /processes ──────────────────────────────────────────────────────────
router.get("/processes", async (req, res) => {

    const sshConfig = getSSHConfig(req);
  
    const output = await executeSSHCommand(
      "ps -eo user,pid,%cpu,%mem,comm --sort=-%cpu | head -20",
      sshConfig
    );
  
    const lines = output.trim().split("\n").slice(1);
  
    const processes = lines.map(line => {
      const parts = line.trim().split(/\s+/);
  
      return {
        user: parts[0],
        pid: parts[1],
        cpu: parts[2],
        mem: parts[3],
        command: parts.slice(4).join(" ")
      };
    });
  
    res.json({ processes });
  
  });

// ─── POST /kill-process ──────────────────────────────────────────────────────
router.post("/kill-process", async (req, res) => {
  try {
    const sshConfig = getSSHConfig(req);
    const { pid } = req.body;
    if (!pid) return res.status(400).json({ error: "pid is required" });
    const result = await executeSSHCommand(`kill ${pid}`, sshConfig);
    res.json({ message: "Process killed", result });
  } catch (err) {
    res.status(err.message.includes("SSH configuration") ? 400 : 500).json({
      error: err.message,
    });
  }
});

// ─── GET /services ───────────────────────────────────────────────────────────
router.get("/services", async (req, res) => {
    try {
      const sshConfig = getSSHConfig(req);
  
      const output = await executeSSHCommand(
        "systemctl list-units --type=service --state=running --no-pager --no-legend",
        sshConfig
      );
  
      const services = output.split("\n")
        .filter(Boolean)
        .map(line => {
          const parts = line.trim().split(/\s+/);
          return {
            name: parts[0],
            status: parts[3],
            description: parts.slice(4).join(" ")
          };
        });
  
      res.json({ services });
  
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

// ─── POST /start-service ─────────────────────────────────────────────────────
router.post("/start-service", async (req, res) => {
  try {
    const sshConfig = getSSHConfig(req);
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const result = await executeSSHCommand(
      `sudo systemctl start ${name}`,
      sshConfig
    );
    res.json({ message: "Service started", result });
  } catch (err) {
    res.status(err.message.includes("SSH configuration") ? 400 : 500).json({
      error: err.message,
    });
  }
});

// ─── POST /stop-service ──────────────────────────────────────────────────────
router.post("/stop-service", async (req, res) => {
  try {
    const sshConfig = getSSHConfig(req);
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const result = await executeSSHCommand(
      `sudo systemctl stop ${name}`,
      sshConfig
    );
    res.json({ message: "Service stopped", result });
  } catch (err) {
    res.status(err.message.includes("SSH configuration") ? 400 : 500).json({
      error: err.message,
    });
  }
});

// ─── POST /restart-service ───────────────────────────────────────────────────
router.post("/restart-service", async (req, res) => {
  try {
    const sshConfig = getSSHConfig(req);
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const result = await executeSSHCommand(
      `sudo systemctl restart ${name}`,
      sshConfig
    );
    res.json({ message: "Service restarted", result });
  } catch (err) {
    res.status(err.message.includes("SSH configuration") ? 400 : 500).json({
      error: err.message,
    });
  }
});

// ─── GET /files ──────────────────────────────────────────────────────────────
router.get("/files", async (req, res) => {
    try {
      const sshConfig = getSSHConfig(req);
      const path = req.query.path || ".";
  
      const output = await executeSSHCommand(
        `ls -l ${path}`,
        sshConfig
      );
  
      const files = output.split("\n")
        .slice(1)
        .filter(Boolean)
        .map(line => {
          const parts = line.trim().split(/\s+/);
          return {
            name: parts.slice(8).join(" "),
            size: parts[4],
            type: parts[0].startsWith("d") ? "folder" : "file",
          };
        });
  
      res.json({ files });
  
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

// ─── GET /read-file ──────────────────────────────────────────────────────────
router.get("/read-file", async (req, res) => {
  try {
    const sshConfig = getSSHConfig(req);
    const { path } = req.query;
    if (!path) return res.status(400).json({ error: "path is required" });
    const content = await executeSSHCommand(`cat ${path}`, sshConfig);
    res.json({ content });
  } catch (err) {
    res.status(err.message.includes("SSH configuration") ? 400 : 500).json({
      error: err.message,
    });
  }
});

// ─── GET /monitor ────────────────────────────────────────────────────────────
router.get("/monitor", async (req, res) => {
    try {
      const sshConfig = getSSHConfig(req);
  
      const [cpuRaw, ramRaw] = await Promise.all([
        executeSSHCommand("top -bn1 | grep 'Cpu'", sshConfig),
        executeSSHCommand("free -m", sshConfig),
      ]);
  
      const cpuMatch = cpuRaw.match(/(\d+\.\d+)\s*id/);
      const cpuUsage = cpuMatch ? (100 - parseFloat(cpuMatch[1])).toFixed(1) : "0";
  
      const ramLine = ramRaw.split("\n")[1].split(/\s+/);
      const totalRam = parseFloat(ramLine[1]);
      const usedRam = parseFloat(ramLine[2]);
      const ramUsage = ((usedRam / totalRam) * 100).toFixed(1);
  
      res.json({
        cpu: `${cpuUsage}%`,
        ram: `${ramUsage}%`,
      });
  
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

module.exports = router;
