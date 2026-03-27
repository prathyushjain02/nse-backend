from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
from datetime import datetime, timedelta
import traceback

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return jsonify({"status": "ok", "message": "NSE Portfolio Backend (yfinance)"})

@app.route('/api/marketStatus')
def market_status():
    return jsonify({"status": "ok", "message": "Backend is live"})

@app.route('/api/equity/<symbol>/historical')
def historical(symbol):
    try:
        start = request.args.get('start', (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d'))
        end = request.args.get('end', datetime.now().strftime('%Y-%m-%d'))

        # NSE symbols on yfinance use .NS suffix
        yf_symbol = symbol.strip().upper()
        if not yf_symbol.endswith('.NS') and not yf_symbol.endswith('.BO'):
            yf_symbol = yf_symbol + '.NS'

        ticker = yf.Ticker(yf_symbol)
        df = ticker.history(start=start, end=end, auto_adjust=True)

        if df.empty:
            # Try BSE if NSE fails
            yf_symbol = symbol.strip().upper() + '.BO'
            ticker = yf.Ticker(yf_symbol)
            df = ticker.history(start=start, end=end, auto_adjust=True)

        if df.empty:
            return jsonify({"error": f"No data found for {symbol}"}), 404

        records = []
        for date, row in df.iterrows():
            records.append({
                "date": date.strftime('%Y-%m-%d'),
                "open": round(float(row['Open']), 2),
                "high": round(float(row['High']), 2),
                "low": round(float(row['Low']), 2),
                "close": round(float(row['Close']), 2),
                "volume": int(row['Volume'])
            })

        return jsonify({"records": records, "symbol": symbol})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/equity/<symbol>')
def equity_info(symbol):
    try:
        yf_symbol = symbol.strip().upper()
        if not yf_symbol.endswith('.NS') and not yf_symbol.endswith('.BO'):
            yf_symbol = yf_symbol + '.NS'

        ticker = yf.Ticker(yf_symbol)
        info = ticker.info or {}

        return jsonify({
            "info": {
                "companyName": info.get('longName', info.get('shortName', symbol)),
                "industry": info.get('industry', 'Unknown'),
                "sector": info.get('sector', 'Unknown'),
                "marketCap": info.get('marketCap', 0),
                "symbol": symbol,
                "currentPrice": info.get('currentPrice', info.get('regularMarketPrice', 0)),
            }
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"info": {"companyName": symbol, "industry": "Unknown", "sector": "Unknown"}}), 200

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 3001))
    app.run(host='0.0.0.0', port=port)
