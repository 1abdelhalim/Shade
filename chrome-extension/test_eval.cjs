const fs = require('fs');
const src = fs.readFileSync('./vendor/tf.min.js', 'utf8');
const fakeWindow = { document: {} };
globalThis.window = fakeWindow;
globalThis.self = fakeWindow;
eval(src);
console.log(Object.keys(fakeWindow.tf || globalThis.tf).slice(0, 10));
console.log('setBackend' in (fakeWindow.tf || globalThis.tf));
