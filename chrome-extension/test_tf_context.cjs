const fs = require('fs');
const src = fs.readFileSync('vendor/tf.min.js', 'utf8');
const fakeGlobal = {};
const fn = new Function('globalThis', 'self', 'window', 'document', 'crypto', src);
try {
  fn(fakeGlobal, fakeGlobal, fakeGlobal, {}, { getRandomValues: () => new Uint8Array(1) });
  console.log("Keys in fakeGlobal.tf:", fakeGlobal.tf ? Object.keys(fakeGlobal.tf).length : 0);
} catch(e) {
  console.error("Error executing tf.min.js:", e.message);
}
