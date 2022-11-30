---
title: "scikit-learn module list" 
date: 2022-11-30
---

```
sklearn
│
├── 01 preprocessing (전처리)
│   │
│   ├── 스케일러
│   │   ├── MinMaxScaler
│   │   ├── RobustScaler
│   │   └── StandardScaler
│   │
│   └── 인코더
│       ├── LabelEncoder
│       └── OneHotEncoder
│
├── 02 model_selection (모델링 전처리)
│   │
│   ├── 데이터셋 분리
│   │   ├── KFold
│   │   ├── StratifiedKFold
│   │   └── train_test_split
│   │
│   └── 하이퍼파라미터 튜닝
│       └── GridSearchCV
│
├── 03 모델학습
│   │
│   ├── ensemble
│   │   ├── AdaBoostClassifier
│   │   ├── GradientBoostingClassifier
│   │   ├── RandomForestClassifier
│   │   └── RandomForestRegressor
│   │
│   ├── linear_model
│   │   ├── LogisticRegression
│   │   └── RidgeClassifier
│   │
│   ├── neighbors
│   │   └── KNeighborsClassifier
│   │
│   ├── svm
│   │   ├── SVC
│   │   └── SVR
│   │
│   └── tree
│       ├── DecisionTreeClassifier
│       ├── DecisionTreeRegressor
│       ├── ExtraTreeClassifier
│       └── ExtraTreeRegressor
│
├── 04 모델평가
│   │
│   ├── metrics
│   │   ├── accuracy_score
│   │   ├── classification_report
│   │   ├── confusion_matrix
│   │   ├── f1_score
│   │   ├── log_loss
│   │   ├── mean_absolute_error
│   │   ├── mean_squared_error
│   │   └── roc_auc_score
│   │
│   └── model (정의된 모델에서 추출)
│       ├── predict
│       └── predict_proba
│
└── 05 최종앙상블
    │
    └── ensemble
        ├── StackingClassifier
        ├── StackingRegressor
        ├── VotingClassifier
        └── VotingRegressor
```

