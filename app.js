
const CHAMPIONS_ID = "1253490267638464512";
const DEVELOPMENT_ID = "1253490390737100800";

async function fetchJSON(url){
try{
const res = await fetch(url);
if(!res.ok) throw new Error("Network error");
return await res.json();
}catch(e){
console.error(e);
return null;
}
}

function showTab(id){
document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
document.getElementById(id).classList.add("active");
}

async function getWeek(){
const state = await fetchJSON("https://api.sleeper.app/v1/state/nfl");
return state ? state.week : null;
}

async function getMatchups(league,week){
return await fetchJSON(`https://api.sleeper.app/v1/league/${league}/matchups/${week}`);
}

async function getRosters(league){
return await fetchJSON(`https://api.sleeper.app/v1/league/${league}/rosters`);
}

async function getUsers(league){
return await fetchJSON(`https://api.sleeper.app/v1/league/${league}/users`);
}

function buildStandings(rosters,users){

rosters.sort((a,b)=>b.settings.wins-a.settings.wins);

let html="";

rosters.forEach((r,index)=>{

const u = users.find(x=>x.user_id===r.owner_id);
const name = u ? u.display_name : "Team";

let cls="card";
if(index>=8) cls+=" relegation";

html += `<div class="${cls}">
<span class="rank">${index+1}.</span>
${name} — ${r.settings.wins}-${r.settings.losses}
</div>`;

});

return html;
}

async function loadStandings(){

const [cr,cu] = await Promise.all([
getRosters(CHAMPIONS_ID),
getUsers(CHAMPIONS_ID)
]);

if(cr && cu){
document.getElementById("championsStandings").innerHTML = buildStandings(cr,cu);
}

const [dr,du] = await Promise.all([
getRosters(DEVELOPMENT_ID),
getUsers(DEVELOPMENT_ID)
]);

if(dr && du){
document.getElementById("developmentStandings").innerHTML = buildStandings(dr,du);
}

}

async function loadMatchups(){

const status = document.getElementById("status");
let week = await getWeek();

if(!week){
status.innerText="Unable to read Sleeper state.";
return;
}

let matchups = await getMatchups(CHAMPIONS_ID,week);

if(!matchups || matchups.length===0){

status.innerText="Offseason detected – showing most recent results";

for(let i=18;i>=1;i--){
matchups = await getMatchups(CHAMPIONS_ID,i);
if(matchups && matchups.length>0){
week=i;
break;
}
}

}else{

status.innerText="Season Week "+week;

}

let html = `<h3>Champions League – Week ${week}</h3>`;

matchups.forEach(m=>{
html += `<div class="card">Roster ${m.roster_id}: ${m.points}</div>`;
});

document.getElementById("matchups").innerHTML = html;

}

async function init(){

await loadMatchups();
await loadStandings();

}

init();
