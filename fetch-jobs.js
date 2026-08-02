// fetch-jobs.js — pulls fresh PM/Sr PM/GPM listings via JSearch, scores against config.js,
// writes jobs.json (used by index.html dashboard). Designed to run daily via GitHub Actions.

const fs = require("fs");
const path = require("path");
const config = require("./config");

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const JOBS_FILE = path.join(__dirname, "jobs.json");
const MAX_STORED_JOBS = 200; // rolling window so the file doesn't grow forever

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

// JSearch sometimes assigns a NEW job_id to what is really the same req reposted
// (companies do this to bump visibility). A fingerprint on title+company+location
// catches that even when the id changes.
function fingerprint(title, company, location) {
  const norm = (s) =>
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return `${norm(title)}|${norm(company)}|${norm(location)}`;
}

function isExcludedTitle(title) {
  const t = title.toLowerCase();
  return config.titleExcludes.some((bad) => t.includes(bad.toLowerCase()));
}

function matchesRequiredTitle(title) {
  const t = title.toLowerCase();
  return config.titleMustInclude.some((req) => t.includes(req.toLowerCase()));
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

  return { score, reasons };
}

function normalizeJob(job, score, reasons) {
  const location = job.job_city
    ? `${job.job_city}, ${job.job_state || job.job_country}`
    : job.job_country || "Not specified";

  return {
    id: job.job_id,
    fingerprint: fingerprint(job.job_title, job.employer_name, location),
    title: job.job_title,
    company: job.employer_name,
    location,
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
  const seenFingerprints = new Set();
  const deduped = allRaw.filter((j) => {
    if (!j.job_id || seenIds.has(j.job_id)) return false;
    const loc = j.job_city
      ? `${j.job_city}, ${j.job_state || j.job_country}`
      : j.job_country || "";
    const fp = fingerprint(j.job_title, j.employer_name, loc);
    if (seenFingerprints.has(fp)) return false;
    seenIds.add(j.job_id);
    seenFingerprints.add(fp);
    return true;
  });

  const filtered = deduped.filter(
    (j) => j.job_title && !isExcludedTitle(j.job_title) && matchesRequiredTitle(j.job_title)
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
