from konlpy.tag import Mecab
tokenizer = Mecab()
print(tokenizer.morphs('자연어 처리 공부는 재미가 있어요'))
