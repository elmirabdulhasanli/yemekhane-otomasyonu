// rapor/rapor.html → rapor/Yemekhane_Otomasyonu_Rapor.pdf (Playwright/Chromium gerekir)
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const kok = path.resolve(__dirname, '..');
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.join(kok, 'rapor', 'rapor.html'), { waitUntil: 'networkidle' });
  await p.pdf({ path: path.join(kok, 'rapor', 'Yemekhane_Otomasyonu_Rapor.pdf'), format: 'A4', printBackground: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#888">Yemekhane Otomasyonu · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' } });
  await b.close();
  console.log('PDF hazır');
})();
