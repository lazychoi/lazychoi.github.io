---
title: "한국어 임베딩(이기창)"
date: 2022/11/19
date-modified: last-modified
format: 
  html:
    code-fold: true
---

## 용어

- 임베딩(embedding): 사람이 쓰는 자연어를 기계가 이해할 수 있는 숫자의 나열인 벡터로 바꾼 결과 혹은 그 일련의 과정 전체를 의미한다. 단어나 문장 각각을 벡터로 변환해 벡터 공간으로 '끼워 넣는다(embed)'는 의미에서 임베딩이라는 이름이 붙었다.
- 단어-문서 행렬(Term-Document Matrix): 문서에 나타난 단어의 빈도표. 행은 단어, 열은 문서로 이루어져 있다.
- Word2Vec: 2013년 구글 연구 팀이 발표한 단어 벡터화 기법
- 단어 유추 평가(word analogy test): 단어 임베딩을 평가하는 방법
- 전이 학습(transfer learning): 임베딩을 다른 딥러닝 모델의 입력값으로 쓰는 기법
- FastText 임베딩(100차원): Word2Vec의 개선된 버전이며 59만 건에 이르는 한국어 문서를 미리 학습함
- 잠재 의미 분석(Latent Semantic Analysis): 단어 사용 빈도 등 말뭉치의 통계량 정보가 들어 있는 커다란 행렬에 특이값 분해(Singular Value Decomposition) 등 수학적 기법을 적용해 행렬에 속한 벡터들의 차원을 축소하는 방법을 말한다.
- 엔드투엔드 모델(end-to-end model): 데이터를 통째로 모델에 넣고 입출력 사이의 관계를 사람의 개입 없이 모델 스스로 처음부터 끝가지 이해하도록 유도하는 것. eg. 시퀀스투시퀀스(sequence-to-sequence)
- 문장 수준 임베딩 기법: 개별 단어가 아닌 단어 시퀀스(sequence) 전체의 문맥적 의미를 함축하는 기법이다. 단어 임베딩 기법보다 전이 학습 효과가 좋은 것으로 알려져 있다. eg. ELMo(Embedding from Language Models), BERT(Bidirectional Encoder Representations from Transformer), GPT(Generative Pre-Training)
- 프리트레인(pretrain): 대규모 말뭉치로 임베딩을 만든다. 이 임베딩에는 말뭉치의 의미적, 문법적 맥락이 포함돼 있다.
- 파인 튜닝(fine tuning): 프리트레인으로 만든 임베딩을 입력으로 하는 새로운 딥러닝 모델을 만들고 우리가 풀고 싶은 구체적 문제에 맞는 소규모 데이터에 맞게 임베딩을 포함한 모델 전체를 업데이트한다.
- 다운스트림 태스크(downstream task): 풀고 싶은 자연어 처리의 구체적 문제들을 이르는 말. eg. 품사 판별, 개체명 인식, 의미역 분석 등
- 업스트림 태스크(upstream task): 다운스트림 태스크에 앞서 해결해야 할 과제. eg. 단어/문장 임베딩을 프리트레인하는 작업
- 행렬 분해(factorization) 기반 방법: 말뭉치 정보가 들어 있는 원래 행렬을 두 개 이상의 작은 행렬로 쪼개는 방식의 임베딩 기법을 가리킨다. eg. GloVe, Swivel
- 예측 기반 방법: 어떤 단어 주변에 특정 단어가 나타날지 예측하거나, 이전 단어가 주어졌을 때 다음 단어가 뭐가 될지 예측하거나, 문장 내 일부 단어를 지우고 해당 단어가 무엇일지 맞추는 과정에서 학습하는 방법이다. eg. Word2Vec, FastText, BERT, ELMo, GPT
- 토픽 기반 방법: 주어진 문서에 잠재된 주제를 추론하는 방식으로 임베딩을 수행하는 기법. eg. 잠재 디리클레 할당(Latent Dirichlet Allocation)
- 말뭉치(corpus): 임베딩 학습이라는 특정한 목적을 가지고 수집한 표본
- 컬렉션(collection): 말뭉치에 속한 각각의 집합
- 문서(document): 생각이나 감정, 정보를 공유하는 문장 집합
- 어휘 집합(vocabulary): 말뭉치에 있는 모든 문서를 문장으로 나누고 여기에 토크나이즈를 실시한 후 중복을 제거한 토큰들의 집합
- 미등록 단어(unknown word): 어휘 집합에 없는 토큰
- 백(bag): 중복 원소를 허용한 집합(multiset)
- 백오브워즈(bag of words): 단어의 등장 순서에 관계없이 문서 내 단어의 등장 빈도를 임베딩으로 쓰는 기법
- TF-IDF(Term Frequency-Inverse Document Frequency): TF(특정 문서에서의 특정 단어 사용 빈도), DF(특정 단어가 나타난 문서의 수)가 클수록 다수 문서에서 쓰이는 범용적인 단어라 볼 수 있다. IDF(Inverse Document Frequency)는 전체 문서 수(N)를 해당 단어의 DF로 나눈 뒤 로그를 취한 값이다. 값이 클수록 특이한 단어다. 
- 언어 모델(language model): 단어 시퀀스에 확률을 부여하는 모델
- n-gram: n개의 단어를 뜻하는 용어
- 백오프(back-off): n-gram 등장 빈도를 n보다 작은 범위의 단어 시퀀스 빈도로 근사하는 방식
- 스무딩(smoothing): 같은 등장 빈도 표에 모두 k만큼 더하는 기법. 스무딩을 시행하면 높은 빈도를 가진 문자열 등장 확률을 일부 깍고 학습 데이터에 전혀 등장하지 않는 케이스들에는 작으나마 일부 확률을 부여하게 된다.
- 라플라스 스무딩(laplace smoothing): k를 1로 설정한 스무딩
- 분포(distribution): 특정 범위, 즉 윈도우(window) 내에 동시에 등장하는 이웃 단어 또는 문맥의 집합
- 형태소(morpheme): 의미를 가지는 최소 단위
- 계열 관계(paradigmatic relation): 해당 형태소 자리에 다른 형태소가 '대치'돼 쓰일 수 있는가를 따지는 것. 언어학자들이 계열 관계를 바탕으로 형태소를 분석한다.
- PMI(Pointwise Mutual Information, 점별 상호 정보량): 두 단어의 등장이 독립일 때 대비해 얼마나 자주 같이 등장하는지를 수치화한 것. 두 확률변수 사이의 상관성을 계량화하는 단위. 두 확률변수가 완전 독립인 경우 그 값이 0이 된다. 반대로 단어 A가 등장할 때 단어 B와 자주 같이 나타나면 PMI 값은 커진다

													   
## 임베딩의 역할

- 단어/문장 간 관련도 계산: 단어를 벡터로 임베딩하는 순간 단어 벡터들 사이의 유사도(similarity)를 계산하는 일이 가능해진다.
- 의미적/문법적 정보 함축: 단어 벡터 간 덧셈/뺄셈을 통해 단어들 사이의 의미적, 문법적 관계를 토출해낼 수 있다. 
- 전이 학습


## Neural Probabilistic Language Model

이전 단어가 주어졌을 때 다음 단어가 뭐가 될지 예측하거나, 문장 내 일부분에 구멍을 뚫어 놓고(masking) 해당 단어가 무엇일지 맞추는 과정에서 학습된다.

## 2장 벡터가 어떻게 의미를 가지는가

### 임베딩을 만드는 세 가지 철학

| 구분 | 백오브워즈(bag of words) 가정 | 언어 모델(language model) | 분포 가정(distributional hypothesis) |
|-|-|-|-|
| 내용 | 어떤 단어가 (많이) 쓰였는가 | 단어가 어떤 순서로 쓰였는가 | 어떤 단어가 같이 쓰였는가 |
| 대표 통계량 | TF-IDF | - | PMI |
| 대표 모델 | Deep Averaging Network | ELMo, GPT | Word2Vec |


