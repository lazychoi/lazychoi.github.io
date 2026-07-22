#!/usr/bin/env python3
import os
import sys
import re
import json
import urllib.request
import urllib.error

# Table configurations: (supabase_table_name, local_json_filename)
TABLES_TO_BACKUP = [
    ('terms', 'backup-terms.json'),
    ('history_timeline', 'backup-history.json')
]

def get_supabase_credentials():
    """Extracts Supabase credentials dynamically from farm.js in the same directory."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    farm_js_path = os.path.join(current_dir, 'farm.js')
    
    if os.path.exists(farm_js_path):
        try:
            with open(farm_js_path, 'r', encoding='utf-8') as f:
                content = f.read()
                # Find supabaseUrl and supabaseKey matching double or single quotes
                url_match = re.search(r"const\s+supabaseUrl\s*=\s*['\"]([^'\"]+)['\"]", content)
                key_match = re.search(r"const\s+supabaseKey\s*=\s*['\"]([^'\"]+)['\"]", content)
                if url_match and key_match:
                    return url_match.group(1), key_match.group(1)
        except Exception as e:
            print(f"[-] Warning: Failed to parse farm.js: {e}")
            
    # Fallback to environment variables
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_KEY')
    return url, key

def fetch_table_data(supabase_url, supabase_key, table_name):
    """Fetches all rows from a Supabase table using pagination to bypass the 1000-row limit."""
    print(f"[+] Fetching table '{table_name}' from Supabase...")
    all_data = []
    page = 0
    page_size = 1000
    keep_fetching = True
    
    while keep_fetching:
        # Build PostgREST paginated URL ordered by id
        url = f"{supabase_url}/rest/v1/{table_name}?select=*&order=id.asc&limit={page_size}&offset={page * page_size}"
        req = urllib.request.Request(
            url,
            headers={
                'apikey': supabase_key,
                'Authorization': f'Bearer {supabase_key}'
            }
        )
        
        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                if not data:
                    keep_fetching = False
                else:
                    all_data.extend(data)
                    print(f"    Fetched {len(all_data)} rows so far...")
                    if len(data) < page_size:
                        keep_fetching = False
                    else:
                        page += 1
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            print(f"[-] HTTP Error {e.code}: {e.reason}")
            print(f"[-] Response details: {error_body}")
            sys.exit(1)
        except Exception as e:
            print(f"[-] Error fetching data: {e}")
            sys.exit(1)
            
    print(f"[+] Successfully fetched {len(all_data)} rows in total from '{table_name}'.")
    return all_data

def backup_to_json(data, filename):
    """Saves the raw JSON data to a backup file in the 'data' directory."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backup_file_path = os.path.join(current_dir, 'data', filename)
    os.makedirs(os.path.dirname(backup_file_path), exist_ok=True)
    
    with open(backup_file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"[+] Saved JSON backup to: {backup_file_path}")

def main():
    url, key = get_supabase_credentials()
    
    if not url or not key:
        print("[-] Error: Supabase URL and Key could not be found.")
        print("    Please run this script from the workspace directory containing 'farm.js',")
        print("    or set the SUPABASE_URL and SUPABASE_KEY environment variables.")
        sys.exit(1)
        
    print(f"[+] Using Supabase URL: {url}")
    
    for table_name, filename in TABLES_TO_BACKUP:
        # 1. Fetch data
        data = fetch_table_data(url, key, table_name)
        
        if not data:
            print(f"[-] Warning: No data fetched for '{table_name}'. Backup aborted.")
            continue
            
        # 2. Backup to JSON
        backup_to_json(data, filename)
    
    print("[+] All done!")

if __name__ == "__main__":
    main()
