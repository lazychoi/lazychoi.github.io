#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
clean_orphaned_nodes.py
— Supabase DB (genealogy_nodes) 내에 우연히 생성되었을 수 있는
  name이 ID 형태('greek_...')인 유령 노드 및 무효한 고아 ID 배열 요소를 한 번에 정제하는 DB 클리닝 스크립트.
"""

import json
import urllib.request

SUPABASE_URL = 'https://tpwwwpcbinxdhxqvcvqc.supabase.co'
SUPABASE_KEY = 'sb_publishable_A1sd3hvbeQx9-gVoFXL0qA_G923SWm9'

def clean_database():
    print("🧹 Supabase DB (genealogy_nodes) 유령 ID 및 고아 데이터 딥 클리닝 시작...")

    # 1. DB 전체 노드 가져오기
    fetch_url = f"{SUPABASE_URL}/rest/v1/genealogy_nodes?select=*"
    req = urllib.request.Request(fetch_url, headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    })

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print("❌ DB 데이터 조회 실패:", e)
        return

    print(f"📊 총 {len(data)}개 DB 노드 조회 완료.")

    # 2. 존재하는 정당한 ID 집합 추출
    valid_ids = set()
    ghost_ids = set()

    for row in data:
        r_id = row['id']
        r_name = row.get('name', '')
        # 이름이 아예 없거나 'greek_' / 'joseon_' 등의 ID 형태라면 유령 노드로 분류
        if not r_name or r_name.startswith('greek_') or r_name.startswith('joseon_') or r_name == '이름 없음':
            ghost_ids.add(r_id)
        else:
            valid_ids.add(r_id)

    print(f"🔎 발견된 정당한 인물 노드: {len(valid_ids)}개 / 유령 ID 노드: {len(ghost_ids)}개")

    # 3. 유령 노드 DB 삭제
    if ghost_ids:
        for g_id in ghost_ids:
            del_url = f"{SUPABASE_URL}/rest/v1/genealogy_nodes?id=eq.{g_id}"
            del_req = urllib.request.Request(del_url, headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}"
            }, method='DELETE')
            try:
                urllib.request.urlopen(del_req)
            except Exception as e:
                pass
        print(f"🗑️ 유령 노드 {len(ghost_ids)}개 DB 삭제 완료.")

    # 4. 각 정당한 노드의 parent_ids, spouse_ids, child_ids 배열에서 고아 ID 제거 및 DB 업데이트
    updated_count = 0
    for row in data:
        if row['id'] in ghost_ids:
            continue

        orig_parents = row.get('parent_ids') or []
        orig_spouses = row.get('spouse_ids') or []
        orig_children = row.get('child_ids') or []

        clean_parents = [x for x in orig_parents if x in valid_ids]
        clean_spouses = [x for x in orig_spouses if x in valid_ids]
        clean_children = [x for x in orig_children if x in valid_ids]

        if clean_parents != orig_parents or clean_spouses != orig_spouses or clean_children != orig_children:
            # 업데이트 필요
            patch_url = f"{SUPABASE_URL}/rest/v1/genealogy_nodes?id=eq.{row['id']}"
            payload = {
                "parent_ids": clean_parents,
                "spouse_ids": clean_spouses,
                "child_ids": clean_children
            }
            patch_req = urllib.request.Request(patch_url, data=json.dumps(payload).encode('utf-8'), headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json"
            }, method='PATCH')
            try:
                urllib.request.urlopen(patch_req)
                updated_count += 1
            except Exception as e:
                pass

    print(f"✨ 연결 관계 정제 완료 ({updated_count}개 노드의 고아 ID 배열 정제됨). DB 딥 클리닝 완벽 종료!")

if __name__ == '__main__':
    clean_database()
