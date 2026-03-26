import express from 'express';
import cors from 'cors';
import { NseIndia } from 'stock-nse-india';

const app = express();
const nse = new NseIndia();

// Allow ALL origins — no CORS issues
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));

// Health check
app.get('/', async (req, res) => {
  try {
    const data = await nse.getDataByEndpoint('/api/marketStatus');
    res.json(data);
  } catch (e) { res.json({ status: 'ok', error: e.message }); }
});

app.get('/api/marketStatus', async (req, res) => {
  try {
    const data = await nse.getDataByEndpoint('/api/marketStatus');
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// All stock symbols
app.get('/api/equity/allSymbols', async (req, res) => {
  try {
    const symbols = await nse.getAllStockSymbols();
    res.json(symbols);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Equity details (includes industry, company name)
app.get('/api/equity/:symbol', async (req, res) => {
  try {
    const data = await nse.getEquityDetails(req.params.symbol);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Historical data
app.get('/api/equity/:symbol/historical', async (req, res) => {
  try {
    const { start, end } = req.query;
    const range = {
      start: start ? new Date(start) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      end: end ? new Date(end) : new Date()
    };
    const data = await nse.getEquityHistoricalData(req.params.symbol, range);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Trade info
app.get('/api/equity/:symbol/tradeinfo', async (req, res) => {
  try {
    const data = await nse.getEquityTradeInfo(req.params.symbol);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Corporate info
app.get('/api/equity/:symbol/corporate', async (req, res) => {
  try {
    const data = await nse.getEquityCorporateInfo(req.params.symbol);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Indices
app.get('/api/indices', async (req, res) => {
  try {
    const data = await nse.getEquityStockIndices('NIFTY 50');
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`NSE API server running on port ${PORT}`));
