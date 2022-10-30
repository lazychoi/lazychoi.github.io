---
title: Pandas in Action 키워드
date: 2022-10-21
---

## Series

### 생성: pd.Series(data=None, index=None, dtype=None)

- 생성자: data, index, dtype
- data: 딕셔너리, 리스트, 튜플 자료형, numpy ndarray. but 집합 자료형은 안 됨(순서, 연관이 없기 때문)
- index 사용자 정의
- dtype 지정으로 형변환
- 결측값 입력: np.nan  

### Series 속성

- 시리즈.index, 시리즈.dtype, 시리즈.size, 시리즈.shape, 시리즈.values
- 시리즈.is_unique, **시리즈.is_monotonic**

### Series 메서드

- 시리즈.head([n]), 시리즈.tail([n])
- 수학 연산:  
  - 인덱스(라벨)가 같은 것끼리 연산.
  - 결측값 무시
  - 시리즈.count(), 시리즈.sum(skipna=True, min_count=0), 시리즈.product(skipna=True, min_count=0)
  - 시리즈.mean(), 시리즈.median(), 시리즈.std(), 시리즈.max(), 시리즈.min()
  - **시리즈.cumsum(skipna=True)**, **시리즈.pct_change([fill_method=])**
  - 시리즈.describe(), 시리즈.sample(), 시리즈.unique(), 시리즈.nunique()
  - 산술 연산:
  - NaN과 연산할 때 NaN 반환
  - '+, -, *, /, //, %, ==, !=' 연산자
  - 시리즈.add([스칼라 or 시리즈]), 시리즈.sub([스칼라 or 시리즈]), 시리즈.subtract([스칼라 or 시리즈]), 시리즈.mul([스칼라 or 시리즈]), 시리즈.multiply([스칼라 or 시리즈]), 시리즈.div([스칼라 or 시리즈]), 시리즈.divide([스칼라 or 시리즈]), 시리즈.floordiv([스칼라 or 시리즈]), 시리즈.mod([스칼라 or 시리즈]), 시리즈.eq([스칼라 or 시리즈]), 시리즈.ne([스칼라 or 시리즈])
- 시리즈를 파이썬 함수 인자로 전달 가능: len(시리즈), list(시리즈), dict(시리즈), '값' [not] in 시리즈.values

주의!!!

- np.nan == np.nan => False
- len(시리즈) => NaN 포함
- NaT: not a time

### 주요 메서드

- 아래 모든 메서드는 새로운 시리즈 반환. 
- 자신을 바꾸려면 inplace=True 옵션 추가(None 반환) => 성능 이점 없으니 사용하지 말 것
- pd.read_csv('csv파일명'):
  - index_col='열이름'
  - squeeze=True : 데이터프레임 자료형을 시리즈 자료형으로 변환. but deprecated
  - **parse_dates**=['열이름'] : 날짜 형식의 문자열 -> 날짜 자료형
  - usecols=['열이름, '열이름'] : 가져올 열이름 지정. 시리즈로 가져올 때는 최대 2개
- value 기준 정렬: 
  - 시리즈.sort_values(), 시리즈.sort_values(ascending=False)
  - na_position='last/first': NaN 배치(default=last)
- index 기준 정렬: 날짜 인덱스일 때 주로 사용
  - 시리즈.sort_index(), 시리즈.sort_index(ascending=False)
- 결측값 제거: 시리즈.dropna()
- 최고[저]값 n개: 시리즈.nlargest(n), 시리즈.nsmallest(n)
- 값 별 개수: 시리즈.value_counts()
  - ascending=False/True 
  - **normalize**=False/True
  - **bins**=[] : 구간을 정해 개수 세기. eg. bins = 5 or [0, 200, 400, 600, 800]
  - **sort=False** : 인덱스 순으로 출력
  - dropna=False: NaN 개수도 세기
- 반올림: 시리즈.round(n) n=출력할 소숫점 자리수
- 시리즈.apply(함수) : 시리지의 각 값에 대해 한 번씩 함수를 호출하고 반환값을 시리즈로 구성해 새 시리즈를 반환

## DataFrame

### 생성

- 중복된 행, 중복된 열 인덱스를 허용하지만 가능한 고유값으로 하는 게 좋음
- pd.DataFrame(data)
  - dictionary, list, tuple, ndarray (iterable) -> DataFrame 
  - columns = ['col1','col2',...]

### 속성

- df변수.index -> RangeIndex(start, end, steps) 반환
- df변수.columns -> Index 반환
- df변수.shape
- df변수.size(NaN 포함) cf. NaN 포함한 개수 : df변수.count()


### 메서드

- df변수.sum([numeric_only=True]), df변수.mead([numeric_only=True]), df변수.median([numeric_only=True]), df변수.mode([numeric_only=True]), df변수.std([numeric_only=True])
- df변수.max(), df변수.min()
- **df변수.nunique()** : 열 별로 고윳값 개수 나타내는 Series 반환
- **df변수.nlargest**(n, columns=['col1', 'col2']), df변수.smallest()

### 정렬 및 인덱스

- 한 열 기준으로 정렬: df변수.sort_values('열이름', ascending=True/False)
- 여러 열 기준으로 정렬: df변수.sort_values(['열이름', '열이름', ...], ascending=True/False)
- 각 열을 다른 순서로 정렬: df변수.sort_values(['열이름', '열이름', ...], ascending=[True, False])
- 행 인덱스 기준으로 정렬: df변수.sort_index(ascending=True/False)
- 열 인덱스 기준으로 정렬: df변수.sort_index(axis='columns', ascending=True/False) or df변수.sort_index(axis=1)
- df변수 정렬을 최초 상태로 되돌리기: df변수 = df변수.sort_index()
- 새 인덱스 설정: df변수 = df변수.set_index('열이름')
- 인덱스를 일반 컬럼로 바꾸기: df변수.reset_index()
- 기존 인덱스를 일반 컬럼으로 바꾸고 새 인덱스 설정: df변수 = df변수.reset_index().set_index('열이름')

### 열과 행 선택 및 이름 바꾸기

- 열 선택
  - 다중 열 선택: df변수['열이름'], df변수[['열이름','열이름',...]]
  - 데이터 유형에 따라 열 선택(eg. 문자형 열만 선택): df변수.select_dtypes(include='object')
  - 데이터 유형에 따라 열 선택(eg. 문자형 및 정수 열 제외한 모든 열 선택): df변수.select_dtypes(exclude=['object', 'int'])
- 행 선택
  - 레이블 선택: df변수.loc[['행이름', '행이름', ...]]
  - 슬라이싱 활용: df변수.loc['행이름' : ], df변수.loc[ : '행이름'], df변수.loc['행이름' : '행이름']
  - 인덱스 위치 선택: df변수.iloc[n], df변수.iloc[n:m], df변수.iloc[n:m:step], df변수.iloc[[m, n, o, ...]]
- 열, 행 함께 고려하여 선택
  - 셀 값: df변수.loc['행이름', '열이름'], df변수.iloc[m, n], df변수.at['행이름', '열이름'], df변수.iat[행번호, 열번호]
  - 한 행의 여러 컬럼 값 선택: df변수.loc['행이름', ['열이름', '컬러명']], df변수['행이름', '열이름':'열이름'], df변수.iloc[n, [m, o]], df변수.iloc[n, [m : o]]
  - 여러 행의 여러 컬럼 값 선택: df변수.loc[['행이름', '행이름'], ['열이름', '열이름']]
- 이름 바꾸기
  - 열이름 가져오기: df변수.columns
  - 열이름 일부 변경: df변수 = df변수.rename(columns = {'구이름':'새이름'})
  - 행이름 일부 변경: df변수 = df변수.rename(index = {'구이름':'새이름'})
- 열 삭제
  - df변수 = df변수.drop(labels='열이름', axis='columns')

## 데이터셋 변환으로 메모리 최적화

- 최적의 데이터 유형: 가장 적은 메모리 사용 or 가장 많은 유틸리티 제공 데이터 유형
- 날짜/시간 유형으로 변환: pd.read_csv(parse_dates=['열이름'])
- 데이터셋의 용량 확인: df변수.info()
- 데이터 형변환: df변수['열이름'] = df변수['열이름'].astype(자료형)
- NaN이 있으면 정수값만 있어도 float64 -> NaN을 정수로 바꾼 뒤 정수형으로 변환: df변수['열이름'].fillna(0).astype(int)
- 소수의 고유값으로 구성된 열 -> 범주형: df변수['gender'] = df변수['gender'].astype('category')

## Dataframe 필터링

- 반환되는 boolean 시리즈 활용
- `==`(eq), `!=`(ne), `<`(lt), `<=`(le), `>`(gt), `>=`(ge), `&`, `|`, `~`
- 여러 개의 문자열이 포함된 행 필터링(or): df변수['열이름'].isin(['찾을 문자열', '찾을 문자열', ...])
- 범위 내의 데이터 필터링(숫자, 날짜, 문자): df변수['열이름'].between(시작, 끝)
- 결측값만 필터링: df변수['열이름'].isnull()
- 결측값이 아닌 행만 필터링: df변수['열이름'].notnull()

## 결측값 다루기

- 결측값이 포함된 행 삭제: df변수.dropna(how='any/all')
- **특정 열에 결측값이 있는 행 삭제**: df변수.dropna(subset=['열이름'])
- 비결측값이 최소 n개인 행만 남김: df변수.dropna(thresh = n)
- 결측값를 특정값으로 바꾸기: df변수.fillna(바꿀값)

## 중복값 다루기

- 반환되는 boolean 시리즈 활용
- [duplicated](duplicated.md)
- 열에서 이전에 한 번이라도 본 적이 있는 값은 모두 True 표시: df변수['열이름'].duplicated()
- 특정 열에서 고유한 값의 첫 번째 행만 필터링: df변수[ ~df변수['열이름'].duplicated() ] 
- <- duplicated()는 동일한 값 중 두번째 값부터 True를 반환하기 때문에 반대로 뒤집으면(~) 중복되지 않은 값 중 첫 번째 행만 출력됨
- 행의 모든 값이 일치하는 행 제거: df변수.drop_duplicates()
- 특정 열에서 중복값 제거(특정 값이 처음 나타나는 행만 유지): df변수.drop_duplicates(subset=['열이름'])
- 특정 열에서 중복값 제거(특정 값이 마지막 나타나는 행만 유지): df변수.drop_duplicates(subset=['열이름'], keep='last)
- 특정 열에서 중복값 모두 제거(첫번째나 마지막 값도 삭제): df변수.drop_duplicates(subset=['열이름'], keep=False)


## 6장 텍스트 데이터 다루기

- 랭글링(wrangling), 먼징(munging): 데이터를 정리하는 과정
- 시리즈 객체의 str 속성 사용하면 강력한 문자열 처리 메서드를 제공하는 StringMethods 객체에 접근 가능: df변수['object 컬럼'].str
- 공백 제거: df변수['object 컬럼'] = df변수['object 컬럼'].str.strip()/lstrip()/rstrip()
- 모든 컬럼에 문자열 함수 적용: for column in df변수.columns: ; df[column] = df[column].str.strip()
- df변수['object 컬럼'].str.upper()/lower()/capitalize()/title()
- df변수['object 컬럼'].str.replace()
- 슬라이싱은 파이썬과 같음: df변수['object 컬럼'].str[시작인덱스:끝인덱스]
- 특정 단어가 포함된 행 필터링: has_pizza = df변수['object 컬럼'].str.lower().str.contains('pizza') ; df변수[has_pizza] <- 대소문자 구분 없애기 위해 먼저 소문자로 변환
- 특정 문자로 시작하는 단어 찾기: df변수['object 컬럼'].str.lower().str.startstwith('문자')
- 특정 문자로 끝나는 단어 찾기: df변수['object 컬럼'].str.lower().str.endstwith('문자')
- 문자열 크기: df변수['object 컬럼'].str.len()
- 문자열 분할 개수 지정: df변수['object 컬럼'].str.split(pat = " ", n = 1) -> 첫 번째 공백만 분할 -> 2개 요소를 지닌 리스트 반환
- 문자열의 첫 번째 글자만 가져오기: df변수['object 컬럼'].str.get(0)
- 공백으로 분할한 문자의 두 번째 단어만 가져오기: df변수['object 컬럼'].str.split(pat = " ", n = 1).str.get(1)
- 공백으로 분할한 문자의 마지막 단어만 가져오기: df변수['object 컬럼'].str.split(pat = " ", n = 1).str.get(-1)
- 공백으로 분할한 문자를 새로운 데이터프레임으로 반환: df변수['object 컬럼'].str.split(pat = " ", n = 1, expand = True)
- 정규표현식 지원: df변수['열이름'].str.repalce(to_replace, value, regex = True)

## 7장 멀티 인덱스 데이터프레임

### 멀티 인덱스, 멀티 컬럼 생성

- 한 열의 값이 다른 열 값의 하위범주인 계층적 데이터 표현에 좋음
- MultiIndex : 각 레이블에 여러 값을 보유하는 컨테이너
- 레벨: 레이블에서 동일한 위치에 있는 값
- 멀티 row_index = pd.MultiIndex.from_tuples(tuples, names= ['레벨1', '레벨2]) ; pd.DataFrame(row_index=row_index)
- 멀티 column_index = pd.MultiIndex.from_tuples(tuples) ; pd.DataFrame(columns=column_index)
- 멀티 인덱스와 헤더가 적용된 csv 파일 불러오기: read_csv('파일명', index_col=[0, 1, 2, ...], header = [0, 1, ...])
- 멀티 인덱스 이름 가져오기: df변수.index.names
- 인덱스 레벨에 해당하는 이름 가져오기: df변수.index.get_level_values(인덱스/이름)
- 멀티 컬럼에 이름 지정하기: df변수.columns.names = ['Category', 'Subcategory']
- 컬럼 레벨에 해당하는 이름 가져오기: df변수.columns.get_level_values(인덱스/이름)

### 멀티 인덱스 정렬 <- 데이터가 아니라 인덱스 이름 순으로 정렬

- df변수.sort_index(): 가장 왼쪽의 인덱스부터 오름차순으로 정렬. 내림차순은 ascending=False 매개변수 추가
- 각 레벨의 정렬 순서를 다르게 지정: df변수.sort_index(ascending = [True, False, True, ...])
- 지정한 레벨만 정렬: df변수.sort_index(level = [인덱스번호/이름, 인덱스번호/이름])
- 열 정렬: df변수.sort_index(axis = 1/"columns")

### 멀티 인덱스 행, 열 선택

- [공식 문서 참고](https://pandas.pydata.org/pandas-docs/stable/user_guide/advanced.html#advanced-indexing-with-hierarchical-index){target=_blank}
- 서브카테고리 선택 -> 튜플로 감싼다: df변수[('주카테고리명', '서브카테고리명')]
- 여러 개의 열 추출 -> 튜플을 대괄호로 감싼다: df변수[ [('주카테고리명', '서브카테고리명'), ('주카테고리명', '서브카테고리명')] ]
- 인덱스명으로 행 추출 -> 왼쪽부터 적용: df변수.loc[ ('인덱스명', '인덱스명', ...)]
- 행과 열을 이름으로 추출: df변수.loc[ ('인덱스1레벨', '인덱스2레벨'), ('주카테고리', '서브카테고리') ]
- df변수.iloc는 레벨에 걸쳐 인덱싱할 수 없다. 단순히 행, 열 순서에 따라 인덱싱, 슬라이싱 한다.
- 특정 인덱스이름 값이 특정값인 데이터만 출력(eg. City 인덱스가 Seoul인 데이터만 출력): df변수.xs(key = 'Seoul', level = 'City')
- 특정 열이름 값이 특정값인 데이터만 출력(eg. Subcategory가 Museum인 데이터만 출력): df변수.xs(axis = 'columns', key = 'Museum', level = 'Subcategory')
- xs 메서드에 비연속적인 key, level를 전달할 때는 **튜플로 묶는다**.

### 멀티 인덱스 재설정

- 멀티 인덱스를 지정한 순서대로 정렬: df변수.reorder_levels(order = ['이름1'/번호, '이름2'/번호, ...])
- 멀티 인덱스를 새로운 열로 삽입하고 인덱스는 숫자로 대체: df변수.reset_index()
  - col_level = 'Subcategory' 열이름을 서브카데고리 레벨에 삽입
  - col_fill = '이름' 빈 열이름에 지정한 이름 추가
  - level = '인덱스명' 지정한 인덱스명만 일반 열로 옮김. 인덱스명 여러 개를 리스트로 전달하면 지정한 레벨만 열로 이동.
  - level = '인덱스명', drop=True  지정한 레벨 삭제
- 지정한 멀티 레벨 열을 인덱스로 설정: df변수.set_index(keys = ('카테고리명', '서브카테고리명'))

## 10장 재구성과 피벗

### 피벗 테이블 생성

- 특정 열(eg. 날짜) 별로 모든 숫자 열의 평균 집계: df변수.pivot_table()
  - index='열이름' : 열이름을 인덱스명으로 사용. 열 리스트를 전달하면 MultiIndex
  - aggfunc = 'mean/sum/max/min/std/median/count/size' : 집계 함수 선택. size = count. 리스트로 여러 개 집계함수 지정['sum', 'count']. 딕셔너리 형식으로 열별 다른 집계함수 지정{'열이름':'집계함수', '열이름':'집계함수'}
  - values = '열이름' : 집계 함수를 적용할 열 선택. 여러 열을 선택하려면 리스트로 지정
  - columns = '열이름' : 입력한 열의 고유값을 열 헤더로 지정
  - fill_value = 숫자 : NaN을 지정한 값으로 대체
  - margins = True : 행별, 열별 합계 출력
  - margins_name = 'Total' : 합계 레이블 이름을 'Total'로 지정

### 인덱스 레벨 스택과 언스택

- df변수.stack() : 열 인덱스 -> 행 인덱스. NaN은 사라짐
- df변수.unstack() : 가장 우측 행 인덱스 -> 열 인덱스

### melting, 피벗 해제

- 넓은 데이터셋을 좁은 데이터셋으로 변환하는 과정
- df변수.melt()
  - id_vars = '식별자 열'
  - value_vars = '피벗 해제되어 새 열에 저장될 열' 여러 열을 지정하려면 리스트로 묶음 <- 생략 가능. 기본적으로 식별자 열을 제외한 모든 열을 피벗 해제
  - var_name = '열이름'
  - value_name = '열이름'

- 열에 있는 리스트 요소를 별도의 행으로 분리: df변수.explode('열이름')

## 9장 GroupBy 객체

- df변수.groupby('열이름') -> DataFrameGroupBy 객체 반환. 열이름은 주로 범주형
- 그룹명에 포함된 모든 행을 데이터프레임으로 반환 : GroupBy객체.get_group('그룹명')
- 각 그룹의 평균, 합계 등 계산 : GroupBy객체.mean()/sum()/max()/min()
- 그룹과 행 개수를 알파벳 순서로 나열한 리스트로 구성된 시리즈 반환 : GroupBy객체.size()
- 그룹을 key로, 그룹에 속한 행을 values 리스트로 구성된 딕셔너리 반환 : GroupBy객체.groups
- 각 그룹의 첫 번째 행 추출. 부문별 가장 성과 높은 기업을 찾을 때 유용(매출액이 내림차순 정렬되었다면) : GroupBy객체.first()
- 각 그룹의 마지막 행 추출 : GroupBy객체.last()
- 각 그룹의 n번째 행 추출 : GroupBy객체.nth(n)
- 각 그룹에서 n번째까지의 행 가져와 특정 수치형 열 기준으로 내림차순 정렬 : GroupBy객체.head(n)
- 각 그룹에서 마지막에서 n번째까지의 행 가져와 특정 수치형 열 기준으로 내림차순 정렬 : GroupBy객체.tail(n)
- 특정 열에 대해 그룹별로 합계 계산 : GroupBy객체['열이름'].sum()
 
## 10장 병합, 조인, 연결

- csv 파일 불러올 때 특정 열의 데이터형의 변경 : pd.read_csv('파일명', dtype = {'열이름':'데이터형'})
- 두 데이터프레임을 세로로 결합(인덱스 번호는 바뀌지 않아 중복됨) : pd.concat([df변수1, df변수2])
  - ignore_index = True : 원본 인덱스를 버리고 새로운 숫자 인덱스 만듦
  - key = ['인덱스로 사용할 값', '인덱스로 사용할 값'] : 원본 인덱스를 보존하기 위해 왼쪽에 멀티 인덱스 생성
  - axis = 1/'columns' : 가로로 결합
- 두 데이터프레임을 결합할 때 데이터셋이 서로 공유하지 않는 행 레이블과 열 레이블의 교차점에 NaN 입력됨

### 조인

- left join : df변수.merge(df변수, how='left', on='연결할 공통열이름')
  - right_index = True, left_on='왼쪽 열이름' : 왼쪽 df변수의 열과 오른쪽 df변수의 인덱스를 연결할 때 
  - left_index = True, right_on='오른쪽 열이름' : 왼쪽 df변수의 인덱스와 오른쪽 df변수의 열을 연결할 때
- inner join : df변수.merge(df변수, how='inner', on='연결할 공통열이름')
- outer join : df변수.merge(df변수, how='outer')
  - left_on='연결할 왼쪽 df변수 열이름', right_on='연결할 오른쪽 df변수 열이름' : 연결할 공통열이름이 다른 경우
  - indicator = True : 값이 어느 df에 속하는지 표시. _merge 레이블. 값은 양쪽에 포함되면 both, 왼쪽에만 포함되면 left_only, 오른쪽은 right_only

## 11장 날짜, 시간

### 파이썬 datetime 모듈

- import datetime as dt
- dt.date(연, 월, 일) -> datetime.date 객체 반환
- dt.time(시, 분, 초) -> datetime.time 객체 반환. 24시간제. 빈괄호 -> 0시 0분 0초
- dt.datetime(연, 월, 일[, 시, 분, 초])
- dt.timedelta() : 총 시간 반환

### 판다스 Timestamp 객체

- pd.Timestamp(연, 월, 일[, 시, 분, 초])
- 다양한 입력 허용(eg. 문자열): pd.Timestamp('2022-01-31'), pd.Timestamp('2022/01/31'), pd.Timestamp('01/31/2011') 등
- dt.datetime 입력 가능
- DatetimeIndex : Timestamp 객체를 저장하는 인덱스
- 다양한 비교 연산 가능: pd.Timestamp('2022-01-31') < pd.Timestamp('2022-02-31') -> True
- **특정 열을 날짜/시간 유형으로 변환**: df변수['날짜열이름'] = pd.to_datetime(df변수['날짜열이름'])

### DatetimeProperties 객체

- 날짜/시간 시리즈는 DatetimeProperties 객체에 접근할 수 있는 특별한 속성 **dt**를 가짐: df변수['날짜열이름'].dt.day -> 날짜만 표시
- 요일 숫자로 출력: df변수['날짜열이름'].dt.dayofweek -> 0부터 월요일
- 요일 문자로 출력(영문): df변수['날짜열이름'].dt.day_name()
- 월을 문자로 출력(영문): df변수['날짜열이름'].dt.month_name()
- 행의 날짜가 각 분기의 시작일과 같으면 True 반환: df변수['날짜열이름'].dt.is_quarter_start
- 행의 날짜가 각 분기의 마지막 날과 같으면 True 반환: df변수['날짜열이름'].dt.is_quarter_end
- df변수['날짜열이름'].dt.is_month_start, df변수['날짜열이름'].dt.is_month_end, df변수['날짜열이름'].dt.is_year_start, df변수['날짜열이름'].dt_is_year_end

### 일정 시간의 덧셈과 뺄셈 DateOffset

- 날짜에 지정한 날짜/시간만큼 더하기: df변수['날짜열이름'] + pd.DateOffset( years=1, months=3, days=5, hours=6, minutes=3)
- 초, 마이크로초, 나노초도 지원
- 월별로 일수가 다른 경우 동적으로 날짜 덧셈/뺄셈(eg. 다음 달 말일): df변수['날짜열이름'] + pd.offsets.MonthEnd()
- 이전 달 말일로 이동: df변수['날짜열이름'] - pd.offsets.MonthEnd()
- 다음 달의 첫째 날로 이동. df변수['날짜열이름'] + pd.offsets.MonthBegin()
- 이전 달의 첫째 날로 이동. df변수['날짜열이름'] - pd.offsets.MonthBegin(). 주의!! 1일은 이전 달의 1일로 이동
- 비즈니스 관련 날짜: BMonthEnd() 해당 월의 마지막 영업일
- [pd.offsets 모듈 공식문서](https://pandas.pydata.org/docs/reference/offset_frequency.html){target=_blank}

### Timedelta 객체

- 한 Timestamp - 다른 Timestamp -> Timedelta 반환
- pd.Timedelta( days=8, hours=7, minutes=6, seconds=5 )
- pd.to_timedelta('3 hours, 5 minutes, 12 seconds') : 시간을 나타내는 문자열을 인수로 전달
  - unit='hour'/'day'/... : 숫자가 나타내는 시간 단위 정의 pd.to_timedelta(5, unit='hour')
  - pd.to_timedelta([10, 20, 30], unit='day') : 여러 시간차를 인수로 전달
- df변수['날짜열이름'].sort_values(), df변수['날짜열이름'].max(), df변수['날짜열이름'].min(), df변수['날짜열이름'].mean() 
- 1년 넘게 걸린 기간만 필터링 : df변수['Timedelta변수'] > pd.Timedelta(days=365)
- 2000일, 8시간, 4분 보다 오랜 기간 필터링 : df변수['Timedelta변수'] > "2000 days, 8 hours, 4 minutes"
- 각 요일의 날짜를 월요일의 날짜로 변환: bike['날짜열이름'] - pd.to_timedelta(bike['날짜열이름'].dt.day_of_week, unit='day')
  - 요일을 나타내는 숫자(day_of_week)는 월요일(0)로부터 떨어진 일수로 생각할 수 있음. 
  - 따라서 현재 날짜에서 월요일로부터 떨어진 일수를 빼면 월요일 날짜를 구할 수 있다.

## 가져오기, 내보내기

### json

- json 가져오기: pd.read_json('json파일명')
- pd.json_normalize(data=df변수['키'], record_path='하위레코드를 갖는 키', meta=['최상위 키', '최상위 키', ...])
- 키가 없는 딕셔너리가 있는 경우 위 명령에 에러가 발생한다. 그래서 setdefalut()로 키를 설정한 뒤 apply() 이용하여 df에 적용한다.

```python
def add_default_key(entry):
    entry.setdefault('키가 없는 딕셔너리의 상위키', [])

df변수['최상위 키'].apply(add_default_key)
```

- json 내보내기: df변수.to_json('저장할json파일명')
  - orient='records' : 행 순서대로 키(열이름)-값(데이터)으로 구성된 json 배열 반환
  - orient='split' : '컬럼명 키, 인덱스 키, 데이터 값'으로 구성된 json 배열 반환
  - 이 외에도 index, columns, values, table 

### csv

- df변수.to_csv('저장할 파일명', index=False): 쉼표로 셀 구분, 줄바꿈 문자로 행 구분

### excel

- pd.read_excel('파일명', sheet_name=None) : 모든 시트 가져오기


## 14장 시각화

- colormaps 이름 출력: print(plt.colormaps())

## fake 데이터프레임 만들기

```python
import fake
faker = fake.Faker()
data = [
    {'name': fake.name(),
     'company': fake.company(),
     'phone': fake.phone_number(),
     'salary': np.random.randint(50000, 200000)} for _ in range(1000)
]
df = pd.DataFrame(data = data)
```
