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

function addDiag(message, ok=true){
  const list = document.getElementById("diagnosticsList");
  const li = document.createElement("li");
  li.innerHTML = `${message} <span class="diag-tag ${ok ? "diag-ok" : "diag-bad"}">${ok ? "OK" : "FAIL"}</span>`;
  list.appendChild(li);
  if (list.children.length > 8) list.removeChild(list.firstChild);
}

async function fetchJSON(url, label="request"){
  try{
    const res = await fetch(url);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    addDiag(label, true);
    return data;
  }catch(err){
    console.error(url, err);
    addDiag(`${label}: ${err.message}`, false);
    return null;
  }
}

function setError(targetId, message){
  document.getElementById(targetId).innerHTML = `<div class="error-box">${message}</div>`;
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
  const state = await fetchJSON("https://api.sleeper.app/v1/state/nfl", "NFL state");
  return state?.week ?? null;
}

async function getMostRecentWeekWithMatchups(leagueId){
  let currentWeek = await getCurrentWeek();
  if (!currentWeek) currentWeek = 18;
  for(let week = currentWeek; week >= 1; week--){
    const matchups = await fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`, `Matchups week ${week}`);
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
  if (!Array.isArray(txs) || !txs.length){
    document.getElementById(targetId).innerHTML = "<p>No transactions found for this season.</p>";
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
  document.getElementById(targetId).innerHTML = items;
}

async function loadAllTransactionsForSeason(leagueId){
  let all = [];
  for (let week = 1; week <= 18; week++){
    const weekTx = await fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`, `Transactions week ${week}`);
    if (Array.isArray(weekTx) && weekTx.length){
      const filtered = weekTx.filter(tx => ["complete", "processed", "successful", undefined, null].includes(tx.status));
      all = all.concat(filtered);
    }
  }
  all.sort((a,b) => (b.created || 0) - (a.created || 0));
  return all;
}

async function loadLeagueView(leagueId, standingsTarget, txTarget, leagueType, label){
  const league = await fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}`, `${label} league`);
  if (!league) {
    setError(standingsTarget, `${label} league info failed to load.`);
    setError(txTarget, `${label} transactions failed to load.`);
    return { rosters: [], users: [], league: null };
  }

  const [rosters, users, txs] = await Promise.all([
    fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/rosters`, `${label} rosters`),
    fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/users`, `${label} users`),
    loadAllTransactionsForSeason(leagueId)
  ]);

  if (Array.isArray(rosters) && Array.isArray(users)){
    document.getElementById(standingsTarget).innerHTML = buildStandingsTable(rosters, users, leagueType);
  } else {
    setError(standingsTarget, `${label} standings could not be loaded.`);
  }

  renderTransactions(txTarget, txs || [], users || [], rosters || []);
  return { rosters: rosters || [], users: users || [], league };
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

async function fetchLeagueChain(startLeagueId, label){
  const seasons = [];
  let currentId = startLeagueId;
  let safety = 0;
  while(currentId && safety < 8){
    const league = await fetchJSON(`https://api.sleeper.app/v1/league/${currentId}`, `${label} history ${currentId}`);
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

async function inferPlayoffWinner(leagueId, label){
  const bracket = await fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/winners_bracket`, `${label} winners bracket`);
  if (!Array.isArray(bracket) || !bracket.length) return null;
  const finalMatch = [...bracket]
    .filter(m => m && (m.r === Math.max(...bracket.map(x => x.r || 0))))
    .find(m => m.w);
  if (!finalMatch?.w) return null;

  const [rosters, users] = await Promise.all([
    fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/rosters`, `${label} winner rosters`),
    fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/users`, `${label} winner users`)
  ]);
  const winnerRoster = (rosters || []).find(r => String(r.roster_id) === String(finalMatch.w));
  return winnerRoster ? teamNameForRoster(winnerRoster, users || []) : null;
}

async function buildSeasonSummary(league, label){
  const playoffWinner = await inferPlayoffWinner(league.league_id, `${label} ${league.season}`);
  if (playoffWinner) {
    return { name: league.name || "League", winner: playoffWinner, source: "playoffs" };
  }

  const [rosters, users] = await Promise.all([
    fetchJSON(`https://api.sleeper.app/v1/league/${league.league_id}/rosters`, `${label} ${league.season} rosters`),
    fetchJSON(`https://api.sleeper.app/v1/league/${league.league_id}/users`, `${label} ${league.season} users`)
  ]);
  return { name: league.name || "League", winner: inferTopFinisher(rosters, users), source: "regular season" };
}

async function loadHistory(){
  const target = document.getElementById("historyContent");
  const [championsChain, developmentChain] = await Promise.all([
    fetchLeagueChain(CHAMPIONS_ID, "Champions"),
    fetchLeagueChain(DEVELOPMENT_ID, "Development")
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
      c ? buildSeasonSummary(c, "Champions") : null,
      d ? buildSeasonSummary(d, "Development") : null
    ]);

    cards.push(`<div class="history-season">
      <h3>${season}</h3>
      <div class="history-chip">Champions League</div>
      <p><strong>League Name:</strong> ${cSum ? cSum.name : "Not found"}</p>
      <p><strong>Winner:</strong> ${cSum ? cSum.winner : "Not available"}</p>
      <p class="section-note">Source: ${cSum ? cSum.source : "n/a"}</p>
      <div class="history-chip">Development League</div>
      <p><strong>League Name:</strong> ${dSum ? dSum.name : "Not found"}</p>
      <p><strong>Winner:</strong> ${dSum ? dSum.winner : "Not available"}</p>
      <p class="section-note">Source: ${dSum ? dSum.source : "n/a"}</p>
    </div>`);
  }

  target.innerHTML = `<div class="history-grid">${cards.join("")}</div>`;
}

async function loadTournament(){
  const target = document.getElementById("tournamentBracket");
  const data = await fetchJSON("./tournament.json", "Tournament file");
  if (!data || !Array.isArray(data.rounds)){
    setError("tournamentBracket", "Tournament bracket file not found.");
    return;
  }
  target.innerHTML = data.rounds.map(round => `<div class="bracket-round"><h3>${round.name}</h3>${
    round.matches.map(match => `<div class="bracket-match"><div><strong>${match.team1}</strong> vs <strong>${match.team2}</strong></div><div class="score-meta">${match.note || ""}</div></div>`).join("")
  }</div>`).join("");
}

async function init(){
  const status = document.getElementById("status");
  status.textContent = "Running API diagnostics…";

  const [champView, devView] = await Promise.all([
    loadLeagueView(CHAMPIONS_ID, "championsStandings", "championsTransactions", "champions", "Champions"),
    loadLeagueView(DEVELOPMENT_ID, "developmentStandings", "developmentTransactions", "development", "Development")
  ]);

  const recent = await getMostRecentWeekWithMatchups(CHAMPIONS_ID);
  if (recent.week && recent.matchups.length){
    renderMatchups(recent.matchups, champView.rosters, champView.users, recent.week);
    status.textContent = `Data loaded · most recent available Sleeper results are from Week ${recent.week}`;
  } else {
    setError("matchups", "No recent matchup data available.");
    status.textContent = "Some data failed to load. Check the diagnostics panel.";
  }

  await Promise.all([loadHistory(), loadTournament()]);
  if (status.textContent.startsWith("Running")) {
    status.textContent = "Diagnostics complete.";
  }
}

init();
