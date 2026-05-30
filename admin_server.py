import http.server
import socketserver
import webbrowser
import os
import json

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class AdminHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        if self.path == '/api/save':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            try:
                # Save the POST data (which is the updated CSV content) to farm_data.txt
                file_path = os.path.join(DIRECTORY, 'farm_data.txt')
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
