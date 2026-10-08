import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', err => {
    errors.push(err.toString());
  });

  try {
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto('http://localhost:5173/scenarios', { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 2000)); // wait for canvas to render
    await page.screenshot({ path: 'scenario_screenshot.png' });
    console.log('Screenshot saved as scenario_screenshot.png');
    if (errors.length > 0) {
      console.log('Errors found:');
      console.log(errors.join('\n'));
    } else {
      console.log('No console errors detected.');
    }
    
    // Click on some controls to verify interactability
    await page.click('button:has-text("START")').catch(e => console.log('Could not click START'));
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ path: 'scenario_screenshot_started.png' });
    
  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    await browser.close();
  }
})();
