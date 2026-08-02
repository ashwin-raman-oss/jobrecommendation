// fetch-jobs.js — pulls fresh PM/Sr PM/GPM listings via JSearch, scores against config.js,
// writes jobs.json (used by index.html dashboard). Designed to run daily via GitHub Actions.

const fs = require("fs");
const path = require("path");
const config = require("./config");

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const JOBS_FILE = path.join(__dirname, "jobs.json");
const MAX_STORED_JOBS = 200;

if (!RAPIDAPI_KEY) {
  console.error("Missing RAPIDAPI_KEY env var. Set it as a GitHub Actions secret.");
  process.exit(1);
}

async function fetchForTitle(title) {
  const params = new URLSearchParams({
    query: `${title} in ${config.location}`,
    date_posted: config.datePosted,
    remote_jobs_only: String(config.remoteJobsOnly),
    num_pages: "1",
    country: "us"
  });

  const res = await fetch(`https://jsearch.p.rapidapi.com/search-v2?${params}`, {
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
    }
  });

  if (!res.ok) {
    console.error(`JSearch request failed for "${title}": ${res.status} ${res.statusText}`);
    return [];
  }

  const data = await res.json();

  if (Array.isArray(data.data)) return data.data;
  if (data.data && Array.isArray(data.data.jobs)) return data.data.jobs;
  if (Array.isArray(data.jobs)) return data.jobs;
  if (Array.isArray(data.results)) return data.results;

  console.error(
    `Unrecognized response shape for "${title}". Top-level keys: ${Object.keys(data).join(", ")}`
  );
  console.error(JSON.stringify(data).slice(0, 500));
  return [];
}

// Fingerprint on title+company+description — the description is included so
// that two DIFFERENT reqs with the same title at the same company (common at
// big companies) are never merged just because the title matches. Only truly
// identical postings (same text, word-for-word) collapse into one multi-city
// listing.
function normalizeDescription(desc) {
  return (desc || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function fingerprint(title, company, descriptionHash) {
  const norm = (s) =>
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return `${norm(title)}|${norm(company)}|${descriptionHash || ""}`;
}

function matchesAllowedPublisher(job) {
  const pub = (job.job_publisher || job.publisher || "").toLowerCase();
  if (!pub) return false;
  return config.allowedPublishers.some((p) => pub.includes(p.toLowerCase()));
}

function isExcludedTitle(title) {
  const t = title.toLowerCase();
  return config.titleExcludes.some((bad) => t.includes(bad.toLowerCase()));
}

function matchesRequiredTitle(title) {
  const t = title.toLowerCase();
  return config.titleMustInclude.some((req) => t.includes(req.toLowerCase()));
}

function locationScore(job) {
  if (job.job_is_remote) {
    return { pts: config.weights.remoteBonus, reason: "Remote" };
  }
  const combined = `${job.job_city || ""} ${job.job_state || ""}`.toLowerCase();
  if (config.locationPriority.primary.some((loc) => combined.includes(loc.toLowerCase()))) {
    return { pts: config.weights.locationPrimary, reason: "Priority location (Chicago/Bay Area)" };
  }
  if (config.locationPriority.secondary.some((loc) => combined.includes(loc.toLowerCase()))) {
    return { pts: config.weights.locationSecondary, reason: "Visibility location" };
  }
  return { pts: 0, reason: null };
}

function scoreJob(job) {
  const title = (job.job_title || "").toLowerCase();
  const company = (job.employer_name || "").toLowerCase();
  const description = (job.job_description || "").toLowerCase();
  const haystack = `${title} ${description}`;

  let score = 0;
  const reasons = [];

  const companyHit = config.targetCompanies.find(
    (c) => company.includes(c.toLowerCase()) || c.toLowerCase().includes(company)
  );
  if (companyHit) {
    score += config.weights.targetCompany;
    reasons.push(`Target company (${companyHit})`);
  }

  if (title.includes("senior") || title.includes("sr.") || title.includes("group")) {
    score += config.weights.seniorOrGroupTitle;
    reasons.push("Senior/Group title");
  }

  const posHits = config.positioningKeywords.filter((k) => haystack.includes(k.toLowerCase()));
  if (posHits.length) {
    const pts = Math.min(posHits.length * config.weights.positioningKeyword, config.weights.positioningKeywordCap);
    score += pts;
    reasons.push(`Positioning fit (${posHits.slice(0, 3).join(", ")})`);
  }

  const aiHits = config.aiKeywords.filter((k) => haystack.includes(k.toLowerCase()));
  if (aiHits.length) {
    const pts = Math.min(aiHits.length * config.weights.aiKeyword, config.weights.aiKeywordCap);
    score += pts;
    reasons.push(`AI signal (${aiHits.slice(0, 3).join(", ")})`);
  }

  const min = job.job_min_salary;
  const max = job.job_max_salary;
  if (min || max) {
    const best = max || min;
    if (best >= config.compFloor) {
      score += config.weights.compFloorMet;
      reasons.push(`Comp disclosed ≥ $${(config.compFloor / 1000).toFixed(0)}K`);
    }
  } else {
    score += config.weights.compUnknown;
  }

  const loc = locationScore(job);
  if (loc.pts) {
    score += loc.pts;
    reasons.push(loc.reason);
  }

  return { score, reasons };
}

function normalizeJob(job, score, reasons) {
  const locations =
    job._locations && job._locations.length
      ? job._locations
      : [
          job.job_city
            ? `${job.job_city}, ${job.job_state || job.job_country}`
            : job.job_country || "Not specified"
        ];
  const location = locations.length > 1 ? `${locations[0]} +${locations.length - 1} more` : locations[0];

  return {
    id: job.job_id,
    fingerprint: fingerprint(job.job_title, job.employer_name, simpleHash(normalizeDescription(job.job_description))),
    title: job.job_title,
    company: job.employer_name,
    location,
    locations,
    remote: !!job.job_is_remote,
    posted: job.job_posted_at_datetime_utc || null,
    salaryMin: job.job_min_salary || null,
    salaryMax: job.job_max_salary || null,
    url: job.job_apply_link || job.job_google_link || "",
    source: job.job_publisher || "Unknown",
    score,
    reasons,
    fetchedAt: new Date().toISOString()
  };
}

async function main() {
  console.log(`Fetching jobs (date_posted=${config.datePosted})...`);

  const allRaw = [];
  for (const title of config.searchTitles) {
    const results = await fetchForTitle(title);
    console.log(`  "${title}": ${results.length} results`);
    allRaw.push(...results);
  }

  const seenIds = new Set();
  const groups = new Map();
  for (const j of allRaw) {
    if (!j.job_id || seenIds.has(j.job_id)) continue;
    seenIds.add(j.job_id);
    const loc = j.job_city
      ? `${j.job_city}, ${j.job_state || j.job_country}`
      : j.job_country || "Not specified";
    const descHash = simpleHash(normalizeDescription(j.job_description));
    const fp = fingerprint(j.job_title, j.employer_name, descHash);
    if (!groups.has(fp)) {
      groups.set(fp, { job: j, locations: new Set([loc]) });
    } else {
      groups.get(fp).locations.add(loc);
    }
  }
  const deduped = [...groups.values()].map(({ job, locations }) => ({
    ...job,
    _locations: [...locations]
  }));

  const publisherCounts = {};
  deduped.forEach((j) => {
    const p = j.job_publisher || j.publisher || "(unknown)";
    publisherCounts[p] = (publisherCounts[p] || 0) + 1;
  });
  console.log("Publisher distribution:", JSON.stringify(publisherCounts));

  const filtered = deduped.filter(
    (j) =>
      j.job_title &&
      !isExcludedTitle(j.job_title) &&
      matchesRequiredTitle(j.job_title) &&
      matchesAllowedPublisher(j)
  );

  const scored = filtered.map((j) => {
    const { score, reasons } = scoreJob(j);
    return normalizeJob(j, score, reasons);
  });

  let existing = [];
  if (fs.existsSync(JOBS_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(JOBS_FILE, "utf8"));
    } catch (e) {
      console.warn("Could not parse existing jobs.json, starting fresh.");
    }
  }

  const existingIds = new Set(existing.map((j) => j.id));

  const cutoff = Date.now() - config.repostSuppressDays * 24 * 60 * 60 * 1000;
  const recentFingerprints = new Set(
    existing.filter((j) => new Date(j.fetchedAt).getTime() >= cutoff).map((j) => j.fingerprint)
  );

  let repostCount = 0;
  const newOnes = scored.filter((j) => {
    if (existingIds.has(j.id)) return false;
    if (recentFingerprints.has(j.fingerprint)) {
      repostCount++;
      return false;
    }
    return true;
  });

  const merged = [...newOnes, ...existing]
    .sort((a, b) => new Date(b.fetchedAt) - new Date(a.fetchedAt))
    .slice(0, MAX_STORED_JOBS);

  fs.writeFileSync(JOBS_FILE, JSON.stringify(merged, null, 2));
  console.log(
    `Wrote ${merged.length} jobs (${newOnes.length} new, ${repostCount} reposts suppressed) to jobs.json`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
