import express from 'express';
import cors from 'cors';
import { NseIndia } from 'stock-nse-india';

const app = express();
const nse = new NseIndia();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));

app.get('/', async (req, res) => {
  try { res.json(await nse.getDataByEndpoint('/api/marketStatus')); }
  catch (e) { res.json({ status: 'ok' }); }
});

app.get('/api/marketStatus', async (req, res) => {
  try { res.json(await nse.getDataByEndpoint('/api/marketStatus')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/equity/allSymbols', async (req, res) => {
  try { res.json(await nse.getAllStockSymbols()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/equity/:symbol', async (req, res) => {
  try { res.json(await nse.getEquityDetails(req.params.symbol)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Historical data — NSE limits to ~3 months per request, so we chunk
app.get('/api/equity/:symbol/historical', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const endDate = req.query.end ? new Date(req.query.end) : new Date();
    const startDate = req.query.start ? new Date(req.query.start) : new Date(Date.now() - 365 * 86400000);

    // Split into 80-day chunks
    const chunks = [];
    let cur = new Date(startDate);
    while (cur < endDate) {
      const chunkEnd = new Date(cur);
      chunkEnd.setDate(chunkEnd.getDate() + 79);
      if (chunkEnd > endDate) chunkEnd.setTime(endDate.getTime());
      chunks.push({ start: new Date(cur), end: new Date(chunkEnd) });
      cur.setDate(cur.getDate() + 80);
    }

    let allRecords = [];
    for (const chunk of chunks) {
      try {
        const data = await nse.getEquityHistoricalData(symbol, chunk);
        const records = Array.isArray(data) ? data : (data && data.data ? data.data : []);
        allRecords = allRecords.concat(records);
      } catch (err) {
        console.log(`Chunk error ${symbol}: ${err.message}`);
      }
      if (chunks.length > 1) await new Promise(r => setTimeout(r, 500));
    }

    // Deduplicate and sort by date
    const seen = new Set();
    allRecords = allRecords.filter(r => {
      const d = r.CH_TIMESTAMP || r.mTIMESTAMP || r.date || '';
      if (seen.has(d)) return false;
      seen.add(d); return true;
    });
    allRecords.sort((a, b) =>
      (a.CH_TIMESTAMP || a.mTIMESTAMP || '').localeCompare(b.CH_TIMESTAMP || b.mTIMESTAMP || '')
    );

    res.json({ data: allRecords });
  } catch (e) {
    console.error(`Historical error ${req.params.symbol}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/equity/:symbol/tradeinfo', async (req, res) => {
  try { res.json(await nse.getEquityTradeInfo(req.params.symbol)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/equity/:symbol/corporate', async (req, res) => {
  try { res.json(await nse.getEquityCorporateInfo(req.params.symbol)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/indices', async (req, res) => {
  try { res.json(await nse.getEquityStockIndices('NIFTY 50')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`NSE API running on port ${PORT}`));
