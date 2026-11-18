#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/update_hanja_ocr_page2.py

첨부된 한자사전 2페이지(2 [一部] 0획 一)에서 OCR 추출한
총 68건의 (korean, hanja, meaning) 데이터를:
- data/h08aa.txt
- data/backup-hanja_dict.json
- data/hanja_dict.json
에 반영하고,
- scripts/update_hanja_ocr_page2.sql
을 생성한 뒤 Supabase hanja_dict 테이블에 업서트를 시도합니다.
"""

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from update_hanja_ocr_page1 import (
    BACKUP_JSON_PATH,
    DICT_JSON_PATH,
    H08AA_PATH,
    SCRIPTS_DIR,
    SUPABASE_KEY,
    SUPABASE_URL,
    sql_escape,
)

SQL_OUTPUT_PATH = os.path.join(SCRIPTS_DIR, "update_hanja_ocr_page2.sql")

ENTRIES = [
    ("일계반급", "一階半級", "하찮은 벼슬. 낮은 벼슬."),
    ("일고", "一考", "한 번 생각함."),
    ("일고", "一鼓", "진군(進軍)할 때 처음에 북을 한 번 침."),
    ("일고", "一篙", "① 한 상앗대. ② 한 상앗대의 길이만큼의 물의 깊이."),
    ("일고", "一顧", "① 한 번 뒤돌아봄. ② 조금 돌봄."),
    ("일고경국", "一顧傾國", "절세(絶世)의 미인임을 이름."),
    ("일고경성", "一顧傾城", "일고경국(一顧傾國)."),
    ("일곡", "一曲", "① 한 물굽이. ② 한 굴곡. ③ 한 모퉁이. 일우(一隅). ④ 음악 한 곡(曲)."),
    ("일공", "一孔", "① 한 구멍. ② 한 점(點)·한 장소 등의 뜻."),
    ("일공", "一空", "텅 빔. 모두 없어짐."),
    ("일과", "一過", "① 한 번 지나감. ② 한 번 읽음. ③ 한 가지 과실."),
    ("일과", "一顆", "한 덩어리. 둥근 것을 세는 데 씀."),
    ("일관", "一貫", "① 한 이치(理致)로 만사를 꿰뚫음. ② 종시 변하지 아니함. 뜻을 굽히지 아니함. ③ 같음."),
    ("일괄", "一括", "한데 묶음. 또, 그것. 한 묶음. 일속(一束)."),
    ("일광", "一匡", "어지러운 천하(天下)를 바로잡아 다스림."),
    ("일괴", "一塊", "한 덩어리."),
    ("일괴육", "一塊肉", "한 덩어리의 고기라는 뜻으로, 살아남은 오직 한 사람의 자손을 이름."),
    ("일괴토", "一塊土", "한 덩어리의 흙."),
    (
        "일구",
        "一口",
        "① 한 입. 한 사람의 입. 전(轉)하여, 같은 말. 같은 소리. ② 한 사람. "
        "③ 한 입. 음식 같은 것을 먹을 때에 한 번 놀리는 입. ④ 한 말. 말 한 마디. 일언(一言). "
        "⑤ 칼 한 자루. ⑥ 한 마리. 한 개. 새·짐승·기구 등의 입이 있는 것을 세는 데 쓰는 말.",
    ),
    ("일구", "一句", "문장의 한 구."),
    ("일구", "一具", "한 벌. 의복·기구 등을 세는 데 쓰는 말."),
    ("일구", "一區", "한 구획의 땅."),
    ("일구난설", "一口難說", "한 말로는 다 설명할 수 없음."),
    ("일구이언", "一口二言", "한 입으로 두 가지의 말을 함. 곧, 약속을 어김."),
    (
        "일구일갈",
        "一裘一葛",
        "여름에 입는 갈포(葛布)로 만든 옷 한 벌과 겨울에 입는 가죽으로 만든 옷 한 벌. 전(轉)하여, 가난한 살림. 빈한한 생활.",
    ),
    (
        "일구일학",
        "一邱一壑",
        "때로는 언덕에 올라가 소풍하고 때로는 골짜기의 시내에서 낚시질한다는 뜻으로, 속세(俗世)를 떠나 자연을 벗 삼으며 몸을 고상하게 가짐을 이름.",
    ),
    ("일구지학", "一丘之貉", "한 언덕에서 같이 사는 오소리라는 뜻으로, 동류(同類)의 비유로 쓰임."),
    ("일국", "一局", "바둑 한 판."),
    ("일국", "一匊", "일국(一掬)."),
    ("일국", "一掬", "① 한 움큼. ② 좌우 두 손에 하나 가득."),
    ("일국", "一國", "한 나라. 온 나라. 전국(全國)."),
    ("일국기", "一局碁", "바둑 한 판. 일국(一局)."),
    ("일국루", "一掬淚", "두 손에 가득히 괸 눈물. 많은 눈물."),
    ("일국토", "一掬土", "두 손으로 한 번 움켜쥔 흙. 한 움큼의 흙."),
    ("일군", "一軍", "① 주대(周代)의 제도에서 군대 1만2천5백 명의 일컬음. ② 온 군대. 전군(全軍)."),
    ("일군", "一群", "한 떼."),
    (
        "일궁",
        "一弓",
        "① 한 활. 활 하나. ② 땅을 측량할 때의 길이로 8척(尺)의 일컬음. 일설(一說)에는, 7척 2촌이라 함. "
        "③ 궁술상(弓術上)의 거리로 6척(尺)의 일컬음.",
    ),
    ("일권석", "一卷石", "한 덩이의 돌."),
    ("일궐", "一蹶", "한 번 넘어짐."),
    ("일궤", "一軌", "① 통일함. 통일하여 다스림. 일통(一統). ② 같은 길. 같은 경로. 같은 법칙. 일철(一轍). ③ 같음. 동일함."),
    ("일궤", "一簣", "한 삼태기의 흙."),
    (
        "일궤이십기",
        "一饋而十起",
        "하(夏)나라의 우왕(禹王)이 지극히 백성을 사랑하여 한 번 식사하는 동안에도 열 번이나 일어나 그들을 걱정한 고사(故事).",
    ),
    ("일규", "一揆", "같은 길. 같은 경로. 같은 법칙. 일철(一轍)."),
    ("일균", "一鈞", "30근(斤)."),
    ("일금일학", "一琴一鶴", "거문고 하나와 학 한 마리가 전 재산이라는 뜻으로, 벼슬아치의 청렴(淸廉)함을 이름."),
    ("일기", "一己", "자기 한 사람. 오직 자기만."),
    ("일기", "一技", "한 가지의 기예. 한 가지의 재주."),
    ("일기", "一紀", "열두 해. 12년."),
    ("일기", "一氣", "① 천지(天地)의 원기(元氣). 음양으로 나뉘지 않은 기(氣). ② 한숨. 단숨."),
    ("일기", "一基", "한 자리. 하나. 무덤·비석(碑石) 같은 것을 세는 데 쓰는 말."),
    ("일기", "一期", "① 일기(一朞). ② 어떤 시기(時期)를 몇에 나눈 그 하나. 또, 그 최초의 시기. ③ [불교] 평생. 일생(一生)."),
    ("일기", "一朞", "한 돌. 일주년(一周年)."),
    ("일기", "一騎", "한 사람의 말 탄 군사."),
    ("일기가성", "一氣呵成", "단숨에 글을 지음. 전(轉)하여, 단숨에 일을 해냄."),
    ("일기당천", "一騎當千", "일인당천(一人當千)."),
    ("일기지욕", "一己之欲", "오직 자기 한 사람만을 위하는 욕심."),
    ("일기지욕", "一己之慾", "오직 자기 한 사람만을 위하는 욕심."),
    ("일낙", "一諾", "한 번 승낙함."),
    ("일낙천금", "一諾千金", "한 번 승낙한 것은 값이 천금이나 된다는 뜻으로, 약속은 굳게 지켜야 함을 비유한 말."),
    ("일년", "一年", "① 한 해. 12개월. ② 세기(世紀)·연호(年號)의 첫 해. ③ 어느 해."),
    ("일년삼백육십일", "一年三百六十日", "1년 내내. 1년 중."),
    ("일년지계막여수곡", "一年之計莫如樹穀", "1년간의 계획을 하는 데는 곡식을 심는 것이 제일임."),
    (
        "일년지계재우춘",
        "一年之計在于春",
        "모든 일은 만일에 대비하기 위하여 미리 계획하여야 하므로, 한 해의 방침은 첫봄에 세워야 함.",
    ),
    ("일년초", "一年草", "해마다 씨에서 새싹이 돋아나는 풀. 당년초(當年草)."),
    ("일년허도추", "一年虛渡秋", "추석날 밤에 하늘에 구름이 끼어 달을 볼 수 없는 것을 탄식한 시구(詩句)."),
    ("일념", "一念", "① 한결같은 마음. 일심(一心). ② 한 마음. 하나의 마음. ③ 짧은 시간."),
    ("일념불생", "一念不生", "[불교] 화엄(華嚴)의 오의(奧義)로서, 조금도 잡념(雜念)이 생기지 아니함을 이름."),
    ("일념삼천", "一念三千", "[불교] 사람의 마음속에 3천의 세계가 갖추어져 있다는 말."),
]


def update_h08aa(entries):
    """Update existing entries (deduplicating repeated keys) and insert missing entries in h08aa.txt."""
    with open(H08AA_PATH, "rb") as fp:
        raw = fp.read()

    is_utf16 = raw.startswith(b"\xff\xfe")
    text = raw[2:].decode("utf-16le") if is_utf16 else raw.decode("utf-8")
    line_sep = "\r\n" if "\r\n" in text else "\n"
    trailing_newline = text.endswith("\n")
    lines = text.splitlines()

    entry_map = {(k, h): m for k, h, m in entries}
    seen_keys = set()
    updated_count = 0
    deduped_count = 0
    new_lines = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            new_lines.append(line)
            continue
        parts = stripped.split("|", 2)
        if len(parts) >= 2:
            key = (parts[0].strip(), parts[1].strip())
            if key in entry_map:
                if key in seen_keys:
                    deduped_count += 1
                    continue
                seen_keys.add(key)
                new_lines.append(f"{key[0]}|{key[1]}|{entry_map[key]}")
                updated_count += 1
                continue
        new_lines.append(line)

    missing_entries = [(k, h, m) for k, h, m in entries if (k, h) not in seen_keys]
    if missing_entries:
        il_indices = [
            i for i, l in enumerate(new_lines)
            if l.strip() and l.split("|", 1)[0].startswith("일")
        ]
        il_start = il_indices[0] if il_indices else 0
        il_end = il_indices[-1] if il_indices else len(new_lines) - 1

        for k, h, m in missing_entries:
            insert_idx = il_end + 1
            for idx in range(il_start, len(new_lines)):
                cur_k = new_lines[idx].split("|", 1)[0].strip() if new_lines[idx].strip() else ""
                if idx > il_end and not cur_k.startswith("일"):
                    insert_idx = idx
                    break
                if cur_k > k:
                    insert_idx = idx
                    break
            new_lines.insert(insert_idx, f"{k}|{h}|{m}")
            il_end += 1

    out_text = line_sep.join(new_lines) + (line_sep if trailing_newline else "")
    with open(H08AA_PATH, "wb") as fp:
        if is_utf16:
            fp.write(b"\xff\xfe" + out_text.encode("utf-16le"))
        else:
            fp.write(out_text.encode("utf-8"))

    print(
        f"[h08aa.txt] Updated: {updated_count}, Deduplicated: {deduped_count}, "
        f"Inserted: {len(missing_entries)}, Total entries handled: {len(entries)}"
    )


def fetch_existing_supabase_meta(entries):
    """Fetch existing id and created_at from Supabase hanja_dict for target hanjas."""
    unique_hanjas = list(dict.fromkeys(h for _, h, _ in entries))
    meta = {}
    batch_size = 40
    for i in range(0, len(unique_hanjas), batch_size):
        chunk = unique_hanjas[i : i + batch_size]
        joined = ",".join(chunk)
        q = urllib.parse.urlencode({"select": "id,hanja,korean,created_at", "hanja": f"in.({joined})", "limit": "200"})
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/hanja_dict?{q}",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                rows = json.loads(resp.read().decode("utf-8"))
                for r in rows:
                    meta[(r["korean"], r["hanja"])] = r
        except Exception as e:
            print(f"[Supabase meta fetch skipped] {e}")
    return meta


def update_backup_json(entries, now_iso, supabase_meta):
    """Update or append entries in data/backup-hanja_dict.json."""
    with open(BACKUP_JSON_PATH, "r", encoding="utf-8") as fp:
        bdata = json.load(fp)

    by_key = {(item.get("korean", ""), item.get("hanja", "")): idx for idx, item in enumerate(bdata)}
    max_id = max((item.get("id") or 0 for item in bdata), default=0)

    updated = 0
    added = 0
    for k, h, m in entries:
        key = (k, h)
        if key in by_key:
            item = bdata[by_key[key]]
            item["meaning"] = m
            item["updated_at"] = now_iso
            updated += 1
        else:
            meta = supabase_meta.get(key)
            if meta:
                rec_id = meta["id"]
                created_at = meta["created_at"]
            else:
                max_id += 1
                rec_id = max_id
                created_at = now_iso
            bdata.append({
                "id": rec_id,
                "hanja": h,
                "korean": k,
                "meaning": m,
                "created_at": created_at,
                "updated_at": now_iso,
            })
            by_key[key] = len(bdata) - 1
            added += 1

    with open(BACKUP_JSON_PATH, "w", encoding="utf-8") as fp:
        json.dump(bdata, fp, ensure_ascii=False, indent=2)

    print(f"[backup-hanja_dict.json] Updated: {updated}, Added: {added}, Total rows: {len(bdata)}")


def update_hanja_dict_json(entries):
    """Update data/hanja_dict.json for all entries."""
    with open(DICT_JSON_PATH, "r", encoding="utf-8") as fp:
        d = json.load(fp)

    for k, h, m in entries:
        if k not in d or not isinstance(d[k], dict):
            d[k] = {}
        d[k][h] = m

    with open(DICT_JSON_PATH, "w", encoding="utf-8") as fp:
        json.dump(d, fp, ensure_ascii=False, separators=(",", ":"))

    print(f"[hanja_dict.json] Updated {len(entries)} mappings.")


def write_sql_script(entries, now_iso):
    """Write idempotent SQL upsert script scripts/update_hanja_ocr_page2.sql."""
    lines = [
        "-- ============================================================",
        "-- 첨부 한자사전 2페이지(2 [一部] 0획 一) OCR 추출 데이터 일괄 반영 SQL",
        f"-- 총 {len(entries)}건",
        "-- Supabase Dashboard > SQL Editor에서 실행하면 즉시 DB에 반영됩니다.",
        "-- ============================================================",
        "",
        "INSERT INTO public.hanja_dict (hanja, korean, meaning, updated_at)",
        "VALUES",
    ]
    val_rows = [
        f"  ({sql_escape(h)}, {sql_escape(k)}, {sql_escape(m)}, {sql_escape(now_iso)}::timestamptz)"
        for k, h, m in entries
    ]
    lines.append(",\n".join(val_rows))
    lines.extend([
        "ON CONFLICT (hanja, korean)",
        "DO UPDATE SET",
        "  meaning = EXCLUDED.meaning,",
        "  updated_at = EXCLUDED.updated_at;",
        "",
    ])

    with open(SQL_OUTPUT_PATH, "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines))

    print(f"[update_hanja_ocr_page2.sql] Generated SQL script for {len(entries)} rows.")


def upload_to_supabase(entries, now_iso):
    """Attempt to upsert all entries into Supabase hanja_dict via REST API."""
    payload_rows = [
        {
            "hanja": h,
            "korean": k,
            "meaning": m,
            "updated_at": now_iso,
        }
        for k, h, m in entries
    ]
    endpoint = f"{SUPABASE_URL}/rest/v1/hanja_dict?on_conflict=hanja,korean"
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload_rows, ensure_ascii=False).encode("utf-8"),
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            print(f"[Supabase REST upsert] Success! HTTP {resp.status} ({len(payload_rows)} rows)")
            return True
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")
        print(
            f"[Supabase REST upsert] Blocked by RLS / permissions (HTTP {e.code}): {err_body}\n"
            "  -> scripts/update_hanja_ocr_page2.sql 또는 한자앱(hanja.html) 로그인 시 자동 동기화로 DB에 반영됩니다."
        )
        return False
    except Exception as e:
        print(f"[Supabase REST upsert] Failed: {e}")
        return False


def main():
    assert len(ENTRIES) == 68, f"Expected 68 entries, got {len(ENTRIES)}"
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    update_h08aa(ENTRIES)
    meta = fetch_existing_supabase_meta(ENTRIES)
    update_backup_json(ENTRIES, now_iso, meta)
    update_hanja_dict_json(ENTRIES)
    write_sql_script(ENTRIES, now_iso)
    upload_to_supabase(ENTRIES, now_iso)


if __name__ == "__main__":
    main()
