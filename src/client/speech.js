/** Short, quiet lines the pet says on state changes. */
export const SPEECH = {
  idle: ['ふわぁ…', 'ひまだね', 'お米たべたい', 'のんびり～', 'なにかする？'],
  think: ['うーん…', '考え中…', 'むむむ', 'ちょっと待ってね', 'あたまつかう…'],
  longThink: ['おそい…', 'まだかな…', 'ねちゃいそう…'],
  work: ['がんばれ～', '見てるよ', 'おしごと中…', 'えらいえらい'],
  sleep: ['すぅ…', 'Zzz…', 'おやすみ…'],
  wake: ['ふぁ…', 'おはよう', 'ねむい…', 'おきたよ'],
  pet: ['えへへ', 'なでなで？', 'うれしい', 'もっと？'],
  happy: ['えへへ', 'やったね', 'いいかんじ'],
};

/** Pick one line without throwing on an empty/missing pool. */
export function pickLine(pool) {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
