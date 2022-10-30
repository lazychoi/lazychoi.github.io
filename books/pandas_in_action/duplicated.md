---
title: duplicated()
date: 2022-10-24
---

## 기본 작동

employees.head(10)

||First Name|Gender|Start Date|Salary|Mgmt|Team|
|-|-|-|-|-|-|-|
|0|Douglas|Male|1993-08-06|NaN|True|Marketing|
|1|Thomas|Male|1996-03-31|61933.0|True|NaN|
|2|Maria|Female|NaT|130590.0|False|Finance|
|3|Jerry|NaN|2005-03-04|138705.0|True|Finance|
|4|Larry|Male|1998-01-24|101004.0|True|IT|
|5|Dennis|Male|1987-04-18|115163.0|False|Legal|
|6|Ruby|Female|1987-08-17|65476.0|True|Product|
|7|NaN|Female|2015-07-20|45906.0|NaN|Finance|
|8|Angela|Female|2005-11-22|95570.0|True|Engineering|
|9|Frances|Female|2002-08-08|139852.0|True|Business Dev|

employee['Team'].duplicated().head(10)

```text
0    False
1    False
2    False  <- 처음 나온 중복값은 Fasle
3     True  <- 두번째 나온 중복값부터 True
4    False
5    False
6    False
7     True
8    False
9    False
Name: Team, dtype: bool
```

## keep 매개변수

- 기본값: keep='first' -> 첫 번째로 나타난 중복값은 False로 표시하여 값을 유지(중복되지 않은 것으로 표시)
- keep='last' -> 마지막 중복값을 False로 표시하여 값을 유지(중복되지 않은 것으로 표시)
