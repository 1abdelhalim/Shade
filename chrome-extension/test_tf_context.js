const fs = require('fs');
const src = fs.readFileSync('vendor/tf.min.js', 'utf8');
const fakeGlobal = {};
const fn = new Function('globalThis', 'self', 'window', 'document', src);
try {
  fn(fakeGlobal, fakeGlobal, fakeGlobal, {});
  console.log("Keys in fakeGlobal.tf:", Object.keys(fakeGlobal.tf).length);
} catch(e) {
  console.error("Error executing tf.min.js:", e.message);
}
