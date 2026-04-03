const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const dom = new JSDOM(`<body>
  <script src="vendor/tf.min.js"></script>
  <script src="vendor/tf-tflite.min.js"></script>
  <script>
    console.log(Object.keys(window.tf));
  </script>
</body>`, { runScripts: "dangerously", resources: "usable" });
