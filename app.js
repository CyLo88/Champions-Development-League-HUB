
async function fetchJSON(url){
 try{let r=await fetch(url);return await r.json();}catch{return null;}
}
async function init(){
 let data = await fetchJSON("https://api.sleeper.app/v1/league/1253490267638464512/rosters");
 document.getElementById("championsStandings").innerText = data ? "Data Loaded" : "Unable to load data";
}
init();
