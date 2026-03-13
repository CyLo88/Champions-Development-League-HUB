const CHAMPIONS_ID = "1253490267638464512";
const DEVELOPMENT_ID = "1253490390737100800";

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
    const res = await fetch(url);
    if(!res.ok) throw new Error("HTTP "+res.status);
    return await res.json();
  }catch(e){
    console.error(url,e);
    return null;
  }
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

function powerRankingsHTML(rosters, users){
  const ranked = sortRosters(rosters).map((r,i)=>{
    const info = teamInfo(r, users);
    const pts = Number(r.settings?.fpts || 0).toFixed(1);
    return `<div class="rank-card">
      <div class="rank-num">${i+1}</div>
      <div><strong>${info.team}</strong><br><small>${info.owner}</small><br><small>Record: ${r.settings?.wins||0}-${r.settings?.losses||0} · Points: ${pts}</small></div>
    </div>`;
  }).join("");
  return ranked || "<p>No rankings available.</p>";
}

function topScorersHTML(champRosters, champUsers, devRosters, devUsers){
  const merged = [
    ...(champRosters||[]).map(r=>({roster:r, users:champUsers})),
    ...(devRosters||[]).map(r=>({roster:r, users:devUsers}))
  ].sort((a,b)=>(b.roster.settings?.fpts||0)-(a.roster.settings?.fpts||0)).slice(0,5);

  return merged.map((item, idx)=>{
    const info = teamInfo(item.roster, item.users);
    return `<div class="rank-card">
      <div class="rank-num">${idx+1}</div>
      <div><strong>${info.team}</strong><br><small>${info.owner}</small><br><small>${Number(item.roster.settings?.fpts||0).toFixed(1)} pts</small></div>
    </div>`;
  }).join("") || "<p>No scoring data available.</p>";
}

function matchupsHTML(matchups, week, rosters, users){
  const rosterMap = new Map(rosters.map(r=>[String(r.roster_id), r]));
  const byMatch = {};
  matchups.forEach(m=>{
    const key = m.matchup_id ?? `solo-${m.roster_id}`;
    byMatch[key] ||= [];
    byMatch[key].push(m);
  });
  return Object.values(byMatch).map(group=>{
    const a = group[0];
    const b = group[1];
    const aInfo = rosterMap.get(String(a.roster_id)) ? teamInfo(rosterMap.get(String(a.roster_id)), users) : {team:`Roster ${a.roster_id}`, owner:""};
    const bInfo = b && rosterMap.get(String(b.roster_id)) ? teamInfo(rosterMap.get(String(b.roster_id)), users) : {team:b?`Roster ${b.roster_id}`:"Bye / TBD", owner:""};
    return `<div class="matchup-card">
      <div class="matchup-head"><span>Week ${week}</span><span>Most recent available</span></div>
      <div class="team-row"><div class="team-meta"><strong>${aInfo.team}</strong><br><small>${aInfo.owner}</small></div><div class="score">${Number(a.points||0).toFixed(1)}</div></div>
      <div class="team-row"><div class="team-meta"><strong>${bInfo.team}</strong><br><small>${bInfo.owner}</small></div><div class="score">${b ? Number(b.points||0).toFixed(1) : "-"}</div></div>
    </div>`;
  }).join("") || "<p>No matchups available.</p>";
}

async function loadRecentMatchups(rosters, users){
  for(let week=18; week>=1; week--){
    const data = await fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/matchups/${week}`);
    if(Array.isArray(data) && data.length){
      document.getElementById("matchups").innerHTML = matchupsHTML(data, week, rosters, users);
      return week;
    }
  }
  document.getElementById("matchups").innerHTML = "<p>No recent matchups found.</p>";
  return null;
}

async function loadHistory(){
  // lightweight history placeholder cards using current season and structure
  document.getElementById("historyPreview").innerHTML = `
    <div class="history-card"><strong>2025</strong><br><small>Use the History page for full winner summaries.</small></div>
    <div class="history-card"><strong>2024</strong><br><small>Winner details shown in the Trophy Case and future versions.</small></div>
    <div class="history-card"><strong>2023</strong><br><small>History remains editable as needed for accuracy.</small></div>
  `;
  document.getElementById("trophyCase").innerHTML = `
    <div class="trophy-card"><strong>Champions League</strong><br><small>Champion: TBD<br>Runner-Up: TBD<br>Third Place: TBD</small></div>
    <div class="trophy-card"><strong>Development League</strong><br><small>Champion: TBD<br>Runner-Up: TBD<br>Third Place: TBD</small></div>
    <div class="trophy-card"><strong>Midseason Tournament</strong><br><small>Champion: TBD<br>Runner-Up: TBD</small></div>
  `;
}

async function loadTournament(){
  const data = await fetchJSON("./tournament.json");
  if(!data || !Array.isArray(data.rounds)){
    document.getElementById("tournamentBracket").innerHTML = "<p class='error'>Tournament bracket file not found.</p>";
    return;
  }
  document.getElementById("tournamentBracket").innerHTML = `<div class="bracket-grid">` + data.rounds.map(round=>{
    const matches = round.matches.map(m=>`<div class="matchup-card"><strong>${m.team1}</strong> vs <strong>${m.team2}</strong></div>`).join("");
    return `<div class="bracket-round"><h3>${round.name}</h3>${matches}</div>`;
  }).join("") + `</div>`;
}

async function init(){
  const [champRosters, champUsers, devRosters, devUsers] = await Promise.all([
    fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/rosters`),
    fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/users`),
    fetchJSON(`https://api.sleeper.app/v1/league/${DEVELOPMENT_ID}/rosters`),
    fetchJSON(`https://api.sleeper.app/v1/league/${DEVELOPMENT_ID}/users`)
  ]);

  if(champRosters && champUsers){
    document.getElementById("championsStandings").innerHTML = standingsHTML(champRosters, champUsers, "champions");
  } else {
    document.getElementById("championsStandings").innerHTML = "<p class='error'>Unable to load Champions League standings.</p>";
  }

  if(devRosters && devUsers){
    document.getElementById("developmentStandings").innerHTML = standingsHTML(devRosters, devUsers, "development");
  } else {
    document.getElementById("developmentStandings").innerHTML = "<p class='error'>Unable to load Development League standings.</p>";
  }

  if(champRosters && champUsers && devRosters && devUsers){
    document.getElementById("powerRankings").innerHTML = powerRankingsHTML(
      [...champRosters, ...devRosters],
      [...champUsers, ...devUsers]
    );
    document.getElementById("topScorers").innerHTML = topScorersHTML(champRosters, champUsers, devRosters, devUsers);
  } else {
    document.getElementById("powerRankings").innerHTML = "<p class='error'>Unable to load power rankings.</p>";
    document.getElementById("topScorers").innerHTML = "<p class='error'>Unable to load top scorers.</p>";
  }

  const week = (champRosters && champUsers) ? await loadRecentMatchups(champRosters, champUsers) : null;
  await loadHistory();
  await loadTournament();

  document.getElementById("status").innerText = week ? `Showing most recent available results · Week ${week}` : "Site loaded";
}

init();
