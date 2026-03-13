
const CHAMPIONS_ID = "1253490267638464512";
const DEVELOPMENT_ID = "1253490390737100800";

async function fetchJSON(url){
try{
const res = await fetch(url);
if(!res.ok) throw new Error("Network error");
return await res.json();
}catch(err){
console.error(err);
return null;
}
}

function showTab(id){
document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
document.getElementById(id).classList.add("active");
}

async function loadState(){
const state = await fetchJSON("https://api.sleeper.app/v1/state/nfl");
return state ? state.week : 1;
}

async function loadMatchups(leagueId, week){
return await fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
}

async function loadRosters(leagueId){
return await fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
}

async function loadUsers(leagueId){
return await fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/users`);
}

function buildStandings(rosters, users){
let table = "";
rosters.sort((a,b)=>b.settings.wins - a.settings.wins);
rosters.forEach(r=>{
const user = users.find(u=>u.user_id === r.owner_id);
table += `<div class="card">${user.display_name} — ${r.settings.wins}-${r.settings.losses}</div>`;
});
return table;
}

async function init(){

const status = document.getElementById("status");

const week = await loadState();
if(!week){
status.innerText = "Unable to load Sleeper data.";
return;
}

status.innerText = "Season 2025 — Week " + week;

const [champMatchups, devMatchups] = await Promise.all([
loadMatchups(CHAMPIONS_ID, week),
loadMatchups(DEVELOPMENT_ID, week)
]);

if(!champMatchups || !devMatchups){
document.getElementById("matchups").innerText = "Matchups unavailable.";
}else{

let html = "<h3>Champions League</h3>";
champMatchups.forEach(m=>{
html += `<div class="card">Roster ${m.roster_id}: ${m.points}</div>`;
});

html += "<h3>Development League</h3>";
devMatchups.forEach(m=>{
html += `<div class="card">Roster ${m.roster_id}: ${m.points}</div>`;
});

document.getElementById("matchups").innerHTML = html;
}

const [champRosters, champUsers] = await Promise.all([
loadRosters(CHAMPIONS_ID),
loadUsers(CHAMPIONS_ID)
]);

if(champRosters && champUsers){
document.getElementById("championsStandings").innerHTML = buildStandings(champRosters, champUsers);
}

const [devRosters, devUsers] = await Promise.all([
loadRosters(DEVELOPMENT_ID),
loadUsers(DEVELOPMENT_ID)
]);

if(devRosters && devUsers){
document.getElementById("developmentStandings").innerHTML = buildStandings(devRosters, devUsers);
}

}

init();
