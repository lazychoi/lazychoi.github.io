#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/import_hanja_to_supabase.py

data/ 디렉터리 내의 h01ga.txt ~ h15.txt 15개 한자 사전 데이터 파일을 읽어
Supabase의 hanja_dict 테이블에 배치(Batch)로 업로드하는 스크립트입니다.
중단 시 이어서 전송(Resume) 및 지수 백오프 자동 재시도를 지원합니다.
"""

import os
import sys
import glob
import json
import time
import argparse
import urllib.request
import urllib.error

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
PROGRESS_FILE = os.path.join(BASE_DIR, 'scripts', '.hanja_import_progress.json')

DEFAULT_SUPABASE_URL = 'https://tpwwwpcbinxdhxqvcvqc.supabase.co'
DEFAULT_SUPABASE_KEY = 'sb_publishable_A1sd3hvbeQx9-gVoFXL0qA_G923SWm9'

def parse_args():
    parser = argparse.ArgumentParser(description="한자 사전 데이터를 Supabase hanja_dict 테이블에 입력합니다.")
    parser.add_argument('--url', default=DEFAULT_SUPABASE_URL, help="Supabase 프로젝트 URL")
    parser.add_argument('--key', default=DEFAULT_SUPABASE_KEY, help="Supabase API Key")
    parser.add_argument('--batch-size', type=int, default=2000, help="한 번에 전송할 레코드 수 (기본: 2000)")
    parser.add_argument('--meaning-only', action='store_true', help="뜻(meaning)이 있는 데이터만 입력")
    parser.add_argument('--dry-run', action='store_true', help="실제 전송 없이 데이터 파싱 및 통계만 확인")
    parser.add_argument('--reset-progress', action='store_true', help="이전 진행 상태를 초기화하고 1번부터 시작")
    return parser.parse_args()

def load_all_hanja_files(meaning_only=False):
    manifest_path = os.path.join(DATA_DIR, 'manifest.json')
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as f:
            file_list = json.load(f)
        files = [os.path.join(DATA_DIR, fn) for fn in file_list]
    else:
        files = sorted(glob.glob(os.path.join(DATA_DIR, 'h*.txt')))

    print(f"📖 총 {len(files)}개의 사전 데이터 파일을 읽는 중...")
    
    records_map = {}
    total_raw_lines = 0

    for file_path in files:
        if not os.path.exists(file_path):
            continue
        filename = os.path.basename(file_path)
        with open(file_path, 'rb') as fp:
            raw_bytes = fp.read()

        if raw_bytes.startswith(b'\xff\xfe'):
            text = raw_bytes.decode('utf-16le', errors='ignore')
        else:
            text = raw_bytes.decode('utf-8', errors='ignore')

        file_lines = 0
        for line in text.splitlines():
            line_str = line.strip()
            if not line_str:
                continue
            total_raw_lines += 1
            file_lines += 1

            parts = line_str.split('|')
            if len(parts) < 2:
                continue

            korean = parts[0].strip()
            hanja = parts[1].strip()
            meaning = parts[2].strip() if len(parts) > 2 else ''

            if not korean or not hanja:
                continue

            if meaning_only and not meaning:
                continue

            key = (hanja, korean)
            if key in records_map:
                if not records_map[key]['meaning'] and meaning:
                    records_map[key] = {
                        'hanja': hanja,
                        'korean': korean,
                        'meaning': meaning
                    }
            else:
                records_map[key] = {
                    'hanja': hanja,
                    'korean': korean,
                    'meaning': meaning
                }

        print(f"  - {filename:12s}: {file_lines:7d} 행 파싱 완료")

    unique_records = list(records_map.values())
    print(f"\n📊 파싱 결과 요약:")
    print(f"  • 파일 원본 행 수 : {total_raw_lines:,} 행")
    print(f"  • 고유 표제어 수   : {len(unique_records):,} 개")
    with_meaning_cnt = sum(1 for r in unique_records if r['meaning'])
    print(f"  • 뜻 정보 포함     : {with_meaning_cnt:,} 개")
    print(f"  • 단순 단어/음 매핑: {len(unique_records) - with_meaning_cnt:,} 개")

    return unique_records

def upload_batch_with_retry(url, key, batch, max_retries=5):
    endpoint = f"{url}/rest/v1/hanja_dict"
    payload = json.dumps(batch).encode('utf-8')

    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    }

    for attempt in range(1, max_retries + 1):
        try:
            req = urllib.request.Request(endpoint, data=payload, headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.status
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8')
            if "row-level security" in err_body:
                raise RuntimeError(
                    "RLS_ERROR: Row Level Security(RLS) 정책에 의해 차단되었습니다.\n"
                    "Supabase SQL Editor에서 아래 명령을 실행해주세요:\n"
                    "ALTER TABLE public.hanja_dict DISABLE ROW LEVEL SECURITY;"
                )
            if e.code in (500, 502, 503, 504) and attempt < max_retries:
                wait_sec = attempt * 3
                print(f"\n⚠️ 서버 응답 코드 {e.code}, {wait_sec}초 후 재시도 중... ({attempt}/{max_retries})")
                time.sleep(wait_sec)
                continue
            raise RuntimeError(f"HTTP {e.code}: {err_body}")
        except Exception as e:
            if attempt < max_retries:
                wait_sec = attempt * 3
                print(f"\n⚠️ 네트워크 예외 ({e}), {wait_sec}초 후 재시도 중... ({attempt}/{max_retries})")
                time.sleep(wait_sec)
                continue
            raise e

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {'last_batch_index': -1, 'success_count': 0}

def save_progress(batch_index, success_count):
    try:
        with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
            json.dump({'last_batch_index': batch_index, 'success_count': success_count}, f)
    except Exception:
        pass

def clear_progress():
    if os.path.exists(PROGRESS_FILE):
        try:
            os.remove(PROGRESS_FILE)
        except Exception:
            pass

def main():
    args = parse_args()
    records = load_all_hanja_files(meaning_only=args.meaning_only)

    if args.dry_run:
        print("\n🔍 [--dry-run] 실제 전송 없이 검증을 마쳤습니다.")
        return

    if args.reset_progress:
        clear_progress()

    progress = load_progress()
    start_batch_idx = progress.get('last_batch_index', -1) + 1
    success_count = progress.get('success_count', 0)

    total = len(records)
    batch_size = args.batch_size
    num_batches = (total + batch_size - 1) // batch_size

    if start_batch_idx > 0:
        print(f"\n🔄 이전 진행 상황 발견: {start_batch_idx}번째 배치 ({success_count:,}건)부터 이어서 전송합니다.")

    print(f"\n🚀 Supabase로 업로드 시작 (총 {total:,}건, {num_batches}개 배치, 배치당 {batch_size}건)")
    start_time = time.time()

    for i in range(start_batch_idx, num_batches):
        batch = records[i * batch_size : (i + 1) * batch_size]
        try:
            upload_batch_with_retry(args.url, args.key, batch)
            success_count += len(batch)
            save_progress(i, success_count)

            elapsed = time.time() - start_time
            rate = (success_count - progress.get('success_count', 0)) / elapsed if elapsed > 0 else 0
            percent = (success_count / total) * 100
            print(f"[{i+1}/{num_batches}] {percent:5.1f}% | {success_count:,}/{total:,}건 완료 ({rate:.0f}건/초)", end='\r')
            sys.stdout.flush()
        except RuntimeError as e:
            print(f"\n\n❌ {e}")
            sys.exit(1)
        except Exception as e:
            print(f"\n\n❌ 업로드 중단: {e}")
            sys.exit(1)

    clear_progress()
    total_time = time.time() - start_time
    print(f"\n\n🎉 전체 {success_count:,}건의 한자 사전 데이터가 Supabase hanja_dict에 성공적으로 입력되었습니다! (소요 시간: {total_time:.1f}초)")
    print("\n🔒 입력이 완료되었으므로, 보안을 위해 Supabase SQL Editor에서 RLS를 다시 활성화해주세요:")
    print("   ALTER TABLE public.hanja_dict ENABLE ROW LEVEL SECURITY;")

if __name__ == '__main__':
    main()
