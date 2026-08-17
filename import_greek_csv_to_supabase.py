#!/usr/bin/env python3
# -*- coding: utf-8: -*-
"""
import_greek_csv_to_supabase.py — 그리스 신화 CSV 데이터를 읽어 parent_ids 중심으로 관계를 자동 연결하고
Supabase SQL Editor에서 1클릭 실행 가능한 `data/insert_greek_nodes.sql` 파일 및 SQL 스크립트를 생성합니다.
(child_ids 컬럼 전면 제거 버전)
"""

import os
import csv
import json
import re

CSV_PATH = '/Users/jun/Documents/lazychoi.github.io/data/greek_family_custom.csv'
OUTPUT_SQL_PATH = '/Users/jun/Documents/lazychoi.github.io/data/insert_greek_nodes.sql'
DATASET_ID = 'greek'

def clean_str(s):
    if not s:
        return ""
    return s.strip().strip('"').strip("'")

def parse_names(s):
    if not s:
        return []
    cleaned = clean_str(s)
    if not cleaned:
        return []
    items = re.split(r'[,|]', cleaned)
    return [i.strip() for i in items if i.strip()]

def main():
    print(f"📖 CSV 파일 읽는 중: {CSV_PATH}")
    if not os.path.exists(CSV_PATH):
        print(f"❌ 오류: CSV 파일이 없습니다 -> {CSV_PATH}")
        return

    rows = []
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    print(f" 총 {len(rows)}개 CSV 행 로드됨")

    name_to_id = {}
    nodes = []

    for idx, r in enumerate(rows, start=1):
        name = clean_str(r.get('name'))
        if not name:
            continue
        node_id = f"{DATASET_ID}_{idx}"
        name_to_id[name] = node_id

        gender_raw = clean_str(r.get('gender')).lower()
        if 'female' in gender_raw or '여' in gender_raw:
            gender = 'female'
        elif 'genderless' in gender_raw or '중성' in gender_raw:
            gender = 'genderless'
        else:
            gender = 'male'

        nodes.append({
            'id': node_id,
            'dataset_id': DATASET_ID,
            'name': name,
            'name_eng': clean_str(r.get('name_eng')),
            'title': clean_str(r.get('title')),
            'gender': gender,
            'info': "",
            'parent_names': parse_names(r.get('parent_names')),
            'spouse_names': parse_names(r.get('spouse_names')),
            'child_names': parse_names(r.get('child_names')),
            'parent_ids': [],
            'spouse_ids': []
        })

    def resolve_id(target_name, current_node):
        if target_name in name_to_id:
            return name_to_id[target_name]
        for n in nodes:
            if n['name'].lower() == target_name.lower():
                return n['id']
        new_id = f"{DATASET_ID}_{len(nodes) + 1}"
        name_to_id[target_name] = new_id
        nodes.append({
            'id': new_id,
            'dataset_id': DATASET_ID,
            'name': target_name,
            'name_eng': "",
            'title': "",
            'gender': 'male',
            'info': "",
            'parent_names': [],
            'spouse_names': [],
            'child_names': [],
            'parent_ids': [],
            'spouse_ids': []
        })
        return new_id

    for node in list(nodes):
        for p_name in node['parent_names']:
            pid = resolve_id(p_name, node)
            if pid not in node['parent_ids']:
                node['parent_ids'].append(pid)

        for s_name in node['spouse_names']:
            sid = resolve_id(s_name, node)
            if sid not in node['spouse_ids']:
                node['spouse_ids'].append(sid)

        for c_name in node['child_names']:
            cid = resolve_id(c_name, node)
            c_node = next((n for n in nodes if n['id'] == cid), None)
            if c_node and node['id'] not in c_node['parent_ids']:
                c_node['parent_ids'].append(node['id'])

    for node in nodes:
        for sid in node['spouse_ids']:
            s_node = next((n for n in nodes if n['id'] == sid), None)
            if s_node and node['id'] not in s_node['spouse_ids']:
                s_node['spouse_ids'].append(node['id'])

    print(f"✨ 연결 정제 완료: 총 {len(nodes)}개 인물 노드 생성됨")

    sql_statements = []
    sql_statements.append("-- 1. genealogy_datasets 테이블 생성")
    sql_statements.append("""CREATE TABLE IF NOT EXISTS public.genealogy_datasets (
  dataset_id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);""")

    sql_statements.append("\n-- 2. genealogy_nodes 테이블 생성 (child_ids 컬럼 제거 버전)")
    sql_statements.append("""CREATE TABLE IF NOT EXISTS public.genealogy_nodes (
  id text PRIMARY KEY,
  dataset_id text NOT NULL REFERENCES public.genealogy_datasets(dataset_id) ON DELETE CASCADE,
  name text NOT NULL,
  name_eng text,
  title text,
  gender text DEFAULT 'male'::text,
  info text,
  parent_ids text[] DEFAULT '{}'::text[],
  spouse_ids text[] DEFAULT '{}'::text[],
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);""")

    sql_statements.append("\n-- 3. RLS 및 기본 데이터셋 삽입")
    sql_statements.append("ALTER TABLE public.genealogy_datasets ENABLE ROW LEVEL SECURITY;")
    sql_statements.append("ALTER TABLE public.genealogy_nodes ENABLE ROW LEVEL SECURITY;")
    sql_statements.append("CREATE POLICY \"Allow public read for datasets\" ON public.genealogy_datasets FOR SELECT USING (true);")
    sql_statements.append("CREATE POLICY \"Allow public read for nodes\" ON public.genealogy_nodes FOR SELECT USING (true);")
    sql_statements.append("CREATE POLICY \"Allow authenticated all for datasets\" ON public.genealogy_datasets FOR ALL TO authenticated USING (true);")
    sql_statements.append("CREATE POLICY \"Allow authenticated all for nodes\" ON public.genealogy_nodes FOR ALL TO authenticated USING (true);")

    sql_statements.append(f"""
INSERT INTO public.genealogy_datasets (dataset_id, title, description)
VALUES ('greek', '🏛️ 그리스·로마 신화 가계도', '그리스 로마 신화 신들과 영웅들의 가계도')
ON CONFLICT (dataset_id) DO UPDATE SET title = EXCLUDED.title;
""")

    sql_statements.append("\n-- 4. 61개 그리스 신화 인물 노드 일괄 UPSERT")

    def format_pg_array(arr):
        if not arr:
            return "'{}'::text[]"
        escaped = [item.replace("'", "''") for item in arr]
        joined = ",".join(f'"{item}"' for item in escaped)
        return f"'{'{' + joined + '}'}'::text[]"

    for n in nodes:
        name_esc = n['name'].replace("'", "''")
        name_eng_esc = n['name_eng'].replace("'", "''")
        title_esc = n['title'].replace("'", "''")
        p_ids_sql = format_pg_array(n['parent_ids'])
        s_ids_sql = format_pg_array(n['spouse_ids'])

        sql = f"""INSERT INTO public.genealogy_nodes (id, dataset_id, name, name_eng, title, gender, info, parent_ids, spouse_ids, updated_at)
VALUES ('{n['id']}', '{n['dataset_id']}', '{name_esc}', '{name_eng_esc}', '{title_esc}', '{n['gender']}', '', {p_ids_sql}, {s_ids_sql}, now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  name_eng = EXCLUDED.name_eng,
  title = EXCLUDED.title,
  gender = EXCLUDED.gender,
  parent_ids = EXCLUDED.parent_ids,
  spouse_ids = EXCLUDED.spouse_ids,
  updated_at = now();"""
        sql_statements.append(sql)

    os.makedirs(os.path.dirname(OUTPUT_SQL_PATH), exist_ok=True)
    with open(OUTPUT_SQL_PATH, 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_statements))

    print(f"💾 SQL 파일 생성 완료 -> {OUTPUT_SQL_PATH}")

if __name__ == '__main__':
    main()
