// config.js — Ashwin Raman's job search profile
// Edit this file to tune what "top match" means. No code changes needed elsewhere.

module.exports = {
  // Search terms sent to JSearch (one query per title bucket, results merged + deduped)
  searchTitles: [
    "Product Manager",
    "Senior Product Manager",
    "Group Product Manager"
  ],

  // Only fetch postings from the last N days. Keep this tight (1-3) for a genuinely fresh daily pull.
  datePosted: "today", // JSearch options: "today" | "3days" | "week" | "month"

  // If the same title+company+location shows up again within this many days
  // (even under a new job_id), treat it as a repost and suppress it rather
  // than surfacing it as a "new" match.
  repostSuppressDays: 21,

  location: "United States",
  remoteJobsOnly: false, // you're open to relocation, not just remote

  // Titles to hard-exclude regardless of score (case-insensitive substring match)
  titleExcludes: [
    "director", "vp", "vice president", "head of", "chief",
    "intern", "associate product manager i", "entry level"
  ],

  // Companies you're explicitly targeting — highest scoring weight
  targetCompanies: [
    "Google", "Google Cloud", "Uber", "Airbnb", "Salesforce", "Atlassian",
    "Intuit", "ServiceNow", "Microsoft", "Amazon", "OpenAI", "Anthropic",
    "Stripe", "Meta", "Netflix", "Databricks", "Snowflake", "Rippling",
    "Ramp", "Brex"
  ],

  // Signals that a role fits your B2B / marketplace / platform positioning
  positioningKeywords: [
    "marketplace", "platform", "B2B", "operations", "vendor", "supply",
    "two-sided", "network", "workflow automation", "SaaS", "enterprise"
  ],

  // AI/LLM signal — you're actively positioning toward AI-forward PM roles
  aiKeywords: [
    "AI", "LLM", "GenAI", "machine learning", "ML", "GPT", "agent", "RAG"
  ],

  // Comp floor. JSearch often doesn't disclose salary — treat "unknown" as neutral, not negative.
  compFloor: 200000,

  // Scoring weights — tune freely
  weights: {
    targetCompany: 40,      // exact/fuzzy match against targetCompanies
    seniorOrGroupTitle: 15, // "Senior" or "Group" in title
    positioningKeyword: 5,  // per keyword matched, capped
    positioningKeywordCap: 15,
    aiKeyword: 5,           // per keyword matched, capped
    aiKeywordCap: 15,
    compFloorMet: 15,       // salary disclosed and >= compFloor
    compUnknown: 5          // salary not disclosed — small neutral credit, not a penalty
  }
};
