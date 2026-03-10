const { Client } = require("ssh2");

let connection = null;
let shellStream = null;

function connectShell(config) {
  return new Promise((resolve, reject) => {

    if (shellStream) return resolve(shellStream);

    connection = new Client();

    connection.on("ready", () => {

      connection.shell((err, stream) => {

        if (err) return reject(err);

        shellStream = stream;

        resolve(shellStream);

      });

    });

    connection.on("error", reject);

    connection.connect({
      host: config.host,
      port: config.port || 22,
      username: config.username,
      password: config.password
    });

  });
}

function runShellCommand(command, config) {
  return new Promise(async (resolve, reject) => {

    try {

      const shell = await connectShell(config);

      let output = "";

      const onData = data => {
        output += data.toString();

        if (output.endsWith("$ ") || output.endsWith("# ")) {
          shell.off("data", onData);
          resolve(output);
        }
      };

      shell.on("data", onData);
      shell.write(command + "\n");

    } catch (err) {
      reject(err);
    }

  });
}

module.exports = runShellCommand;