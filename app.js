const CHAMPIONS_ID = "1253490267638464512";
const DEVELOPMENT_ID = "1253490390737100800";
const PLAYER_CACHE_KEY = "cdl_player_directory_v17";

let currentWeek = 1;
let maxWeek = 18;
let playerDirectory = {};
let championsUsers = [];
let developmentUsers = [];
let championsRosters = [];
let developmentRosters = [];

document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  };
});

document.getElementById("closeModal").onclick=()=>document.getElementById("matchupModal").classList.add("hidden");
document.getElementById("matchupModal").onclick=(e)=>{
  if(e.target.id==="matchupModal") document.getElementById("matchupModal").classList.add("hidden");
};

document.getElementById("prevWeek").onclick=()=>{ if(currentWeek>1){ currentWeek--; loadWeek(currentWeek); } };
document.getElementById("nextWeek").onclick=()=>{ if(currentWeek<maxWeek){ currentWeek++; loadWeek(currentWeek); } };

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

function playerInfo(id){
  const p = playerDirectory[String(id)] || {};
  return {
    name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || String(id),
    pos: p.position || "",
    team: p.team || ""
  };
}

function playerCard(id, pts){
  const info = playerInfo(id);
  return `
    <div class="player-card">
      <div class="player-pos">${info.pos || "PLAYER"}</div>
      <div class="player-name">${info.name}</div>
      <div class="player-meta">${info.team || ""}</div>
      <div class="player-points">${Number(pts || 0).toFixed(2)}</div>
    </div>
  `;
}

function standingsHTML(rosters, users, type){
  const sorted = [...rosters].sort((a,b)=>{
    const wins = (b.settings?.wins||0) - (a.settings?.wins||0);
    if(wins !== 0) return wins;
    return (b.settings?.fpts||0) - (a.settings?.fpts||0);
  });
  const rows = sorted.map((r,i)=>{
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

function groupMatchups(matchups){
  const grouped = {};
  (matchups || []).forEach(m=>{
    const key = m.matchup_id ?? `solo-${m.roster_id}`;
    if(!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  });
  return Object.values(grouped);
}

function renderMatchupList(matchups, containerId, rosters, users, leagueLabel){
  const rosterMap = new Map(rosters.map(r=>[String(r.roster_id), r]));
  const container = document.getElementById(containerId);
  const groups = groupMatchups(matchups);

  if(!groups.length){
    container.innerHTML = "<p>No matchups found for this week.</p>";
    return;
  }

  container.innerHTML = "";
  groups.forEach(group=>{
    const a = group[0];
    const b = group[1];
    const aRoster = rosterMap.get(String(a.roster_id));
    const bRoster = b ? rosterMap.get(String(b.roster_id)) : null;
    const aInfo = aRoster ? teamInfo(aRoster, users) : {team:`Roster ${a.roster_id}`, owner:""};
    const bInfo = bRoster ? teamInfo(bRoster, users) : {team:b ? `Roster ${b.roster_id}` : "Bye / TBD", owner:""};

    const el = document.createElement("div");
    el.className = "matchup-card";
    el.innerHTML = `
      <div>
        <div class="matchup-team-name">${aInfo.team}</div>
        <div class="matchup-owner">${aInfo.owner}</div>
      </div>
      <div class="matchup-vs">${leagueLabel}<br>vs</div>
      <div>
        <div class="matchup-team-name">${bInfo.team}</div>
        <div class="matchup-owner">${bInfo.owner}</div>
      </div>
      <div class="matchup-score">${Number(a.points||0).toFixed(2)} / ${b ? Number(b.points||0).toFixed(2) : "-"}</div>
    `;
    el.addEventListener("click", ()=>openMatchupModal(group, rosters, users, leagueLabel));
    container.appendChild(el);
  });
}

function lineupSection(title, playerIds, pointsMap){
  if(!playerIds || !playerIds.length){
    return `<div class="empty-note">No players available.</div>`;
  }
  return `
    <div class="lineup-section">
      <h4>${title}</h4>
      ${playerIds.map(pid=>playerCard(pid, pointsMap?.[pid])).join("")}
    </div>
  `;
}

function openMatchupModal(group, rosters, users, leagueLabel){
  const a = group[0];
  const b = group[1] || {roster_id:"-", points:0, starters:[], players_points:{}};
  const aRoster = rosters.find(r=>String(r.roster_id)===String(a.roster_id)) || {players:[], reserve:[]};
  const bRoster = rosters.find(r=>String(r.roster_id)===String(b.roster_id)) || {players:[], reserve:[]};
  const aInfo = teamInfo(aRoster, users);
  const bInfo = teamInfo(bRoster, users);

  const aStarters = Array.isArray(a.starters) ? a.starters.filter(Boolean) : [];
  const bStarters = Array.isArray(b.starters) ? b.starters.filter(Boolean) : [];

  const aBench = (aRoster.players || []).filter(p => !aStarters.includes(p) && !(aRoster.reserve || []).includes(p));
  const bBench = (bRoster.players || []).filter(p => !bStarters.includes(p) && !(bRoster.reserve || []).includes(p));
  const aIR = Array.isArray(aRoster.reserve) ? aRoster.reserve : [];
  const bIR = Array.isArray(bRoster.reserve) ? bRoster.reserve : [];

  document.getElementById("matchupDetails").innerHTML = `
    <div class="modal-header">
      <div class="modal-side">
        <h3>${aInfo.team}</h3>
        <p>${aInfo.owner}</p>
        <div class="modal-score">${Number(a.points||0).toFixed(2)}</div>
      </div>
      <div class="modal-mid">${leagueLabel}<br>Week ${currentWeek}</div>
      <div class="modal-side">
        <h3>${bInfo.team}</h3>
        <p>${bInfo.owner}</p>
        <div class="modal-score">${Number(b.points||0).toFixed(2)}</div>
      </div>
    </div>

    <div class="lineup-section">
      <h4>${aInfo.team} – Starters</h4>
      ${lineupSection("", aStarters, a.players_points || {})}
    </div>
    <div class="lineup-section">
      <h4>${bInfo.team} – Starters</h4>
      ${lineupSection("", bStarters, b.players_points || {})}
    </div>

    <div class="lineup-section">
      <h4>${aInfo.team} – Bench</h4>
      ${lineupSection("", aBench, a.players_points || {})}
    </div>
    <div class="lineup-section">
      <h4>${bInfo.team} – Bench</h4>
      ${lineupSection("", bBench, b.players_points || {})}
    </div>

    ${(aIR.length || bIR.length) ? `
      <div class="lineup-section">
        <h4>${aInfo.team} – IR</h4>
        ${lineupSection("", aIR, a.players_points || {})}
      </div>
      <div class="lineup-section">
        <h4>${bInfo.team} – IR</h4>
        ${lineupSection("", bIR, b.players_points || {})}
      </div>
    ` : ""}
  `;
  document.getElementById("matchupModal").classList.remove("hidden");
}

async function detectMostRecentWeek(){
  for(let w=18; w>=1; w--){
    const champs = await fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/matchups/${w}`);
    const dev = await fetchJSON(`https://api.sleeper.app/v1/league/${DEVELOPMENT_ID}/matchups/${w}`);
    if((Array.isArray(champs) && champs.length) || (Array.isArray(dev) && dev.length)) return w;
  }
  return 1;
}

async function loadWeek(week){
  currentWeek = week;
  document.getElementById("weekLabel").innerText = "Week " + week;
  document.getElementById("prevWeek").disabled = week <= 1;
  document.getElementById("nextWeek").disabled = week >= maxWeek;

  const [champMatchups, devMatchups] = await Promise.all([
    fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/matchups/${week}`),
    fetchJSON(`https://api.sleeper.app/v1/league/${DEVELOPMENT_ID}/matchups/${week}`)
  ]);

  renderMatchupList(champMatchups || [], "championsMatchups", championsRosters, championsUsers, "Champions League");
  renderMatchupList(devMatchups || [], "developmentMatchups", developmentRosters, developmentUsers, "Development League");
}

async function loadTournament(){
  const data = await fetchJSON("./tournament.json");
  if(!data || !Array.isArray(data.rounds)){
    document.getElementById("tournamentBracket").innerHTML = "<p>Tournament bracket file not found.</p>";
    return;
  }
  document.getElementById("tournamentBracket").innerHTML = data.rounds.map(r=>`
    <div class="panel" style="margin-bottom:12px;">
      <strong>${r.name}</strong>
      ${(r.matches || []).map(m=>`<div style="margin-top:8px;">${m.team1} vs ${m.team2}</div>`).join("")}
    </div>
  `).join("");
}

async function init(){
  const [cUsers, dUsers, cRosters, dRosters, directory] = await Promise.all([
    fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/users`),
    fetchJSON(`https://api.sleeper.app/v1/league/${DEVELOPMENT_ID}/users`),
    fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/rosters`),
    fetchJSON(`https://api.sleeper.app/v1/league/${DEVELOPMENT_ID}/rosters`),
    getPlayerDirectory()
  ]);

  championsUsers = cUsers || [];
  developmentUsers = dUsers || [];
  championsRosters = cRosters || [];
  developmentRosters = dRosters || [];
  playerDirectory = directory || {};

  if(championsRosters.length && championsUsers.length){
    document.getElementById("championsStandings").innerHTML = standingsHTML(championsRosters, championsUsers, "champions");
  } else {
    document.getElementById("championsStandings").innerHTML = "<p>Unable to load Champions standings.</p>";
  }

  if(developmentRosters.length && developmentUsers.length){
    document.getElementById("developmentStandings").innerHTML = standingsHTML(developmentRosters, developmentUsers, "development");
  } else {
    document.getElementById("developmentStandings").innerHTML = "<p>Unable to load Development standings.</p>";
  }

  maxWeek = await detectMostRecentWeek();
  await loadWeek(maxWeek);
  await loadTournament();

  document.getElementById("status").innerText = `Version 17 loaded · browse weeks 1-${maxWeek} on the Matchups tab`;
}

init();
