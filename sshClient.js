const { Client } = require("ssh2");

function executeSSHCommand(command, config) {
  return new Promise((resolve, reject) => {

    const conn = new Client();

    conn.on("ready", () => {

      conn.exec(command, (err, stream) => {

        if (err) return reject(err);

        let data = "";

        stream.on("data", chunk => {
          data += chunk.toString();
        });

        stream.stderr.on("data", chunk => {
          data += chunk.toString();
        });

        stream.on("close", () => {
          conn.end();
          resolve(data);
        });

      });

    }).on("error", reject)
      .connect(config);

  });
}

module.exports = executeSSHCommand;