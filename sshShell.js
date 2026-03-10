const { Client } = require("ssh2");

let connection = null;
let shellStream = null;

// Patterns that indicate the shell is waiting for user input
const INTERACTIVE_PROMPT_PATTERNS = [
  /password[^:]*:\s*$/i,           // "Password:", "sudo password:", "[sudo] password for user:"
  /\(yes\/no(\/.*)?\)\??:?\s*$/i,  // "(yes/no):", "(yes/no/[fingerprint])?"
  /\[y\/n\]/i,                      // "[Y/n]", "[y/N]"
  /continue\?.*$/i,                 // "Do you want to continue?"
  /passphrase[^:]*:\s*$/i,         // "Enter passphrase:"
  /pin[^:]*:\s*$/i,                // "Enter PIN:"
  /username[^:]*:\s*$/i,           // "Username:"
  /login[^:]*:\s*$/i,              // "Login:"
  /enter.*:\s*$/i,                 // Generic "Enter X:"
  />\s*$/,                         // Some interactive prompts end with >
];

// Patterns that mean the shell is back at a normal prompt (command done)
const SHELL_PROMPT_PATTERNS = [
  /[$#]\s*$/,   // bash/sh prompt: "user@host:~$ " or "root@host:~# "
];

function isInteractivePrompt(output) {
  const lastLine = output.split("\n").filter(l => l.trim()).pop() || "";
  return INTERACTIVE_PROMPT_PATTERNS.some(p => p.test(lastLine));
}

function isShellPrompt(output) {
  return SHELL_PROMPT_PATTERNS.some(p => p.test(output));
}

function connectShell(config) {
  return new Promise((resolve, reject) => {
    if (shellStream) return resolve(shellStream);

    connection = new Client();

    connection.on("ready", () => {
      connection.shell({ term: "xterm" }, (err, stream) => {
        if (err) return reject(err);
        shellStream = stream;
        resolve(shellStream);
      });
    });

    connection.on("error", reject);

    connection.on("close", () => {
      shellStream = null;
      connection = null;
    });

    connection.connect({
      host: config.host,
      port: config.port || 22,
      username: config.username,
      password: config.password,
    });
  });
}

/**
 * Sends a command (or input response) to the shell.
 * Returns: { output, requiresInput, prompt }
 *   - requiresInput: true if the shell is waiting for user input
 *   - prompt: the last line of output (e.g. "Password: ") to show to user
 *   - isPassword: true if input should be masked
 */
function runShellCommand(command, config) {
  return new Promise(async (resolve, reject) => {
    try {
      const shell = await connectShell(config);

      let output = "";
      let settled = false;

      // Timeout: if neither a shell prompt nor interactive prompt is detected
      // within 15s, resolve with what we have
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          shell.off("data", onData);
          resolve({ output, requiresInput: false, prompt: null });
        }
      }, 15000);

      const onData = (data) => {
        output += data.toString();

        if (settled) return;

        // Check for interactive prompt first (higher priority)
        if (isInteractivePrompt(output)) {
          settled = true;
          clearTimeout(timeout);
          shell.off("data", onData);

          const lines = output.split("\n").filter(l => l.trim());
          const lastLine = lines[lines.length - 1] || "";
          const isPassword =
            /password|passphrase|pin/i.test(lastLine) &&
            !/username|login/i.test(lastLine);

          resolve({
            output,
            requiresInput: true,
            prompt: lastLine.trim(),
            isPassword,
          });
          return;
        }

        // Check for normal shell prompt (command completed)
        if (isShellPrompt(output)) {
          settled = true;
          clearTimeout(timeout);
          shell.off("data", onData);
          resolve({ output, requiresInput: false, prompt: null });
        }
      };

      shell.on("data", onData);

      // Write the command. For password inputs, don't echo a newline visually
      shell.write(command + "\n");

    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Disconnect and reset the shell session entirely.
 */
function disconnectShell() {
  if (shellStream) {
    try { shellStream.end(); } catch (_) {}
    shellStream = null;
  }
  if (connection) {
    try { connection.end(); } catch (_) {}
    connection = null;
  }
}

module.exports = { runShellCommand, disconnectShell };