import puppeteer from 'puppeteer';

(async () => {
  const extensionPath = '/Users/4sale/Shade/chrome-extension';
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  
  try {
      await page.goto('https://en.wikipedia.org/wiki/Football', {waitUntil: 'networkidle2'});
      console.log('Navigated!');
      
      let gotHealth = false;
      
      // Let's attach to offscreen sandbox in a robust way
      setInterval(async () => {
         const targets = await browser.targets();
         for(const t of targets) {
             if (t.type() === 'other' || t.url().includes('sandbox')) {
                  const client = await t.createCDPSession();
                  client.send('Runtime.enable');
                  // listen for console logs
                  client.on('Runtime.consoleAPICalled', (e) => {
                      const args = e.args.map(a => a.value || a.unserializableValue || a.description).join(' ');
                      console.log('SANDBOX LOG:', args);
                  });
             }
         }
      }, 2000);
      
      await new Promise(r => setTimeout(r, 6000));
  } catch(e) {
      console.error(e);
  } finally {
      await browser.close();
      console.log("TEST 4 FINISHED");
  }
})();
