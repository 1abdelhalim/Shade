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

  page.on('console', msg => console.log('MAIN PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('MAIN PAGE ERROR:', err));
  
  try {
      await page.goto('https://en.wikipedia.org/wiki/Football', {waitUntil: 'networkidle2'});
      console.log('Navigated to page.');
      
      const targets = await browser.targets();
      for (const t of targets) {
          if (t.type() === 'service_worker') {
              const worker = await t.worker();
              if (worker) worker.on('console', msg => console.log('WORKER LOG:', msg.text()));
          }
      }
      
      // Keep checking for the offscreen target
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const allTargets = await browser.targets();
        for (const target of allTargets) {
           const url = target.url();
           if (url.includes('offscreen')) {
               const offscreenPage = await target.page();
               if (offscreenPage && !offscreenPage.shadeListening) {
                   offscreenPage.shadeListening = true;
                   offscreenPage.on('console', msg => console.log('OFFSCREEN LOG:', msg.text()));
                   offscreenPage.on('pageerror', err => console.error('OFFSCREEN ERROR:', err));
                   console.log('Attached to offscreen page.');
               }
           }
        }
      }
      
  } catch(e) {
      console.error(e);
  } finally {
      await browser.close();
      console.log("TEST FINISHED");
  }
})();
