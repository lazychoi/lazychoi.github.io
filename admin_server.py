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

class AdminHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        # 주가 API가 제거되었으므로 단순히 정적 파일 서비스만 수행
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
        elif self.path == '/api/save_hanja':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            try:
                data = json.loads(post_data)
                filename = data.get('file')
                korean = data.get('korean')
                hanja = data.get('hanja')
                meaning = data.get('meaning', '')
                
                if not filename or not korean or not hanja:
                    raise Exception("필수 매개변수(file, korean, hanja)가 누락되었습니다.")
                
                # 디렉터리 트래버스 방지를 위한 파일명 정규식 검증
                if not re.match(r'^h\d{2}[a-z]*\.txt$', filename):
                    raise Exception("올바르지 않은 파일 형식입니다.")
                
                file_path = os.path.join(DIRECTORY, 'data', filename)
                if not os.path.exists(file_path):
                    raise Exception(f"파일을 찾을 수 없습니다: {filename}")
                
                # 파일 인코딩 확인 (UTF-16LE BOM 검사)
                with open(file_path, 'rb') as f:
                    bom = f.read(2)
                
                is_utf16 = (bom == b'\xff\xfe')
                
                if is_utf16:
                    with open(file_path, 'r', encoding='utf-16le', errors='ignore') as f:
                        content = f.read()
                        if content.startswith('\ufeff'):
                            content = content[1:]
                else:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                
                lines = content.split('\n')
                updated = False
                new_lines = []
                
                for line in lines:
                    if not line.strip():
                        new_lines.append(line)
                        continue
                    parts = line.split('|')
                    if len(parts) >= 2 and parts[0] == korean and parts[1] == hanja:
                        new_lines.append(f"{korean}|{hanja}|{meaning}")
                        updated = True
                    else:
                        new_lines.append(line)
                
                if not updated:
                    raise Exception("해당 한자 데이터를 파일 내에서 찾을 수 없습니다.")
                
                # 파일 쓰기
                if is_utf16:
                    with open(file_path, 'w', encoding='utf-16le') as f:
                        f.write('\ufeff')
                        f.write('\n'.join(new_lines))
                else:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write('\n'.join(new_lines))
                        
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
        elif self.path == '/api/add_hanja':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            try:
                data = json.loads(post_data)
                korean = data.get('korean', '').strip()
                hanja = data.get('hanja', '').strip()
                meaning = data.get('meaning', '').strip()
                
                if not korean or not hanja:
                    raise Exception("필수 매개변수(korean, hanja)가 누락되었습니다.")
                
                # h15.txt 파일 경로
                file_path = os.path.join(DIRECTORY, 'data', 'h15.txt')
                
                # 중복 검사
                duplicate = False
                if os.path.exists(file_path):
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    lines = content.split('\n')
                    for line in lines:
                        if not line.strip():
                            continue
                        parts = line.split('|')
                        if len(parts) >= 2 and parts[0] == korean and parts[1] == hanja:
                            duplicate = True
                            break
                
                if duplicate:
                    raise Exception("이미 등록된 한자 데이터입니다.")
                
                # 줄바꿈 가공
                processed_meaning = meaning.replace('\n', '</br>')
                new_line = f"{korean}|{hanja}|{processed_meaning}"
                
                # 파일에 추가하기
                if os.path.exists(file_path):
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        existing_content = f.read()
                    if existing_content and not existing_content.endswith('\n'):
                        existing_content += '\n'
                    existing_content += new_line + '\n'
                else:
                    existing_content = new_line + '\n'
                
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(existing_content)
                
                # manifest.json 업데이트
                manifest_path = os.path.join(DIRECTORY, 'data', 'manifest.json')
                if os.path.exists(manifest_path):
                    with open(manifest_path, 'r', encoding='utf-8') as f:
                        manifest = json.load(f)
                    if 'h15.txt' not in manifest:
                        manifest.append('h15.txt')
                        with open(manifest_path, 'w', encoding='utf-8') as f:
                            json.dump(manifest, f, indent=2)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
                
            except Exception as e:
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
        print(f"👉 URL: http://localhost:{PORT}/index.html")
        print("👉 '용어 추가하기' 또는 '수정/삭제' 시 기기 파일에 즉시 저장됩니다.")
        print("👉 종료하려면 터미널에서 Ctrl+C를 누르세요.")
        print("==================================================================")
        
        # Automatically open the browser
        webbrowser.open(f"http://localhost:{PORT}/index.html")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료합니다.")
