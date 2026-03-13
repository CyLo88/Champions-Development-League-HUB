
const CHAMPIONS_ID = "1253490267638464512"
const DEVELOPMENT_ID = "1253490390737100800"

let currentWeek = 1

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

async function loadStandings(leagueId,element){

let rosters=await fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/rosters`)
let users=await fetchJSON(`https://api.sleeper.app/v1/league/${leagueId}/users`)

rosters.sort((a,b)=>b.settings.wins-a.settings.wins)

let html="<table><tr><th>Rank</th><th>Team</th><th>Record</th></tr>"

rosters.forEach((r,i)=>{

let owner=users.find(u=>u.user_id==r.owner_id)
let name=owner?.metadata?.team_name||owner?.display_name||"Team"

html+=`<tr>
<td>${i+1}</td>
<td>${name}<br><small>${owner?.display_name||""}</small></td>
<td>${r.settings.wins}-${r.settings.losses}</td>
</tr>`

})

html+="</table>"

document.getElementById(element).innerHTML=html
}

async function loadMatchups(){

document.getElementById("weekLabel").innerText = "Week " + currentWeek

let matchups=await fetchJSON(`https://api.sleeper.app/v1/league/${CHAMPIONS_ID}/matchups/${currentWeek}`)

let container=document.getElementById("matchups")
container.innerHTML=""

if(!matchups) return

matchups.forEach(m=>{

let card=document.createElement("div")
card.className="matchup-card"

card.innerHTML=`
<div>Roster ${m.roster_id}</div>
<div>${m.points} pts</div>
`

container.appendChild(card)

})
}

document.getElementById("prevWeek").onclick=()=>{
if(currentWeek>1){
currentWeek--
loadMatchups()
}
}

document.getElementById("nextWeek").onclick=()=>{
if(currentWeek<18){
currentWeek++
loadMatchups()
}
}

async function loadTournament(){

let data=await fetchJSON("./tournament.json")

let html=""

data.rounds.forEach(r=>{

html+=`<h3>${r.name}</h3>`

r.matches.forEach(m=>{
html+=`<p>${m.team1} vs ${m.team2}</p>`
})

})

document.getElementById("tournamentBracket").innerHTML=html
}

async function init(){

loadStandings(CHAMPIONS_ID,"championsStandings")
loadStandings(DEVELOPMENT_ID,"developmentStandings")

loadMatchups()
loadTournament()

}

init()
