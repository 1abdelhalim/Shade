const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');

const html = `
<!DOCTYPE html>
<html>
<body>
<script>${fs.readFileSync('vendor/tf.min.js', 'utf8')}</script>
<script>
  console.log("Keys in window.tf:", Object.keys(window.tf || {}));
  console.log("tf.setBackend exists?", typeof window.tf.setBackend);
</script>
</body>
</html>
`;
const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("log", (m, ...args) => console.log(m, ...args));
virtualConsole.on("error", (m, ...args) => console.error(m, ...args));
virtualConsole.on("warn", (m, ...args) => console.warn(m, ...args));

const dom = new JSDOM(html, { runScripts: "dangerously", virtualConsole });
