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

// Extract records from the nested response format
// Response shape: { data: [ { data: [records...], meta: {...} } ] }
function extractRecords(raw) {
  if (!raw) return [];
  // Direct array of records
  if (Array.isArray(raw) && raw.length > 0 && raw[0].chClosingPrice !== undefined) return raw;
  // { data: [ { data: [records], meta } ] }
  if (raw.data && Array.isArray(raw.data)) {
    for (const item of raw.data) {
      if (item && item.data && Array.isArray(item.data)) return item.data;
    }
    // { data: [records] } directly
    if (raw.data.length > 0 && raw.data[0].chClosingPrice !== undefined) return raw.data;
  }
  return [];
}

// Historical data — NSE limits to ~3 months per request so we chunk
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
        const raw = await nse.getEquityHistoricalData(symbol, chunk);
        const records = extractRecords(raw);
        allRecords = allRecords.concat(records);
      } catch (err) {
        console.log(`Chunk error ${symbol}: ${err.message}`);
      }
      if (chunks.length > 1) await new Promise(r => setTimeout(r, 500));
    }

    // Deduplicate by date and sort
    const seen = new Set();
    allRecords = allRecords.filter(r => {
      const d = r.mtimestamp || r.mTIMESTAMP || r.CH_TIMESTAMP || '';
      if (seen.has(d)) return false;
      seen.add(d); return true;
    });

    // Sort by date (mtimestamp is "DD-Mon-YYYY" format)
    allRecords.sort((a, b) => {
      const parse = s => { try { return new Date(s).getTime(); } catch { return 0; } };
      return parse(a.mtimestamp || a.mTIMESTAMP || '') - parse(b.mtimestamp || b.mTIMESTAMP || '');
    });

    console.log(`${symbol}: ${allRecords.length} records from ${chunks.length} chunks`);
    res.json({ records: allRecords });
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
