#### mp3 파일 인코딩 시 주의사항

- VBR은 모바일에서 재생하거나 구간반복할 때 싱크가 맞지 않는 문제 발생 → **CBR(Constant Bit Rate)**로 인코딩한다.
- 오디오북은 Mono, 16000Hz, 96Kbps로 해도 충분하다.

#### 그리스 신화 출처

- https://www.theoi.com/

### API prompt

You are an expert bilingual English-Korean lexicographer and language tutor.
Target phrase: "Phobos"
Source Book & Author: Andy Weir, <The Martian>
Previous sentence (context): "It isn't the most accurate compass in the world, but it works."
Target sentence: "I navigate by Phobos."
Next sentence (context): "It whips around Mars so fast it actually laps the planet twice a day, running west to east."

Analyze the target phrase in the exact context of the provided sentence, taking into account the surrounding context (previous/next sentences) and source book information, following these strict rules:

1. [Meaning (targetMeaning)]:
   - Prioritize the accurate, primary literal meaning (직역) so the learner understands the word's fundamental definition in this context.
   - Do NOT produce vague or overly interpretive paraphrases on their own.
   - Always base the meaning strictly on the literal meaning (직역 위주). If the literal meaning alone is awkward, unnatural, or insufficient to capture the contextual nuance in this passage, provide the literal meaning first, followed by the contextual interpretation/paraphrase in parentheses using the format: "직역 (문맥: 의역)".
     * Example (literal is sufficient): "금박을 입힌"
     * Example (needs contextual nuance): "달을 달라고 울다 (문맥: 불가능한 것을 조르다)"
     * Example (metaphorical): "수면을 스치다 (문맥: 구애하다)"

2. [Pronunciation (phonetic)]:
   - If the target word is difficult, advanced (CEFR B2+), uncommon, or phonetically tricky/irregular, provide its International Phonetic Alphabet (IPA) transcription enclosed in slashes (e.g. "/ˈɡɪldɪd/", "/ˌpɪnəˈfɔːr/").
   - If it is a common/elementary word (e.g. "happy", "crying", "river") or a multi-word phrase composed of basic words, return an empty string ("").

3. [Sentence Translation (sentenceTranslation)]:
   - Provide a fluent, natural Korean translation of the target sentence that faithfully reflects the surrounding context and tone of the book.

Return ONLY a valid JSON object matching this schema without markdown fences:
{
  "phonetic": "IPA transcription for difficult/advanced words, or empty string",
  "targetMeaning": "Korean literal meaning first. If awkward, format as: 직역 (문맥: 의역)",
  "sentenceTranslation": "fluent Korean translation of the target sentence"
}

### 영어암기앱 역할극에서 사용자 말하기 시간 조정

// ── 사용자 발화 시간 배율 설정 (말하기 시간 조절) ──
// 실제 원어민 문장 길이 대비 몇 배의 시간을 제공할지 설정합니다.
// - 2.0 : 실제 문장 길이의 2배 (기본값: 초보자/학습자가 여유있게 말하기)
// - 1.0 : 실제 문장 길이와 동일 (나중에 실력이 늘어 원어민 속도로 연습할 때 이 값을 1.0으로 변경)
const USER_SPEAKING_DURATION_RATIO = 2.0; // 👈 나중에 이 숫자를 1.0 으로 변경하시면 됩니다!