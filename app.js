const CHAMPIONS_ID = "1253490267638464512";
const DEVELOPMENT_ID = "1253490390737100800";
const PLAYER_CACHE_KEY = "cdl_player_directory_v2";

const SLOT_NAMES = ["QB","RB","RB","WR","WR","TE","FLEX","K","DEF"];
let currentWeek = 1;
let maxWeek = 18;
let activeLeague = "champions";
let championsRosters = [], championsUsers = [];
let developmentRosters = [], developmentUsers = [];
let playerDirectory = {};

document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  };
});

document.getElementById("showChampions").onclick=()=>{
  activeLeague = "champions";
  document.getElementById("showChampions").classList.add("active");
  document.getElementById("showDevelopment").classList.remove("active");
  loadWeek(currentWeek);
};
document.getElementById("showDevelopment").onclick=()=>{
  activeLeague = "development";
  document.getElementById("showDevelopment").classList.add("active");
  document.getElementById("showChampions").classList.remove("active");
  loadWeek(currentWeek);
};

document.getElementById("prevWeek").onclick=()=>{ if(currentWeek > 1) loadWeek(currentWeek - 1); };
document.getElementById("nextWeek").onclick=()=>{ if(currentWeek < maxWeek) loadWeek(currentWeek + 1); };
document.getElementById("closeModal").onclick=()=>document.getElementById("matchupModal").classList.add("hidden");
document.getElementById("matchupModal").onclick=(e)=>{ if(e.target.id==="matchupModal") document.getElementById("matchupModal").classList.add("hidden"); };

async function fetchJSON(url){
  try{
    const r = await fetch(url);
    if(!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  }catch(e){
    console.error(url, e);
    return null;
  }
}

async function getPlayerDirectory(){
  try{
    const cached = localStorage.getItem(PLAYER_CACHE_KEY);
    if(cached) return JSON.parse(cached);
  }catch(e){}
  const data = await fetchJSON("https://api.sleeper.app/v1/players/nfl");
  if(data){
    try{ localStorage.setItem(PLAYER_CACHE_KEY, JSON.stringify(data)); }catch(e){}
  }
  return data || {};
}

function teamInfo(roster, users){
  const owner = users.find(u=>u.user_id==roster.owner_id) || {};
  return {
    team: owner.metadata?.team_name || owner.display_name || `Roster ${roster.roster_id}`,
    owner: owner.display_name || ""
  };
}

function sortRosters(rosters){
  return [...rosters].sort((a,b)=>{
    const wins = (b.settings?.wins||0) - (a.settings?.wins||0);
    if(wins !== 0) return wins;
    return (b.settings?.fpts||0) - (a.settings?.fpts||0);
  });
}

function standingsHTML(rosters, users, type){
  const rows = sortRosters(rosters).map((r,i)=>{
    const info = teamInfo(r, users);
    let cls = "";
    if(type==="champions" && i>=8) cls = "relegation";
    if(type==="development" && i<=1) cls = "promotion";
    return `<tr class="${cls}">
      <td>${i+1}</td>
      <td><strong>${info.team}</strong><br><small>${info.owner}</small></td>
      <td>${r.settings?.wins||0}-${r.settings?.losses||0}</td>
      <td>${Number(r.settings?.fpts||0).toFixed(1)}</td>
    </tr>`;
  }).join("");
  return `<table class="table">
    <tr><th>Rank</th><th>Team</th><th>Record</th><th>Points</th></tr>
    ${rows}
  </table>`;
}

function playerInfo(pid){
  const p = playerDirectory[String(pid)] || {};
  const full = p.full_name || ([p.first_name, p.last_name].filter(Boolean).join(" ")) || String(pid || "—");
  const meta = [p.position, p.team].filter(Boolean).join(" • ");
  return { name: full, meta };
}

function playerRowInner(pid, pts){
  if(!pid){
    return `<div><div class="player-name">—</div><div class="player-meta">Empty slot</div></div><div class="player-pts">0.00</div>`;
  }
  const info = playerInfo(pid);
  return `<div>
    <div class="player-name">${info.name}</div>
    <div class="player-meta">${info.meta || "Player info pending"}</div>
  </div>
  <div class="player-pts">${Number(pts||0).toFixed(2)}</div>`;
}

function sectionHTML(title, leftPlayers, rightPlayers, slotNames, leftPoints, rightPoints){
  const maxLen = Math.max(leftPlayers.length, rightPlayers.length, slotNames ? slotNames.length : 0);
  let rows = "";
  for(let i=0;i<maxLen;i++){
    const slot = slotNames ? (slotNames[i] || "BN") : "BN";
    rows += `<div class="lineup-grid">
      <div class="player-row">${playerRowInner(leftPlayers[i], leftPoints?.[leftPlayers[i]] || 0)}</div>
      <div class="slot-pill">${slot}</div>
      <div class="player-row">${playerRowInner(rightPlayers[i], rightPoints?.[rightPlayers[i]] || 0)}</div>
    </div>`;
  }
  return `<div class="subsection"><div class="lineup-section-title">${title}</div>${rows || "<p>No players found.</p>"}</div>`;
}

function matchupCardHTML(group, week, rosterMap, users, leagueLabel){
  const a = group[0];
  const b = group[1];
  const aRoster = rosterMap.get(String(a.roster_id));
  const bRoster = b ? rosterMap.get(String(b.roster_id)) : null;
  const aInfo = aRoster ? teamInfo(aRoster, users) : {team:`Roster ${a.roster_id}`, owner:""};
  const bInfo = bRoster ? teamInfo(bRoster, users) : {team:b ? `Roster ${b.roster_id}` : "Bye / TBD", owner:""};

  return `<div class="matchup-card">
    <div class="matchup-head"><span>Week ${week}</span><span>${leagueLabel}</span></div>
    <div class="matchup-row">
      <div><div class="matchup-team">${aInfo.team}</div><div class="matchup-owner">${aInfo.owner}</div></div>
      <div class="matchup-score">${Number(a.points||0).toFixed(2)}</div>
    </div>
    <div class="matchup-row">
      <div><div class="matchup-team">${bInfo.team}</div><div class="matchup-owner">${bInfo.owner}</div></div>
      <div class="matchup-score">${b ? Number(b.points||0).toFixed(2) : "-"}</div>
    </div>
  </div>`;
}

function buildMatchupDetail(group, week, rosters, users, leagueLabel){
  const a = group[0];
  const b = group[1] || {roster_id:"-", points:0, starters:[], players:[], players_points:{}};
  const aRoster = rosters.find(r => String(r.roster_id) === String(a.roster_id)) || {players:[], reserve:[]};
  const bRoster = rosters.find(r => String(r.roster_id) === String(b.roster_id)) || {players:[], reserve:[]};
  const aInfo = teamInfo(aRoster, users);
  const bInfo = teamInfo(bRoster, users);

  const aStarters = Array.isArray(a.starters) ? a.starters.slice(0, SLOT_NAMES.length) : [];
  const bStarters = Array.isArray(b.starters) ? b.starters.slice(0, SLOT_NAMES.length) : [];

  const aAll = Array.isArray(aRoster.players) ? aRoster.players : [];
  const bAll = Array.isArray(bRoster.players) ? bRoster.players : [];
  const aReserve = Array.isArray(aRoster.reserve) ? aRoster.reserve : [];
  const bReserve = Array.isArray(bRoster.reserve) ? bRoster.reserve : [];

  const aBench = aAll.filter(p => !aStarters.includes(p) && !aReserve.includes(p)).slice(0,10);
  const bBench = bAll.filter(p => !bStarters.includes(p) && !bReserve.includes(p)).slice(0,10);

  return `
    <div class="details-header">
      <div class="details-scoreboard">
        <div class="score-team">
          <div class="team-name">${aInfo.team}</div>
          <div class="owner">${aInfo.owner}</div>
          <div class="score">${Number(a.points||0).toFixed(2)}</div>
        </div>
        <div class="versus-pill">${leagueLabel}<br>Week ${week}</div>
        <div class="score-team">
          <div class="team-name">${bInfo.team}</div>
          <div class="owner">${bInfo.owner}</div>
          <div class="score">${Number(b.points||0).toFixed(2)}</div>
        </div>
      </div>
      <div class="note">Player scores are based on the matchup data returned for the selected week.</div>
    </div>

    ${sectionHTML("Starters", aStarters, bStarters, SLOT_NAMES, a.players_points || {}, b.players_points || {})}
    ${sectionHTML("Bench", aBench, bBench, null, a.players_points || {}, b.players_points || {})}
    ${(aReserve.length || bReserve.length) ? sectionHTML("Injured Reserve", aReserve, bReserve, null, a.players_points || {}, b.players_points || {}) : ""}
  `;
}

function renderMatchups(matchups, week){
  const rosters = activeLeague === "champions" ? championsRosters : developmentRosters;
  const users = activeLeague === "champions" ? championsUsers : developmentUsers;
  const rosterMap = new Map(rosters.map(r=>[String(r.roster_id), r]));
  const grouped = {};
  matchups.forEach(m=>{
    const key = m.matchup_id ?? `solo-${m.roster_id}`;
    grouped[key] ||= [];
    grouped[key].push(m);
  });

  const container = document.getElementById("matchups");
  container.innerHTML = "";
  Object.values(grouped).forEach(group=>{
    const wrap = document.createElement("div");
    wrap.innerHTML = matchupCardHTML(group, week, rosterMap, users, activeLeague === "champions" ? "Champions League" : "Development League");
    wrap.firstElementChild.onclick = ()=>{
      document.getElementById("matchupDetails").innerHTML = buildMatchupDetail(
        group, week, rosters, users, activeLeague === "champions" ? "Champions League" : "Development League"
      );
      document.getElementById("matchupModal").classList.remove("hidden");
    };
    container.appendChild(wrap.firstElementChild);
  });

  if(!container.innerHTML){
    container.innerHTML = "<p>No matchups found for this week.</p>";
  }

  document.getElementById("weekLabel").innerText = "Week " + week;
  document.getElementById("prevWeek").disabled = week <= 1;
  document.getElementById("nextWeek").disabled = week >= maxWeek;
}

async function loadWeek(week){
  currentWeek = week;
  const leagueId = activeLeague === "champions" ? CHAMPIONS_ID : DEVELOPMENT_ID;
  const matchups = await fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
  if(Array.isArray(matchups)){
    renderMatchups(matchups, week);
  }else{
    document.getElementById("matchups").innerHTML = "<p>No matchups found for this week.</p>";
  }
}

async function detectMostRecentWeek(){
  for(let w=18; w>=1; w--){
    const champ = await fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/matchups/${w}`);
    const dev = await fetchJSON(`https://api.sleeper.app/v1/league/${DEVELOPMENT_ID}/matchups/${w}`);
    if((Array.isArray(champ) && champ.length) || (Array.isArray(dev) && dev.length)){
      return w;
    }
  }
  return 1;
}

async function loadTournament(){
  const data = await fetchJSON("./tournament.json");
  if(!data || !Array.isArray(data.rounds)){
    document.getElementById("tournamentBracket").innerHTML = "<p>Tournament bracket file not found.</p>";
    return;
  }
  document.getElementById("tournamentBracket").innerHTML = `<div class="bracket-grid">` + data.rounds.map(round=>{
    const matches = round.matches.map(m=>`<div class="bracket-match"><strong>${m.team1}</strong> vs <strong>${m.team2}</strong></div>`).join("");
    return `<div class="bracket-round"><h3>${round.name}</h3>${matches}</div>`;
  }).join("") + `</div>`;
}

async function init(){
  const [cRosters, cUsers, dRosters, dUsers, directory] = await Promise.all([
    fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/rosters`),
    fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/users`),
    fetchJSON(`https://api.sleeper.app/v1/league/${DEVELOPMENT_ID}/rosters`),
    fetchJSON(`https://api.sleeper.app/v1/league/${DEVELOPMENT_ID}/users`),
    getPlayerDirectory()
  ]);

  championsRosters = Array.isArray(cRosters) ? cRosters : [];
  championsUsers = Array.isArray(cUsers) ? cUsers : [];
  developmentRosters = Array.isArray(dRosters) ? dRosters : [];
  developmentUsers = Array.isArray(dUsers) ? dUsers : [];
  playerDirectory = directory || {};

  if(cRosters && cUsers){
    document.getElementById("championsStandings").innerHTML = standingsHTML(cRosters, cUsers, "champions");
  } else {
    document.getElementById("championsStandings").innerHTML = "<p>Unable to load Champions standings.</p>";
  }

  if(dRosters && dUsers){
    document.getElementById("developmentStandings").innerHTML = standingsHTML(dRosters, dUsers, "development");
  } else {
    document.getElementById("developmentStandings").innerHTML = "<p>Unable to load Development standings.</p>";
  }

  maxWeek = await detectMostRecentWeek();
  await loadWeek(maxWeek);
  await loadTournament();

  document.getElementById("status").innerText = `Use the Matchups tab to browse Weeks 1-${maxWeek} and tap a matchup for lineup scores`;
}

init();
