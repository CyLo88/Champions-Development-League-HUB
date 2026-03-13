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
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
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

function setError(id, msg){
  document.getElementById(id).innerHTML = `<div class="error-box">${msg}</div>`;
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
    return `<div class="tx-card">
      <div class="tx-top">
        <div class="tx-type">${type}</div>
        ${tx.week ? `<span class="tx-week">Week ${tx.week}</span>` : ""}
      </div>
      <div class="tx-teams">${teams}</div>
      <div class="tx-meta">${when}</div>
    </div>`;
  }).join("");
  document.getElementById(targetId).innerHTML = `<div class="tx-feed">${items}</div>`;
}

async function loadAllTransactionsForSeason(leagueId){
  let all = [];
  for (let week = 1; week <= 18; week++){
    const weekTx = await fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`);
    if (Array.isArray(weekTx) && weekTx.length){
      const filtered = weekTx.filter(tx => ["complete","processed","successful",undefined,null].includes(tx.status));
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
    setError(standingsTarget, "Standings could not be loaded.");
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
    return `<div class="matchup-card">
      <div class="matchup-head"><span>Week ${week}</span><span>Most recent available</span></div>
      <div class="team-row"><div class="team-name">${aName}</div><div class="team-score">${fmtNum(a.points)}</div></div>
      <div class="team-row"><div class="team-name">${bName}</div><div class="team-score">${fmtNum(b?.points)}</div></div>
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

async function inferPlayoffWinner(leagueId){
  const bracket = await fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/winners_bracket`);
  if (!Array.isArray(bracket) || !bracket.length) return null;
  const maxRound = Math.max(...bracket.map(x => x?.r || 0));
  const finalMatch = bracket.find(m => (m?.r || 0) === maxRound && m?.w);
  if (!finalMatch?.w) return null;
  const [rosters, users] = await Promise.all([
    fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
    fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/users`)
  ]);
  const winnerRoster = (rosters || []).find(r => String(r.roster_id) === String(finalMatch.w));
  return winnerRoster ? teamNameForRoster(winnerRoster, users || []) : null;
}

async function buildSeasonSummary(league){
  const playoffWinner = await inferPlayoffWinner(league.league_id);
  if (playoffWinner) return { name: league.name || "League", winner: playoffWinner, source: "playoffs" };
  const [rosters, users] = await Promise.all([
    fetchJSON(`https://api.sleeper.app/v1/league/${league.league_id}/rosters`),
    fetchJSON(`https://api.sleeper.app/v1/league/${league.league_id}/users`)
  ]);
  return { name: league.name || "League", winner: inferTopFinisher(rosters, users), source: "regular season" };
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

    cards.push(`<div class="history-card">
      <div class="history-year"><h3>${season}</h3><span class="pill">Season</span></div>
      <div class="history-chip">Champions League</div>
      <div class="history-line"><strong>Name:</strong> ${cSum ? cSum.name : "Not found"}</div>
      <div class="history-line"><strong>Winner:</strong> ${cSum ? cSum.winner : "Not available"}</div>
      <div class="history-line"><strong>Source:</strong> ${cSum ? cSum.source : "n/a"}</div>
      <div class="history-chip">Development League</div>
      <div class="history-line"><strong>Name:</strong> ${dSum ? dSum.name : "Not found"}</div>
      <div class="history-line"><strong>Winner:</strong> ${dSum ? dSum.winner : "Not available"}</div>
      <div class="history-line"><strong>Source:</strong> ${dSum ? dSum.source : "n/a"}</div>
    </div>`);
  }

  target.innerHTML = `<div class="history-grid">${cards.join("")}</div>`;
}

async function loadTournament(){
  const target = document.getElementById("tournamentBracket");
  const data = await fetchJSON("./tournament.json");
  if (!data || !Array.isArray(data.rounds)){
    setError("tournamentBracket", "Tournament bracket file not found.");
    return;
  }
  target.innerHTML = `<div class="bracket-grid">` + data.rounds.map(round => `<div class="bracket-round"><h3>${round.name}</h3>${
    round.matches.map(match => `<div class="bracket-match"><div><strong>${match.team1}</strong> vs <strong>${match.team2}</strong></div><div class="score-meta">${match.note || ""}</div></div>`).join("")
  }</div>`).join("") + `</div>`;
}

async function init(){
  const status = document.getElementById("status");
  status.textContent = "Loading site data…";

  const [champView] = await Promise.all([
    loadLeagueView(CHAMPIONS_ID, "championsStandings", "championsTransactions", "champions"),
    loadLeagueView(DEVELOPMENT_ID, "developmentStandings", "developmentTransactions", "development")
  ]);

  const recent = await getMostRecentWeekWithMatchups(CHAMPIONS_ID);
  if (recent.week && recent.matchups.length){
    renderMatchups(recent.matchups, champView.rosters, champView.users, recent.week);
    status.textContent = `Showing most recent available Sleeper results · Week ${recent.week}`;
  } else {
    setError("matchups", "No recent matchup data available.");
    status.textContent = "Some sections could not be loaded.";
  }

  await Promise.all([loadHistory(), loadTournament()]);
}

init();
