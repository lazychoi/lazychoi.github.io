import http.server
import socketserver
import webbrowser
import os
import json
import urllib.request
import urllib.parse
import re

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

def fetch_stock_price(ticker_or_name):
    ticker = ticker_or_name.strip()
    if not ticker:
        return None, None
        
    # Extract symbol from parentheses if present, e.g. "삼성전자 (005930)" -> "005930"
    parenthesis_match = re.search(r'\(([^)]+)\)', ticker)
    if parenthesis_match:
        ticker = parenthesis_match.group(1).strip()
        
    is_direct_ticker = False
    try:
        ticker.encode('ascii')
        is_direct_ticker = True
    except UnicodeEncodeError:
        is_direct_ticker = False
        
    if re.match(r'^\d{6}$', ticker):
        is_direct_ticker = True
        
    def call_yahoo(symbol):
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode('utf-8'))
                result = data.get('chart', {}).get('result', None)
                if result and len(result) > 0:
                    meta = result[0].get('meta', {})
                    price = meta.get('regularMarketPrice', None)
                    return price
        except Exception as e:
            pass
        return None

    if is_direct_ticker:
        if re.match(r'^\d{6}$', ticker):
            price = call_yahoo(f"{ticker}.KS")
            if price is not None:
                return price, f"{ticker}.KS"
            price = call_yahoo(f"{ticker}.KQ")
            if price is not None:
                return price, f"{ticker}.KQ"
        
        price = call_yahoo(ticker)
        if price is not None:
            return price, ticker
            
    # Try searching Naver Search to resolve the name to a ticker/code
    try:
        q = urllib.parse.quote(ticker + ' 주식')
        search_url = f'https://search.naver.com/search.naver?query={q}'
        req = urllib.request.Request(search_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as r:
            html = r.read().decode('utf-8', errors='ignore')
            
            # Domestic stock search
            dom = re.search(r'finance\.naver\.com/item/[^\"]*code=(\d{6})', html)
            if dom:
                code = dom.group(1)
                # Try KOSPI
                price = call_yahoo(f"{code}.KS")
                if price is not None:
                    return price, f"{code}.KS"
                # Try KOSDAQ
                price = call_yahoo(f"{code}.KQ")
                if price is not None:
                    return price, f"{code}.KQ"
            
            # Global stock search (e.g. AAPL.O)
            glob = re.search(r'worldstock/stock/([A-Za-z0-9\.]+)/', html)
            if glob:
                symbol = glob.group(1)
                price = call_yahoo(symbol)
                if price is not None:
                    return price, symbol
    except Exception as e:
        pass
        
    return None, None

class AdminHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path.startswith('/api/price'):
            parsed_path = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed_path.query)
            ticker = query_params.get('ticker', [None])[0]
            
            if not ticker:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": "Ticker/Name is required"}).encode('utf-8'))
                return
                
            price, resolved_ticker = fetch_stock_price(ticker)
            if price is not None:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "ticker": resolved_ticker, "price": price}).encode('utf-8'))
            else:
                self.send_response(404)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": "Price not found"}).encode('utf-8'))
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/save':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            try:
                # Save the POST data (which is the updated CSV content) to data/farm_data.txt
                file_path = os.path.join(DIRECTORY, 'data', 'farm_data.txt')
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(post_data)
                
                # Send success response
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
            except Exception as e:
                # Send error response
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    # Ensure working directory is the script's directory
    os.chdir(DIRECTORY)
    
    # Allow address reuse to avoid 'Address already in use' errors
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), AdminHTTPRequestHandler) as httpd:
        print("==================================================================")
        print(f"🌱 용어 관리자 서버가 성공적으로 실행되었습니다.")
        print(f"👉 URL: http://localhost:{PORT}/farm_add.html")
        print("👉 '용어 추가하기' 또는 '수정/삭제' 시 기기 파일에 즉시 저장됩니다.")
        print("👉 종료하려면 터미널에서 Ctrl+C를 누르세요.")
        print("==================================================================")
        
        # Automatically open the browser
        webbrowser.open(f"http://localhost:{PORT}/farm_add.html")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료합니다.")
