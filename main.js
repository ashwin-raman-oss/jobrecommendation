let allJobs = [];

async function loadJobs() {
  try {
    const res = await fetch("jobs.json", { cache: "no-store" });
    allJobs = await res.json();
  } catch (e) {
    allJobs = [];
  }
  renderMeta();
  renderTopFive();
  renderTable();
}

function renderMeta() {
  document.getElementById("job-count").textContent = `${allJobs.length} roles tracked`;
  if (allJobs.length) {
    const latest = allJobs.reduce((a, b) => (new Date(a.fetchedAt) > new Date(b.fetchedAt) ? a : b));
    const d = new Date(latest.fetchedAt);
    document.getElementById("last-fetch").textContent = `Last fetch: ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
}

function renderTopFive() {
  const top = [...allJobs].sort((a, b) => b.score - a.score).slice(0, 5);
  const container = document.getElementById("top-five-list");
  container.innerHTML = "";

  if (!top.length) {
    document.getElementById("empty-state").hidden = false;
    return;
  }

  const maxScore = top[0].score || 1;

  top.forEach((job, i) => {
    const a = document.createElement("a");
    a.className = "ladder-row";
    a.href = job.url || "#";
    a.target = "_blank";
    a.rel = "noopener";
    a.style.setProperty("--fill", `${Math.min(100, (job.score / maxScore) * 100)}%`);
    a.innerHTML = `
      <div class="ladder-rank">${i + 1}</div>
      <div class="ladder-main">
        <div class="ladder-title">${escapeHtml(job.title)} · ${escapeHtml(job.company)}</div>
        <div class="ladder-sub">${escapeHtml(job.location)}${job.remote ? " · Remote" : ""} — ${escapeHtml((job.reasons || []).join(", "))}</div>
      </div>
      <div class="ladder-score">${job.score}</div>
    `;
    container.appendChild(a);
  });
}

function renderTable() {
  const search = document.getElementById("search").value.toLowerCase();
  const sortBy = document.getElementById("sort-by").value;
  const targetOnly = document.getElementById("target-only").checked;

  let jobs = allJobs.filter((j) => {
    const matchesSearch =
      !search ||
      j.title.toLowerCase().includes(search) ||
      j.company.toLowerCase().includes(search);
    const matchesTarget = !targetOnly || (j.reasons || []).some((r) => r.startsWith("Target company"));
    return matchesSearch && matchesTarget;
  });

  jobs.sort((a, b) => {
    if (sortBy === "posted") {
      return new Date(b.posted || b.fetchedAt) - new Date(a.posted || a.fetchedAt);
    }
    return b.score - a.score;
  });

  const tbody = document.getElementById("jobs-tbody");
  tbody.innerHTML = "";
  document.getElementById("empty-state").hidden = allJobs.length > 0;

  jobs.forEach((job) => {
    const tr = document.createElement("tr");
    const posted = job.posted ? new Date(job.posted).toLocaleDateString() : "—";
    tr.innerHTML = `
      <td><span class="score-badge">${job.score}</span></td>
      <td class="job-title">${escapeHtml(job.title)}</td>
      <td>${escapeHtml(job.company)}</td>
      <td>${escapeHtml(job.location)}${job.remote ? " · Remote" : ""}</td>
      <td>${posted}</td>
      <td class="job-reasons">${escapeHtml((job.reasons || []).join(", "))}</td>
      <td>${job.url ? `<a class="apply-link" href="${job.url}" target="_blank" rel="noopener">View →</a>` : ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

document.getElementById("search").addEventListener("input", renderTable);
document.getElementById("sort-by").addEventListener("change", renderTable);
document.getElementById("target-only").addEventListener("change", renderTable);

loadJobs();
