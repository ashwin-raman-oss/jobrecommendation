// config.js — Ashwin Raman's job search profile
// Edit this file to tune what "top match" means. No code changes needed elsewhere.

module.exports = {
  searchTitles: [
    "Product Manager",
    "Senior Product Manager",
    "Group Product Manager"
  ],

  datePosted: "today", // JSearch options: "today" | "3days" | "week" | "month"

  repostSuppressDays: 21,

  location: "United States",
  remoteJobsOnly: false,

  titleExcludes: [
    "director", "vp", "vice president", "head of", "chief",
    "intern", "associate product manager i", "entry level"
  ],

  titleMustInclude: ["product manager"],

  // Only keep results sourced from these sites (case-insensitive substring
  // match against JSearch's job_publisher field). Everything else gets dropped
  // after fetch — JSearch aggregates broadly and doesn't offer a clean
  // request-time filter for this.
  allowedPublishers: ["linkedin", "indeed", "built in"],

  targetCompanies: [
    "Google", "Google Cloud", "Uber", "Airbnb", "Salesforce", "Atlassian",
    "Intuit", "ServiceNow", "Microsoft", "Amazon", "OpenAI", "Anthropic",
    "Stripe", "Meta", "Netflix", "Databricks", "Snowflake", "Rippling",
    "Ramp", "Brex"
  ],

  positioningKeywords: [
    "marketplace", "platform", "B2B", "operations", "vendor", "supply",
    "two-sided", "network", "workflow automation", "SaaS", "enterprise"
  ],

  aiKeywords: [
    "AI", "LLM", "GenAI", "machine learning", "ML", "GPT", "agent", "RAG"
  ],

  compFloor: 175000,

  // Semantic resume-fit scoring — compares each job description against your
  // actual resume text (profile.js) using word-overlap cosine similarity, not
  // just fixed keywords. Calibrated against sample postings: a strong
  // marketplace/ops match scores ~0.32, an unrelated role scores ~0.08.
  semanticFit: {
    minSimilarity: 0.08,
    maxSimilarity: 0.32
  },

  // Location priority. "primary" and "remote" get the biggest boost; "secondary"
  // markets stay visible but rank lower. Target company match (below) already
  // outweighs location, so a dream company in an unlisted city still surfaces.
  locationPriority: {
    primary: [
      "Chicago", "San Francisco", "Oakland", "San Jose", "Palo Alto",
      "Mountain View", "Berkeley", "Sunnyvale", "Redwood City", "South San Francisco",
      "Menlo Park", "Emeryville"
    ],
    secondary: ["New York", "Brooklyn", "Austin", "Seattle"]
  },

  weights: {
    targetCompany: 40,
    seniorOrGroupTitle: 15,
    positioningKeyword: 5,
    positioningKeywordCap: 15,
    aiKeyword: 5,
    aiKeywordCap: 15,
    compFloorMet: 15,
    compUnknown: 5,
    remoteBonus: 12,
    locationPrimary: 12,
    locationSecondary: 6,
    locationPenalty: -25,   // outside every preferred market and not remote (waived for target companies)
    semanticFitMax: 25      // max points from resume-vs-JD similarity
  }
};
