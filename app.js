const CHAMPIONS_ID = "1253490267638464512";
const DEVELOPMENT_ID = "1253490390737100800";

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("subtab-btn")) {
    const parent = e.target.closest(".tab");
    parent.querySelectorAll(".subtab-btn").forEach(b => b.classList.remove("active"));
    parent.querySelectorAll(".subtab").forEach(s => s.classList.remove("active"));
    e.target.classList.add("active");
    parent.querySelector("#" + e.target.dataset.subtab).classList.add("active");
  }
});

async function fetchJSON(url){
  try{
    const res = await fetch(url);
    if(!res.ok) throw new Error(`Request failed: ${res.status}`);
    return await res.json();
  }catch(err){
    console.error(url, err);
    return null;
  }
}

function fmtNum(val){
  const n = Number(val || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function teamNameForRoster(roster, users){
  const owner = users.find(u => u.user_id === roster.owner_id);
  if (!owner) return `Roster ${roster.roster_id}`;
  return owner.metadata?.team_name || owner.display_name || `Roster ${roster.roster_id}`;
}

async function getCurrentWeek(){
  const state = await fetchJSON("https://api.sleeper.app/v1/state/nfl");
  return state?.week ?? null;
}

async function getMostRecentWeekWithMatchups(leagueId){
  let currentWeek = await getCurrentWeek();
  if (!currentWeek) currentWeek = 18;
  for(let week = currentWeek; week >= 1; week--){
    const matchups = await fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
    if (Array.isArray(matchups) && matchups.length) return { week, matchups };
  }
  return { week:null, matchups:[] };
}

function buildStandingsTable(rosters, users, leagueType){
  const sorted = [...rosters].sort((a,b) => {
    const winDiff = (b.settings?.wins || 0) - (a.settings?.wins || 0);
    if (winDiff !== 0) return winDiff;
    return (b.settings?.fpts || 0) - (a.settings?.fpts || 0);
  });

  const rows = sorted.map((roster, idx) => {
    const rank = idx + 1;
    const name = teamNameForRoster(roster, users);
    const wins = roster.settings?.wins || 0;
    const losses = roster.settings?.losses || 0;
    const pf = fmtNum(roster.settings?.fpts);
    const pa = fmtNum(roster.settings?.fpts_against);
    const danger = leagueType === "champions" && rank >= 9;
    const promoted = leagueType === "development" && rank <= 2;
    return `
      <tr class="${danger ? "relegation" : promoted ? "promotion" : ""}">
        <td>${rank}</td>
        <td>${name}</td>
        <td>${wins}-${losses}</td>
        <td>${pf}</td>
        <td>${pa}</td>
        <td>${danger ? '<span class="relegation-tag">Relegation Risk</span>' : promoted ? '<span class="promotion-tag">Promotion Position</span>' : ""}</td>
      </tr>`;
  }).join("");

  return `<table class="standings-table">
    <thead><tr><th>Rank</th><th>Team</th><th>Record</th><th>PF</th><th>PA</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderTransactions(targetId, txs, users, rosters){
  const el = document.getElementById(targetId);
  if (!Array.isArray(txs) || !txs.length){
    el.innerHTML = "<p>No transactions found for this season.</p>";
    return;
  }

  const rosterMap = new Map(rosters.map(r => [String(r.roster_id), teamNameForRoster(r, users)]));
  const items = txs.map(tx => {
    const involvedIds = [...new Set([...(tx.consenter_ids || []), ...(tx.roster_ids || [])])];
    const teams = involvedIds.map(id => rosterMap.get(String(id)) || `Roster ${id}`).join(", ") || "League";
    const type = (tx.type || "transaction").toUpperCase();
    const when = tx.created ? new Date(tx.created).toLocaleString() : "Unknown date";
    const week = tx.week ? `<span class="tx-week">Week ${tx.week}</span>` : "";
    return `<div class="tx-item"><div><strong>${type}</strong>${week}</div><div>${teams}</div><div class="tx-meta">${when}</div></div>`;
  }).join("");
  el.innerHTML = items;
}

async function loadAllTransactionsForSeason(leagueId){
  let all = [];
  for (let week = 1; week <= 18; week++){
    const weekTx = await fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`);
    if (Array.isArray(weekTx) && weekTx.length){
      const filtered = weekTx.filter(tx => ["complete", "processed", "successful", undefined, null].includes(tx.status));
      all = all.concat(filtered);
    }
  }
  all.sort((a,b) => (b.created || 0) - (a.created || 0));
  return all;
}

async function loadLeagueView(leagueId, standingsTarget, txTarget, leagueType){
  const [rosters, users, txs] = await Promise.all([
    fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
    fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/users`),
    loadAllTransactionsForSeason(leagueId)
  ]);

  if (Array.isArray(rosters) && Array.isArray(users)){
    document.getElementById(standingsTarget).innerHTML = buildStandingsTable(rosters, users, leagueType);
  } else {
    document.getElementById(standingsTarget).innerHTML = "<p>Unable to load standings right now.</p>";
  }

  renderTransactions(txTarget, txs || [], users || [], rosters || []);
  return { rosters: rosters || [], users: users || [] };
}

function groupMatchupsById(matchups){
  const map = new Map();
  for (const m of matchups){
    const key = m.matchup_id ?? `solo-${m.roster_id}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  }
  return [...map.values()];
}

function renderMatchups(matchups, rosters, users, week){
  const rosterMap = new Map(rosters.map(r => [r.roster_id, r]));
  const grouped = groupMatchupsById(matchups);
  const html = grouped.map(group => {
    const a = group[0], b = group[1];
    const aName = rosterMap.get(a.roster_id) ? teamNameForRoster(rosterMap.get(a.roster_id), users) : `Roster ${a.roster_id}`;
    const bName = b && rosterMap.get(b.roster_id) ? teamNameForRoster(rosterMap.get(b.roster_id), users) : (b ? `Roster ${b.roster_id}` : "Bye / TBD");
    return `<div class="score-row">
      <div><div><strong>${aName}</strong> vs <strong>${bName}</strong></div><div class="score-meta">Most recent available results · Week ${week}</div></div>
      <div class="score-points">${fmtNum(a.points)} - ${fmtNum(b?.points)}</div>
    </div>`;
  }).join("");
  document.getElementById("matchups").innerHTML = html || "<p>No matchup data available.</p>";
}

async function fetchLeagueChain(startLeagueId){
  const seasons = [];
  let currentId = startLeagueId;
  let safety = 0;
  while(currentId && safety < 8){
    const league = await fetchJSON(`https://api.sleeper.app/v1/league/${currentId}`);
    if (!league) break;
    seasons.push(league);
    currentId = league.previous_league_id || null;
    safety++;
  }
  return seasons;
}

function inferTopFinisher(rosters, users){
  if (!Array.isArray(rosters) || !rosters.length) return "Not available";
  const sorted = [...rosters].sort((a,b) => {
    const winDiff = (b.settings?.wins || 0) - (a.settings?.wins || 0);
    if (winDiff !== 0) return winDiff;
    return (b.settings?.fpts || 0) - (a.settings?.fpts || 0);
  });
  return teamNameForRoster(sorted[0], users);
}

async function buildSeasonSummary(league){
  const [rosters, users] = await Promise.all([
    fetchJSON(`https://api.sleeper.app/v1/league/${league.league_id}/rosters`),
    fetchJSON(`https://api.sleeper.app/v1/league/${league.league_id}/users`)
  ]);
  return { name: league.name || "League", topFinisher: inferTopFinisher(rosters, users) };
}

async function loadHistory(){
  const target = document.getElementById("historyContent");
  const [championsChain, developmentChain] = await Promise.all([
    fetchLeagueChain(CHAMPIONS_ID),
    fetchLeagueChain(DEVELOPMENT_ID)
  ]);

  const seasonMap = {};
  for (const lg of championsChain){
    if (Number(lg.season) >= 2023){
      seasonMap[lg.season] ||= {};
      seasonMap[lg.season].championsLeague = lg;
    }
  }
  for (const lg of developmentChain){
    if (Number(lg.season) >= 2023){
      seasonMap[lg.season] ||= {};
      seasonMap[lg.season].developmentLeague = lg;
    }
  }

  const seasons = Object.keys(seasonMap).sort((a,b) => Number(b) - Number(a));
  if (!seasons.length){
    target.innerHTML = "<p>History is not available yet.</p>";
    return;
  }

  const cards = [];
  for (const season of seasons){
    const c = seasonMap[season].championsLeague;
    const d = seasonMap[season].developmentLeague;
    const [cSum, dSum] = await Promise.all([
      c ? buildSeasonSummary(c) : null,
      d ? buildSeasonSummary(d) : null
    ]);

    cards.push(`<div class="history-season">
      <h3>${season}</h3>
      <div class="history-chip">Champions League</div>
      <p><strong>League Name:</strong> ${cSum ? cSum.name : "Not found"}</p>
      <p><strong>Top Finisher:</strong> ${cSum ? cSum.topFinisher : "Not available"}</p>
      <div class="history-chip">Development League</div>
      <p><strong>League Name:</strong> ${dSum ? dSum.name : "Not found"}</p>
      <p><strong>Top Finisher:</strong> ${dSum ? dSum.topFinisher : "Not available"}</p>
    </div>`);
  }

  target.innerHTML = `<div class="history-grid">${cards.join("")}</div>`;
}

async function loadTournament(){
  const target = document.getElementById("tournamentBracket");
  const data = await fetchJSON("./tournament.json");
  if (!data || !Array.isArray(data.rounds)){
    target.innerHTML = "<p>Tournament bracket file not found.</p>";
    return;
  }
  target.innerHTML = data.rounds.map(round => `<div class="bracket-round"><h3>${round.name}</h3>${
    round.matches.map(match => `<div class="bracket-match"><div><strong>${match.team1}</strong> vs <strong>${match.team2}</strong></div><div class="score-meta">${match.note || ""}</div></div>`).join("")
  }</div>`).join("");
}

async function init(){
  const status = document.getElementById("status");
  status.textContent = "Loading Sleeper data…";

  const [champView] = await Promise.all([
    loadLeagueView(CHAMPIONS_ID, "championsStandings", "championsTransactions", "champions"),
    loadLeagueView(DEVELOPMENT_ID, "developmentStandings", "developmentTransactions", "development")
  ]);

  const recent = await getMostRecentWeekWithMatchups(CHAMPIONS_ID);
  if (recent.week && recent.matchups.length){
    renderMatchups(recent.matchups, champView.rosters, champView.users, recent.week);
    status.textContent = `Showing most recent available Sleeper results · Week ${recent.week}`;
  } else {
    document.getElementById("matchups").innerHTML = "<p>No recent matchup data available.</p>";
    status.textContent = "Unable to find recent matchup data.";
  }

  await Promise.all([loadHistory(), loadTournament()]);
}

init();
