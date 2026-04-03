import puppeteer from 'puppeteer';

(async () => {
  const extensionPath = '/Users/4sale/Shade/chrome-extension';
  const browser = await puppeteer.launch({
    headless: "new", // Headless mode works with extensions in newer puppeteer if configured correctly, but headless: false is safer
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  
  let result = "failed";
  try {
      await page.goto('https://en.wikipedia.org/wiki/Main_Page', {waitUntil: 'networkidle2'});
      console.log('Navigated to page.');
      
      const targets = browser.targets();
      for (const t of targets) {
          if (t.type() === 'service_worker') {
              const worker = await t.worker();
              worker.on('console', msg => console.log('WORKER LOG:', msg.text()));
          }
      }
      
      // Send a ping to service worker
      await new Promise(r => setTimeout(r, 6000));
      
      result = "success";
  } catch(e) {
      console.error(e);
  } finally {
      await browser.close();
      console.log("TEST FINISHED", result);
  }
})();
