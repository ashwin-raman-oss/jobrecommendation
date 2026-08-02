// similarity.js — compares your resume text against a job description using
// term-frequency cosine similarity. No API, no model download, no network
// call of any kind — pure JavaScript, runs instantly, always available.
//
// This is a real step up from substring keyword matching: instead of asking
// "does this exact phrase appear," it compares the full vocabulary overlap
// and relative emphasis between your actual experience and the job
// description, the way classic search-engine relevance scoring works.

const STOPWORDS = new Set([
  "the", "and", "a", "an", "to", "of", "in", "for", "on", "with", "is", "are",
  "this", "that", "you", "your", "we", "will", "as", "by", "or", "be", "at",
  "our", "from", "have", "has", "it", "its", "their", "they", "them", "who",
  "what", "which", "not", "but", "if", "can", "all", "also", "more", "other",
  "such", "into", "about", "across", "using", "use", "used", "including",
  "job", "role", "team", "work", "company", "years", "experience", "including"
]);

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function termFreqVector(tokens) {
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
  return freq;
}

function cosineSimilarity(vecA, vecB) {
  const keys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  let dot = 0,
    magA = 0,
    magB = 0;
  for (const k of keys) {
    const a = vecA[k] || 0;
    const b = vecB[k] || 0;
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function similarity(textA, textB) {
  const vecA = termFreqVector(tokenize(textA));
  const vecB = termFreqVector(tokenize(textB));
  return cosineSimilarity(vecA, vecB);
}

module.exports = { tokenize, termFreqVector, cosineSimilarity, similarity };
