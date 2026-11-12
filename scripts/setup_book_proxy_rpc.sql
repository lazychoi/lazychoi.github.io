-- ============================================================
-- 도서 표지 이미지 및 목차(TOC) 수집을 위한 Supabase 서버 프록시 함수 (방법 A)
-- Supabase Dashboard -> SQL Editor에 붙여넣고 [Run]을 눌러 실행하세요.
-- ============================================================

-- 1. PostgreSQL 내장 HTTP 확장 활성화
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- 2. 도서 검색 및 상세 페이지(표지·목차) 조회용 RPC 함수 생성
CREATE OR REPLACE FUNCTION public.fetch_yes24_page(p_path text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_res record;
BEGIN
  -- 허용된 도서 검색 및 상세 경로만 조회 가능하도록 제한
  IF p_path IS NULL OR (
    p_path NOT LIKE '/Product/Search%' AND
    p_path NOT LIKE '/Product/Goods/%' AND
    p_path NOT LIKE '/product/goods/%'
  ) THEN
    RAISE EXCEPTION 'Invalid path: %', p_path;
  END IF;

  v_url := 'https://www.yes24.com' || p_path;

  -- http 확장을 통해 서버 측에서 직접 HTML 조회 (브라우저 CORS 우회)
  SELECT status, content
  INTO v_res
  FROM extensions.http((
    'GET',
    v_url,
    ARRAY[
      extensions.http_header('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'),
      extensions.http_header('Accept-Language', 'ko-KR,ko;q=0.9')
    ],
    NULL,
    NULL
  )::extensions.http_request);

  IF v_res.status = 200 THEN
    RETURN v_res.content;
  END IF;

  RETURN '';
END;
$$;

-- 3. 웹 앱(anon, authenticated)에서 RPC 호출 권한 부여
GRANT EXECUTE ON FUNCTION public.fetch_yes24_page(text) TO anon, authenticated;
