const CHAMPIONS_ID = "1253490267638464512";
const DEVELOPMENT_ID = "1253490390737100800";
let currentWeek = 1;
let maxWeek = 18;
let championsRosters = [];
let championsUsers = [];

document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  };
});

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
    </tr>`;
  }).join("");
  return `<table class="table">
    <tr><th>Rank</th><th>Team</th><th>Record</th></tr>
    ${rows}
  </table>`;
}

function renderMatchups(matchups, week){
  const rosterMap = new Map(championsRosters.map(r=>[String(r.roster_id), r]));
  const grouped = {};
  matchups.forEach(m=>{
    const key = m.matchup_id ?? `solo-${m.roster_id}`;
    grouped[key] ||= [];
    grouped[key].push(m);
  });

  const html = Object.values(grouped).map(group=>{
    const a = group[0];
    const b = group[1];
    const aRoster = rosterMap.get(String(a.roster_id));
    const bRoster = b ? rosterMap.get(String(b.roster_id)) : null;
    const aInfo = aRoster ? teamInfo(aRoster, championsUsers) : {team:`Roster ${a.roster_id}`, owner:""};
    const bInfo = bRoster ? teamInfo(bRoster, championsUsers) : {team:b ? `Roster ${b.roster_id}` : "Bye / TBD", owner:""};

    return `<div class="matchup-card">
      <div class="matchup-head"><span>Week ${week}</span><span>Champions League</span></div>
      <div class="matchup-row">
        <div><div class="matchup-team">${aInfo.team}</div><div class="matchup-owner">${aInfo.owner}</div></div>
        <div class="matchup-score">${Number(a.points||0).toFixed(2)}</div>
      </div>
      <div class="matchup-row">
        <div><div class="matchup-team">${bInfo.team}</div><div class="matchup-owner">${bInfo.owner}</div></div>
        <div class="matchup-score">${b ? Number(b.points||0).toFixed(2) : "-"}</div>
      </div>
    </div>`;
  }).join("");

  document.getElementById("matchups").innerHTML = html || "<p>No matchups found for this week.</p>";
  document.getElementById("weekLabel").innerText = "Week " + week;
  document.getElementById("prevWeek").disabled = week <= 1;
  document.getElementById("nextWeek").disabled = week >= maxWeek;
}

async function loadWeek(week){
  currentWeek = week;
  const matchups = await fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/matchups/${week}`);
  if(Array.isArray(matchups)){
    renderMatchups(matchups, week);
  }else{
    document.getElementById("matchups").innerHTML = "<p>No matchups found for this week.</p>";
  }
}

document.getElementById("prevWeek").onclick=()=>{ if(currentWeek > 1) loadWeek(currentWeek - 1); };
document.getElementById("nextWeek").onclick=()=>{ if(currentWeek < maxWeek) loadWeek(currentWeek + 1); };

async function detectMostRecentWeek(){
  for(let w=18; w>=1; w--){
    const data = await fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/matchups/${w}`);
    if(Array.isArray(data) && data.length){
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
  let html = "";
  data.rounds.forEach(r=>{
    html += `<div class="matchup-card"><strong>${r.name}</strong>`;
    r.matches.forEach(m=>{ html += `<div class="matchup-row"><div>${m.team1}</div><div>${m.team2}</div></div>`; });
    html += `</div>`;
  });
  document.getElementById("tournamentBracket").innerHTML = html;
}

async function init(){
  const [cRosters, cUsers, dRosters, dUsers] = await Promise.all([
    fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/rosters`),
    fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/users`),
    fetchJSON(`https://api.sleeper.app/v1/league/${DEVELOPMENT_ID}/rosters`),
    fetchJSON(`https://api.sleeper.app/v1/league/${DEVELOPMENT_ID}/users`)
  ]);

  championsRosters = Array.isArray(cRosters) ? cRosters : [];
  championsUsers = Array.isArray(cUsers) ? cUsers : [];

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

  const recentWeek = await detectMostRecentWeek();
  maxWeek = Math.max(recentWeek, 1);
  await loadWeek(recentWeek);
  await loadTournament();

  document.getElementById("status").innerText = `Matchups moved to their own tab · browsing through Week ${maxWeek}`;
}

init();
