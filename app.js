
const CHAMPIONS_ID="1253490267638464512"
const DEVELOPMENT_ID="1253490390737100800"

let currentWeek=1
let players={}

document.querySelectorAll(".tab-btn").forEach(btn=>{
btn.onclick=()=>{
document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"))
document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"))
btn.classList.add("active")
document.getElementById(btn.dataset.tab).classList.add("active")
}
})

async function fetchJSON(url){
try{
let r=await fetch(url)
return await r.json()
}catch{return null}
}

async function loadPlayers(){
players=await fetchJSON("https://api.sleeper.app/v1/players/nfl")||{}
}

function playerInfo(id){
let p=players[id]||{}
return{
name:p.full_name||id,
pos:p.position||"",
team:p.team||""
}
}

function playerCard(id,pts){
let info=playerInfo(id)
return `
<div class="player-card">
<div class="player-pos">${info.pos}</div>
<div class="player-name">${info.name}</div>
<div class="player-meta">${info.team}</div>
<div class="player-points">${(pts||0).toFixed(2)}</div>
</div>
`
}

function renderMatchups(matchups,container){

let grouped={}

matchups.forEach(m=>{
grouped[m.matchup_id]=grouped[m.matchup_id]||[]
grouped[m.matchup_id].push(m)
})

let html=""

Object.values(grouped).forEach(g=>{
let a=g[0]
html+=`
<div class="matchup-card" onclick='showMatchup(${JSON.stringify(g)})'>
<div>Roster ${a.roster_id}</div>
<div>${a.points.toFixed(2)}</div>
</div>
`
})

document.getElementById(container).innerHTML=html
}

function showMatchup(group){

let html=""

group.forEach(team=>{

html+=`<h3>Roster ${team.roster_id} — ${team.points.toFixed(2)}</h3>`

team.starters.forEach(p=>{
html+=playerCard(p,team.players_points[p])
})

})

document.getElementById("matchupDetails").innerHTML=html
document.getElementById("matchupModal").classList.remove("hidden")
}

document.getElementById("closeModal").onclick=()=>{
document.getElementById("matchupModal").classList.add("hidden")
}

async function loadWeek(){

document.getElementById("weekLabel").innerText="Week "+currentWeek

let champs=await fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/matchups/${currentWeek}`)
let dev=await fetchJSON(`https://api.sleeper.app/v1/league/${DEVELOPMENT_ID}/matchups/${currentWeek}`)

if(champs)renderMatchups(champs,"championsMatchups")
if(dev)renderMatchups(dev,"developmentMatchups")

}

document.getElementById("prevWeek").onclick=()=>{
if(currentWeek>1){currentWeek--;loadWeek()}
}

document.getElementById("nextWeek").onclick=()=>{
if(currentWeek<18){currentWeek++;loadWeek()}
}

async function init(){

await loadPlayers()

for(let w=18;w>=1;w--){
let test=await fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/matchups/${w}`)
if(test&&test.length){currentWeek=w;break}
}

loadWeek()

}

init()
