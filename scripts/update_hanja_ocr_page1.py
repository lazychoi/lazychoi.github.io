#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/update_hanja_ocr_page1.py

첨부된 한자사전 스캔 이미지([一部] 0획 一, p. 1)에서 OCR 추출한
1) 단일 한자 일(一)의 상세 [자해]/[자원]
2) 기존 등록 단어(그룹 A) 29건 (일가 2건 포함)
3) 미등록 단어(그룹 B) 16건 (일갹/일각 一噱 포함 총 17건)
총 49건의 (korean, hanja, meaning) 데이터를:
- data/h08aa.txt
- data/backup-hanja_dict.json
- data/hanja_dict.json
에 반영하고,
- scripts/update_hanja_ocr_page1.sql
을 생성한 뒤 Supabase hanja_dict 테이블에 업서트를 시도합니다.
"""

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
SCRIPTS_DIR = os.path.join(BASE_DIR, "scripts")

H08AA_PATH = os.path.join(DATA_DIR, "h08aa.txt")
BACKUP_JSON_PATH = os.path.join(DATA_DIR, "backup-hanja_dict.json")
DICT_JSON_PATH = os.path.join(DATA_DIR, "hanja_dict.json")
SQL_OUTPUT_PATH = os.path.join(SCRIPTS_DIR, "update_hanja_ocr_page1.sql")

SUPABASE_URL = "https://tpwwwpcbinxdhxqvcvqc.supabase.co"
SUPABASE_KEY = "sb_publishable_A1sd3hvbeQx9-gVoFXL0qA_G923SWm9"

IL_DETAILED_MEANING = (
    "[자해]</br>"
    "①한 일, 하나 일 ㉠수의 처음. ‘一人’. ‘擧一而廢百’〈孟子〉. "
    "㉡단독. 단지 하나. ‘一手獨拍, 雖疾無聲’〈韓非子〉. "
    "㉢처음. 근본. ‘務一不尙繁密’〈顔延之〉. "
    "㉣순전(純全). 순수. ‘純一’. ‘惟精惟一’〈書經〉, ‘天得一以淸’〈老子〉. "
    "㉤같음. 동일(同一). ‘一樣’, ‘一色’. ‘先聖後聖, 其揆一也’〈孟子〉. "
    "㉥전일(專一). ‘一心’, ‘一意’. ‘用心一也’〈淮南子〉.</br>"
    "②하나로할 일 ㉠합침. ‘人主者, 一力以共戴之’〈韓非子〉. "
    "㉡동일하게 함. ‘一度量, 平權衡’〈呂氏春秋〉. "
    "㉢고르게 함. ‘靜生民之業, 而一其俗’〈史記〉. "
    "㉣통일함. ‘孰能一之’〈孟子〉.</br>"
    "③첫째 일 제일. ‘一等’. ‘治爲天下第一’〈漢書〉.</br>"
    "④온통 일 전부. 전체. ‘一國’. ‘一軍皆驚’〈史記〉.</br>"
    "⑤낱낱 일 하나하나. ‘逐一點檢’〈朱子語錄〉.</br>"
    "⑥한번 일 1회. ‘人一能之, 己百之’〈中庸〉, ‘目所一見, 輒誦於口’〈後漢書〉.</br>"
    "⑦만일 일 만약. ‘一旦’. ‘彼一見秦王, 秦王必相之’〈戰國策〉.</br>"
    "⑧오로지 일 외곬으로. 전혀. ‘一遵蕭何之約束’〈史記〉, ‘賞罰一從上出’〈韓非子〉.</br>"
    "⑨모두 일 다. 빠짐없이. ‘一切’. ‘一可以爲法則’〈荀子〉.</br>"
    "⑩어느 일 어떤. ‘一日’, ‘一說’. ‘一夕自恨死’〈柳宗元〉.</br>"
    "⑪어조사 일 어세(語勢)를 강하게 하는 조사(助辭). ‘一遊一豫, 爲諸侯度’〈孟子〉.</br>"
    "⑫성 일 성(姓)의 하나.</br></br>"
    "[자원] (갖은자: 壹, 지사(指事))</br>"
    "가로의 한 획으로 수(數)의 ‘하나’의 뜻을 나타냄. 수(數)의 첫째인 데서 ‘처음·근본’의 뜻도 가리킴. "
    "또 둘 이상의 것이 아닌 하나의 뜻에서, ‘같다·오로지’의 뜻을 나타내며, "
    "둘 이상으로 나뉘지 않고 합쳐져 있는 전체의 뜻을 나타냄."
)

ENTRIES = [
    # 단일 한자 (1건)
    ("일", "一", IL_DETAILED_MEANING),
    # 단어 목록 (A + B 전체 48건)
    ("일가", "一架", "① 시렁 하나, 한 시렁. ② 시렁 가득히."),
    ("일가", "一家", "① 한 가옥, 한 집. ② 한 가족, 한집안. ③ 한 가지 학문이나 기예에 대한 성가(成家). ④ 한 학파(學派), 한 유파(流派)."),
    ("일가단란", "一家團欒", "한집안 식구가 무릎을 모아 둘러앉는다는 뜻으로, 한집안 식구가 화목하게 지냄을 이름."),
    ("일가부귀천가원", "一家富貴千家怨", "한 집이 부귀를 누리면, 천 집이 이를 시기하고 미워함."),
    ("일가언", "一家言", "일가견(一家見)."),
    ("일가지언", "一家之言", "자가 독특(自家獨特)의 학설. 자신의 설. 또, 그 저작."),
    ("일각", "一角", "① 한 뿔. 뿔 하나. ② 한 모퉁이. 일우(一隅)."),
    ("일각", "一刻", "① 1시간의 4분의 일. 곧, 십오 분. ② 매우 짧은 시간."),
    ("일각천금", "一刻千金", "일각(一刻)의 짧은 시간도 아깝기가 천금(千金)과 같음. 또, 썩 즐거운 경우를 이름."),
    ("일간", "一竿", "장대 하나. 낚싯대 하나."),
    ("일간", "一間", "① 가운데에 한 사람이 끼여 있는 정도의 거리라는 뜻으로, 약간의 차이를 이름. ② 집의 기둥과 기둥과의 사이."),
    ("일간풍월", "一竿風月", "낚싯대 하나를 벗 삼아 풍월(風月)을 즐기는 일. 낚시질을 하며 자연의 풍경(風景)을 즐기는 일."),
    ("일갈", "一喝", "한 번 큰 소리로 꾸짖음."),
    ("일갈", "一葛", "갈포(葛布)로 지은 여름옷 한 벌."),
    ("일감", "一龕", "하나의 감실(龕室). 하나의 사탑(寺塔)."),
    ("일감", "一鑑", "거울 하나."),
    ("일개", "一个", "① 하나. 한 개. ② 한 사람. 일개(一介)."),
    ("일개", "一介", "① 한 사람. ② 약간. 근소."),
    ("일개", "一個", "하나. 일개(一箇)."),
    ("일개", "一箇", "일개(一個)."),
    ("일개", "一槩", "① 한데 아우름. ② 같음. 동일함. ③ 모두. 일률적으로."),
    ("일개", "一概", "일개(一槩)."),
    ("일개불취", "一介不取", "욕심이 아주 없음을 이름."),
    ("일개서생", "一介書生", "보잘것없는 한 사람의 서생."),
    ("일갹", "一噱", "한 번 크게 웃음. 한 번 웃음."),
    ("일각", "一噱", "한 번 크게 웃음. 한 번 웃음."),
    ("일거", "一炬", "횃불 하나."),
    ("일거", "一擧", "① 한 번 날아오름. ② 한 번 행함. 또, 한 번의 일. ③ 한 번 희생(犧牲)을 죽여 제기(祭器)에 담음."),
    ("일거무소식", "一去無消息", "한 번 간 뒤에 아주 소식이 없음."),
    ("일거수일투족", "一擧手一投足", "손 한 번 들고 발 한 번 내디딘다는 뜻으로, 동작 하나하나를 이름."),
    ("일거양득", "一擧兩得", "한 가지 일을 하여 두 가지 이득을 봄. 일석이조(一石二鳥)."),
    ("일거일동", "一擧一動", "사소한 동작."),
    ("일거일래", "一去一來", "갔다 왔다 함."),
    ("일검", "一劍", "칼 한 자루."),
    ("일검지임", "一劍之任", "척살(刺殺) 또는 결투 등에 의하여 일을 결말지어야 할 임무."),
    ("일격", "一擊", "한 번 침."),
    ("일견", "一見", "① 한 번 봄. 또, 언뜻 봄. 잠깐 봄. ② 한 번 만남. ③ 처음으로 만남. 초대면(初對面)함."),
    ("일견여구", "一見如舊", "일면여구(一面如舊)."),
    ("일견폐형백견폐성", "一犬吠形百犬吠聲", "한 마리의 개가 사람이나 물건의 형상을 보고 짖으면 이 소리를 들은 여러 개는 덩달아 짖는다는 뜻으로, 한 사람이 거짓말을 하면 이 말을 들은 여러 사람들은 모두 이를 곧이듣고 남에게 전함을 비유한 말. 일인전허만인전실(一人傳虛萬人傳實)."),
    ("일결", "一決", "단번에 결단함."),
    ("일결", "一闋", "한 곡(曲)의 음악이 끝나는 일."),
    ("일겸", "一慊", "하인 한 사람. 종 한 사람. 일복(一僕)."),
    ("일경", "一更", "오후 여덟 시경. 초경(初更)."),
    ("일경", "一經", "① 한 경서(經書). 한 가지의 경서. ② 경서 한 권."),
    ("일경구수지서", "一莖九穗之瑞", "한 줄기에서 아홉 개의 이삭이 나왔다는 상서로운 곡초(穀草)."),
    ("일경박사", "一經博士", "경서(經書) 한 가지만 연구하여 된 박사. 박사는 학예를 맡은 벼슬임."),
    ("일계", "一系", "한 계통. 같은 계통."),
    ("일계", "一計", "한 가지 꾀. 한 꾀."),
]


def update_h08aa():
    """Update existing entries (deduplicating repeated keys) and insert missing entries in h08aa.txt."""
    with open(H08AA_PATH, "rb") as fp:
        raw = fp.read()

    is_utf16 = raw.startswith(b"\xff\xfe")
    text = raw[2:].decode("utf-16le") if is_utf16 else raw.decode("utf-8")
    line_sep = "\r\n" if "\r\n" in text else "\n"
    trailing_newline = text.endswith("\n")
    lines = text.splitlines()

    entry_map = {(k, h): m for k, h, m in ENTRIES}
    seen_keys = set()
    updated_count = 0
    deduped_count = 0
    new_lines = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            new_lines.append(line)
            continue
        parts = stripped.split("|")
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

    # Insert missing group B entries in 가나다 order inside the contiguous '일' section
    missing_entries = [(k, h, m) for k, h, m in ENTRIES if (k, h) not in seen_keys]
    if missing_entries:
        # Locate the contiguous '일' section bounds in new_lines
        il_indices = [
            i for i, l in enumerate(new_lines)
            if l.strip() and l.split("|", 1)[0].startswith("일")
        ]
        il_start = il_indices[0] if il_indices else 0
        il_end = il_indices[-1] if il_indices else len(new_lines) - 1

        # Group missing entries by sorted insertion point within [il_start, il_end + 1]
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
        f"Inserted: {len(missing_entries)}, Total entries handled: {len(ENTRIES)}"
    )


def fetch_existing_supabase_meta():
    """Fetch existing id and created_at from Supabase hanja_dict for target hanjas."""
    unique_hanjas = list(dict.fromkeys(h for _, h, _ in ENTRIES))
    joined = ",".join(unique_hanjas)
    q = urllib.parse.urlencode({"select": "id,hanja,korean,created_at", "hanja": f"in.({joined})", "limit": "200"})
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/hanja_dict?{q}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
    )
    meta = {}
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
            for r in rows:
                meta[(r["korean"], r["hanja"])] = r
    except Exception as e:
        print(f"[Supabase meta fetch skipped] {e}")
    return meta


def update_backup_json(now_iso, supabase_meta):
    """Update or append all 49 entries in data/backup-hanja_dict.json."""
    with open(BACKUP_JSON_PATH, "r", encoding="utf-8") as fp:
        bdata = json.load(fp)

    by_key = {(item.get("korean", ""), item.get("hanja", "")): idx for idx, item in enumerate(bdata)}
    max_id = max((item.get("id") or 0 for item in bdata), default=0)

    updated = 0
    added = 0
    for k, h, m in ENTRIES:
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


def update_hanja_dict_json():
    """Update data/hanja_dict.json for all 49 entries."""
    with open(DICT_JSON_PATH, "r", encoding="utf-8") as fp:
        d = json.load(fp)

    for k, h, m in ENTRIES:
        if k not in d or not isinstance(d[k], dict):
            d[k] = {}
        d[k][h] = m

    with open(DICT_JSON_PATH, "w", encoding="utf-8") as fp:
        json.dump(d, fp, ensure_ascii=False, separators=(",", ":"))

    print(f"[hanja_dict.json] Updated {len(ENTRIES)} mappings.")


def sql_escape(val):
    return "'" + str(val).replace("'", "''") + "'"


def write_sql_script(now_iso):
    """Write idempotent SQL upsert script scripts/update_hanja_ocr_page1.sql."""
    lines = [
        "-- ============================================================",
        "-- 첨부 한자사전([一部] 0획 一, p. 1) OCR 추출 데이터 일괄 반영 SQL",
        "-- 단일 한자 일(一) 상세 자해/자원 + 단어 그룹 A·B 전체 (총 49건)",
        "-- Supabase Dashboard > SQL Editor에서 실행하면 즉시 DB에 반영됩니다.",
        "-- ============================================================",
        "",
        "INSERT INTO public.hanja_dict (hanja, korean, meaning, updated_at)",
        "VALUES",
    ]
    val_rows = []
    for k, h, m in ENTRIES:
        val_rows.append(
            f"  ({sql_escape(h)}, {sql_escape(k)}, {sql_escape(m)}, {sql_escape(now_iso)}::timestamptz)"
        )
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

    print(f"[update_hanja_ocr_page1.sql] Generated SQL script for {len(ENTRIES)} rows.")


def upload_to_supabase(now_iso):
    """Attempt to upsert all 49 rows into Supabase hanja_dict via REST API."""
    payload_rows = [
        {
            "hanja": h,
            "korean": k,
            "meaning": m,
            "updated_at": now_iso,
        }
        for k, h, m in ENTRIES
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
            "  -> scripts/update_hanja_ocr_page1.sql 또는 한자앱(hanja.html) 로그인 시 자동 동기화로 DB에 반영됩니다."
        )
        return False
    except Exception as e:
        print(f"[Supabase REST upsert] Failed: {e}")
        return False


def main():
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    update_h08aa()
    meta = fetch_existing_supabase_meta()
    update_backup_json(now_iso, meta)
    update_hanja_dict_json()
    write_sql_script(now_iso)
    upload_to_supabase(now_iso)


if __name__ == "__main__":
    main()
