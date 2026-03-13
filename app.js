const CHAMPIONS_ID = "1253490267638464512";
const DEVELOPMENT_ID = "1253490390737100800";
const PLAYER_CACHE_KEY = "cdl_player_directory_v1";

const SLOT_NAMES = ["QB","RB","RB","WR","WR","TE","FLEX","K","DEF"];

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

async function fetchJSON(url){
  try{
    const res = await fetch(url);
    if(!res.ok) throw new Error("HTTP "+res.status);
    return await res.json();
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
  const user = users.find(u => u.user_id == roster.owner_id) || {};
  return {
    team: user.metadata?.team_name || user.display_name || `Roster ${roster.roster_id}`,
    owner: user.display_name || "Owner"
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
    const pts = Number(r.settings?.fpts || 0).toFixed(1);
    return `<tr class="${cls}">
      <td>${i+1}</td>
      <td><strong>${info.team}</strong><br><small>${info.owner}</small></td>
      <td>${r.settings?.wins||0}-${r.settings?.losses||0}</td>
      <td>${pts}</td>
    </tr>`;
  }).join("");
  return `<table class="table">
    <tr><th>Rank</th><th>Team</th><th>Record</th><th>Points</th></tr>
    ${rows}
  </table>`;
}

function matchupCardHTML(group, week, rosterMap, users){
  const a = group[0];
  const b = group[1];
  const aInfo = rosterMap.get(String(a.roster_id)) ? teamInfo(rosterMap.get(String(a.roster_id)), users) : {team:`Roster ${a.roster_id}`, owner:""};
  const bInfo = b && rosterMap.get(String(b.roster_id)) ? teamInfo(rosterMap.get(String(b.roster_id)), users) : {team:b?`Roster ${b.roster_id}`:"Bye / TBD", owner:""};
  return `<div class="matchup-card">
    <div class="matchup-top"><span>Week ${week}</span><span>Tap for lineup view</span></div>
    <div class="matchup-team">
      <div><div class="name">${aInfo.team}</div><div class="owner">${aInfo.owner}</div></div>
      <div class="pts">${Number(a.points||0).toFixed(2)}</div>
    </div>
    <div class="matchup-team">
      <div><div class="name">${bInfo.team}</div><div class="owner">${bInfo.owner}</div></div>
      <div class="pts">${b ? Number(b.points||0).toFixed(2) : "-"}</div>
    </div>
  </div>`;
}

function chunkBench(players){
  return players.map(p => p);
}

function playerLabel(pid, directory){
  const p = directory[String(pid)] || {};
  const full = p.full_name || p.first_name && p.last_name ? `${p.first_name||""} ${p.last_name||""}`.trim() : String(pid);
  const position = p.position || "";
  const team = p.team || "";
  return {name: full, meta: [position, team].filter(Boolean).join(" • ")};
}

function playerRow(pid, pts, directory){
  const info = playerLabel(pid, directory);
  return `<div class="player-row">
    <div>
      <div class="player-name">${info.name}</div>
      <div class="meta">${info.meta || "Player info pending"}</div>
    </div>
    <div class="pts">${Number(pts||0).toFixed(2)}</div>
  </div>`;
}

function lineupRow(leftPid, leftPts, slot, rightPid, rightPts, directory){
  return `<div class="player-row">${playerRowInner(leftPid, leftPts, directory)}</div>
          <div class="slot-pill">${slot}</div>
          <div class="player-row">${playerRowInner(rightPid, rightPts, directory)}</div>`;
}

function playerRowInner(pid, pts, directory){
  const info = playerLabel(pid, directory);
  return `<div>
      <div class="player-name">${info.name}</div>
      <div class="meta">${info.meta || "Player info pending"}</div>
    </div>
    <div class="pts">${Number(pts||0).toFixed(2)}</div>`;
}

function sectionRows(title, leftPlayers, rightPlayers, slotNames, leftPoints, rightPoints, directory){
  let rows = "";
  const maxLen = Math.max(leftPlayers.length, rightPlayers.length, slotNames ? slotNames.length : 0);
  for(let i=0;i<maxLen;i++){
    const slot = slotNames ? (slotNames[i] || "BN") : "BN";
    rows += `<div class="lineup-grid">
      <div class="player-row">${playerRowInner(leftPlayers[i], leftPoints?.[leftPlayers[i]] || 0, directory)}</div>
      <div class="slot-pill">${slot}</div>
      <div class="player-row">${playerRowInner(rightPlayers[i], rightPoints?.[rightPlayers[i]] || 0, directory)}</div>
    </div>`;
  }
  return `<div class="subsection"><div class="lineup-section-title">${title}</div>${rows}</div>`;
}

function safeArray(v){ return Array.isArray(v) ? v : []; }

async function showMatchupDetail(group, week, rosters, users, directory){
  const a = group[0];
  const b = group[1] || {roster_id:"-", points:0, starters:[], players:[]};
  const aRoster = rosters.find(r => String(r.roster_id) === String(a.roster_id)) || {players:[], reserve:[]};
  const bRoster = rosters.find(r => String(r.roster_id) === String(b.roster_id)) || {players:[], reserve:[]};
  const aInfo = teamInfo(aRoster, users);
  const bInfo = teamInfo(bRoster, users);

  const aStarters = safeArray(a.starters).slice(0, SLOT_NAMES.length);
  const bStarters = safeArray(b.starters).slice(0, SLOT_NAMES.length);

  const aAll = safeArray(aRoster.players);
  const bAll = safeArray(bRoster.players);

  const aReserve = safeArray(aRoster.reserve);
  const bReserve = safeArray(bRoster.reserve);

  const aBench = aAll.filter(p => !aStarters.includes(p) && !aReserve.includes(p)).slice(0,10);
  const bBench = bAll.filter(p => !bStarters.includes(p) && !bReserve.includes(p)).slice(0,10);

  const detailsHTML = `
    <div class="details-header">
      <div class="details-scoreboard">
        <div class="score-team">
          <div class="team-name">${aInfo.team}</div>
          <div class="owner">${aInfo.owner}</div>
          <div class="score">${Number(a.points||0).toFixed(2)}</div>
        </div>
        <div class="versus-pill">Week ${week}</div>
        <div class="score-team">
          <div class="team-name">${bInfo.team}</div>
          <div class="owner">${bInfo.owner}</div>
          <div class="score">${Number(b.points||0).toFixed(2)}</div>
        </div>
      </div>
      <div class="note">Player rows use Sleeper roster and matchup data. Live team totals will refresh when the page reloads.</div>
    </div>

    ${sectionRows("Starters", aStarters, bStarters, SLOT_NAMES, a.players_points, b.players_points, directory)}
    ${sectionRows("Bench", aBench, bBench, null, a.players_points, b.players_points, directory)}
    ${(aReserve.length || bReserve.length) ? sectionRows("Injured Reserve", aReserve, bReserve, null, a.players_points, b.players_points, directory) : ""}
  `;

  document.getElementById("matchupDetails").innerHTML = detailsHTML;
  document.getElementById("matchupModal").classList.remove("hidden");
}

async function loadRecentMatchups(rosters, users, directory){
  const rosterMap = new Map(rosters.map(r=>[String(r.roster_id), r]));
  for(let week=18; week>=1; week--){
    const data = await fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/matchups/${week}`);
    if(Array.isArray(data) && data.length){
      const byMatch = {};
      data.forEach(m=>{
        const key = m.matchup_id ?? `solo-${m.roster_id}`;
        byMatch[key] ||= [];
        byMatch[key].push(m);
      });
      const container = document.getElementById("matchups");
      container.innerHTML = "";
      Object.values(byMatch).forEach(group=>{
        const wrap = document.createElement("div");
        wrap.innerHTML = matchupCardHTML(group, week, rosterMap, users);
        wrap.firstElementChild.onclick = ()=>showMatchupDetail(group, week, rosters, users, directory);
        container.appendChild(wrap.firstElementChild);
      });
      return week;
    }
  }
  document.getElementById("matchups").innerHTML = "<p>No recent matchups found.</p>";
  return null;
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
  const [champRosters, champUsers, devRosters, devUsers, directory] = await Promise.all([
    fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/rosters`),
    fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/users`),
    fetchJSON(`https://api.sleeper.app/v1/league/${DEVELOPMENT_ID}/rosters`),
    fetchJSON(`https://api.sleeper.app/v1/league/${DEVELOPMENT_ID}/users`),
    getPlayerDirectory()
  ]);

  if(champRosters && champUsers){
    document.getElementById("championsStandings").innerHTML = standingsHTML(champRosters, champUsers, "champions");
  } else {
    document.getElementById("championsStandings").innerHTML = "<p>Unable to load Champions standings.</p>";
  }

  if(devRosters && devUsers){
    document.getElementById("developmentStandings").innerHTML = standingsHTML(devRosters, devUsers, "development");
  } else {
    document.getElementById("developmentStandings").innerHTML = "<p>Unable to load Development standings.</p>";
  }

  const week = (champRosters && champUsers) ? await loadRecentMatchups(champRosters, champUsers, directory) : null;
  await loadTournament();

  document.getElementById("status").innerText = week ? `Showing most recent available results · Week ${week}` : "Site loaded";
}

init();
