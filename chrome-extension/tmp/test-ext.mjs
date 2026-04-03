import puppeteer from 'puppeteer';

(async () => {
  const extensionPath = '/Users/4sale/Shade/chrome-extension';
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));
  
  // also attach to service worker
  const targets = browser.targets();
  const backgroundTarget = targets.find(t => t.type() === 'service_worker');
  if (backgroundTarget) {
      try {
          const worker = await backgroundTarget.worker();
          if (worker) {
              worker.on('console', msg => console.log('WORKER LOG:', msg.text()));
          }
      } catch(e) {
          console.error("error attaching to worker", e);
      }
  }

  await page.goto('https://en.wikipedia.org/wiki/Main_Page', {waitUntil: 'networkidle2'});
  console.log('Navigated to page.');
  
  await new Promise(r => setTimeout(r, 5000));
  
  // To check if there are offscreen docs, etc.
  const pages = await browser.pages();
  for (const p of pages) {
     const title = await p.title();
     const url = p.url();
     console.log('Open page/offscreen document:', title, url);
     if (url.includes('offscreen')) {
         p.on('console', msg => console.log('OFFSCREEN LOG:', msg.text()));
     }
  }

  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
  console.log('Done.');
})();
