const CONFIG = {
  siteName: 'Champions & Development League Hub',
  seasonFocus: 2025,
  refreshMs: 60000,
  historyStartSeason: 2023,
  leagues: {
    champions: {
      key: 'champions',
      name: 'Champions League',
      leagueId: '1253490267638464512',
      season: 2025,
    },
    development: {
      key: 'development',
      name: 'Development League',
      leagueId: '1253490390737100800',
      season: 2025,
    },
  },
  tournament: {
    enabled: true,
    description: 'Manual bracket shell. Edit these matchups in app.js once you are ready to wire in your custom tournament.',
    rounds: [
      {
        name: 'Play-In Round',
        week: 5,
        matchups: [
          { seedA: 13, teamA: 'Seed 13', leagueA: 'champions', rosterIdA: null, seedB: 20, teamB: 'Seed 20', leagueB: 'development', rosterIdB: null },
          { seedA: 14, teamA: 'Seed 14', leagueA: 'champions', rosterIdA: null, seedB: 19, teamB: 'Seed 19', leagueB: 'development', rosterIdB: null },
          { seedA: 15, teamA: 'Seed 15', leagueA: 'champions', rosterIdA: null, seedB: 18, teamB: 'Seed 18', leagueB: 'development', rosterIdB: null },
          { seedA: 16, teamA: 'Seed 16', leagueA: 'champions', rosterIdA: null, seedB: 17, teamB: 'Seed 17', leagueB: 'development', rosterIdB: null },
        ],
      },
      {
        name: 'Sweet 16',
        week: 6,
        matchups: [
          { seedA: 1, teamA: 'Seed 1', leagueA: 'champions', rosterIdA: null, seedB: null, teamB: 'Winner of 16/17', leagueB: null, rosterIdB: null },
          { seedA: 2, teamA: 'Seed 2', leagueA: 'champions', rosterIdA: null, seedB: null, teamB: 'Winner of 15/18', leagueB: null, rosterIdB: null },
        ],
      },
    ],
  },
};

const BYLAWS = [
  {
    title: 'Article I — Contacting League Officers',
    body: 'For league-specific issues, managers should contact the commissioner or co-commissioners through league chat. Public contact details have been intentionally removed from this page.',
  },
  {
    title: 'Article II — League Entry & Other Fees',
    list: [
      'Champions League: $100 base fee plus $25 Midseason Madness fee.',
      'Development League: $75 base fee plus $25 Midseason Madness fee.',
    ],
  },
  {
    title: 'Article III — Prize Payout Structure',
    list: [
      'Champions League: 1st $400, 2nd $200, 3rd $120, plus $20 weekly regular-season high score prize.',
      'Development League: 1st $400, 2nd $200, 3rd $100, 4th $50.',
    ],
  },
  {
    title: 'Article IV — League Fee Due Date',
    body: 'League fees are due before the draft. Any unpaid team before draft day is removed from the league.',
  },
  {
    title: 'Article V — Midseason Tournament',
    list: [
      '20-team single-elimination tournament spanning both leagues.',
      'Seeded 1–20 after Week 4 using record, then points scored as tiebreaker.',
      'Played during NFL Weeks 5–10 and tracked manually outside Sleeper.',
      'Weekly tournament results should mirror each team’s actual Sleeper lineup and matchup score for that week.',
    ],
  },
  {
    title: 'Article VI — Playoff Configuration',
    body: 'Each league uses an 8-team championship playoff bracket beginning in Week 15. Standings are ordered by record, with total points as the tiebreaker.',
  },
  {
    title: 'Article VII — League Draft and Draft Order Determination',
    body: 'The draft is held between preseason Week 3 and the start of the regular season. Managers must draft full starting roster requirements including kicker and defense. Draft slot selection is determined by a weighted lottery system.',
  },
  {
    title: 'Article VIII — Trades',
    body: 'Trades must be accepted through the league host platform and may be vetoed only for cheating or collusion. Trades agreed to after a player has started are processed after the week concludes.',
  },
  {
    title: 'Article IX — Relegation and Promotion',
    body: 'Bottom 2 Champions League teams are relegated to Development League, while the top 2 Development League teams reaching the championship are promoted to Champions League.',
  },
  {
    title: 'Article X — New Rule Creation',
    body: 'Rules not covered by the bylaws should be discussed by the leagues and resolved by majority vote through an online poll.',
  },
  {
    title: 'Article XI — Roster',
    list: ['1 QB', '2 RB', '2 WR', '1 TE', '1 Flex', '1 K', '1 DEF', '6 Bench', '1 IR'],
  },
  {
    title: 'Article XII — Roster Oversights',
    body: 'Managers are required to start a full active lineup every week. Each roster oversight results in a 10-point deduction.',
  },
  {
    title: 'Article XIII — Scoring System',
    body: 'League scoring uses half-PPR with standard passing, rushing, receiving, kicking, defense, special teams, and turnover modifiers as defined in Sleeper.',
  },
  {
    title: 'Article XIV — Waivers',
    body: 'The league uses a $250 FAAB blind-bid waiver system with rolling waiver priority as the tiebreaker. Playoff teams receive an additional $50 FAAB for the playoff period.',
  },
];

const state = {
  currentView: 'home',
  activeWeek: null,
  nflState: null,
  leagues: {},
  history: { seasons: [], teamStats: {} },
};

const els = {
  globalStatus: document.getElementById('global-status'),
  lastUpdated: document.getElementById('last-updated'),
  seasonFocus: document.getElementById('season-focus'),
  activeWeek: document.getElementById('active-week'),
};

function formatDateTime(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date);
}

function formatScore(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toFixed(2);
}

function formatRecord(roster) {
  const settings = roster.settings || {};
  return `${settings.wins ?? 0}-${settings.losses ?? 0}${settings.ties ? `-${settings.ties}` : ''}`;
}

function sortStandings(rows) {
  return [...rows].sort((a, b) => {
    const aw = a.roster.settings?.wins ?? 0;
    const bw = b.roster.settings?.wins ?? 0;
    if (bw !== aw) return bw - aw;
    const ap = (a.roster.settings?.fpts ?? 0) + ((a.roster.settings?.fpts_decimal ?? 0) / 100);
    const bp = (b.roster.settings?.fpts ?? 0) + ((b.roster.settings?.fpts_decimal ?? 0) / 100);
    return bp - ap;
  });
}

function emptyState(message = 'No data available yet.') {
  return `<div class="empty-state">${message}</div>`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function getApiUrl(path) {
  return `https://api.sleeper.app/v1${path}`;
}

async function loadLeagueBase(leagueConfig) {
  const [league, users, rosters] = await Promise.all([
    fetchJson(getApiUrl(`/league/${leagueConfig.leagueId}`)),
    fetchJson(getApiUrl(`/league/${leagueConfig.leagueId}/users`)),
    fetchJson(getApiUrl(`/league/${leagueConfig.leagueId}/rosters`)),
  ]);

  const userMap = new Map(users.map((user) => [user.user_id, user]));
  const rows = rosters.map((roster) => {
    const user = userMap.get(roster.owner_id) || {};
    return {
      roster,
      user,
      teamName: user.metadata?.team_name || user.display_name || `Roster ${roster.roster_id}`,
      ownerName: user.display_name || user.username || 'Unknown',
    };
  });

  return {
    ...leagueConfig,
    league,
    users,
    rosters,
    rows: sortStandings(rows),
    userMap,
    rosterMap: new Map(rows.map((row) => [row.roster.roster_id, row])),
  };
}

function pairMatchups(matchups = [], rosterMap = new Map()) {
  const groups = new Map();
  matchups.forEach((match) => {
    const key = match.matchup_id ?? `bye-${match.roster_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(match);
  });

  return [...groups.values()].map((group, index) => {
    const [a, b] = group;
    const rowA = a ? rosterMap.get(a.roster_id) : null;
    const rowB = b ? rosterMap.get(b.roster_id) : null;
    return {
      id: group[0]?.matchup_id ?? `bye-${index}`,
      a: {
        teamName: rowA?.teamName || 'Bye',
        ownerName: rowA?.ownerName || '',
        points: a?.custom_points ?? a?.points ?? null,
      },
      b: {
        teamName: rowB?.teamName || 'Bye',
        ownerName: rowB?.ownerName || '',
        points: b?.custom_points ?? b?.points ?? null,
      },
    };
  });
}

async function loadLeagueWeekData(leagueState, week) {
  const [matchups, transactions] = await Promise.all([
    fetchJson(getApiUrl(`/league/${leagueState.leagueId}/matchups/${week}`)).catch(() => []),
    fetchJson(getApiUrl(`/league/${leagueState.leagueId}/transactions/${week}`)).catch(() => []),
  ]);

  leagueState.matchups = matchups;
  leagueState.transactions = transactions
    .filter((item) => item.status === 'complete')
    .sort((a, b) => (b.status_updated || b.created || 0) - (a.status_updated || a.created || 0));
  leagueState.pairedMatchups = pairMatchups(matchups, leagueState.rosterMap);
  return leagueState;
}

function renderScoreboard(containerId, leagueState, limit = null) {
  const el = document.getElementById(containerId);
  const matchups = limit ? leagueState.pairedMatchups.slice(0, limit) : leagueState.pairedMatchups;
  if (!matchups?.length) {
    el.innerHTML = emptyState('No matchup data available for this week yet.');
    return;
  }
  el.innerHTML = matchups.map((match) => `
    <article class="score-row">
      <div class="score-head">
        <span>Week ${state.activeWeek ?? '--'}</span>
        <span>Matchup ${match.id ?? '--'}</span>
      </div>
      <div class="team-line">
        <div>
          <strong>${match.a.teamName}</strong>
          <div class="team-meta">${match.a.ownerName}</div>
        </div>
        <div class="team-score">${formatScore(match.a.points)}</div>
      </div>
      <div class="team-line">
        <div>
          <strong>${match.b.teamName}</strong>
          <div class="team-meta">${match.b.ownerName}</div>
        </div>
        <div class="team-score">${formatScore(match.b.points)}</div>
      </div>
    </article>
  `).join('');
}

function renderStandings(containerId, leagueState, limit = null) {
  const el = document.getElementById(containerId);
  const rows = limit ? leagueState.rows.slice(0, limit) : leagueState.rows;
  if (!rows?.length) {
    el.innerHTML = emptyState('Standings are not available yet.');
    return;
  }
  el.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>#</th><th>Team</th><th>Owner</th><th>Record</th><th>PF</th><th>PA</th></tr>
        </thead>
        <tbody>
          ${rows.map((row, index) => {
            const s = row.roster.settings || {};
            const pf = (s.fpts ?? 0) + ((s.fpts_decimal ?? 0) / 100);
            const pa = (s.fpts_against ?? 0) + ((s.fpts_against_decimal ?? 0) / 100);
            return `<tr>
              <td>${index + 1}</td>
              <td>${row.teamName}</td>
              <td>${row.ownerName}</td>
              <td>${formatRecord(row.roster)}</td>
              <td>${pf.toFixed(2)}</td>
              <td>${pa.toFixed(2)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTeams(containerId, leagueState) {
  const el = document.getElementById(containerId);
  if (!leagueState.rows?.length) {
    el.innerHTML = emptyState('Team pages are not available yet.');
    return;
  }
  el.innerHTML = `<div class="team-grid">${leagueState.rows.map((row) => {
    const rosterPlayers = row.roster.players || [];
    const topPlayers = rosterPlayers.slice(0, 12);
    return `
      <article class="team-card">
        <h4>${row.teamName}</h4>
        <div class="small-muted">Owner: ${row.ownerName}</div>
        <div class="small-muted">Record: ${formatRecord(row.roster)}</div>
        <div class="small-muted">Roster ID: ${row.roster.roster_id}</div>
        <div class="roster-list">
          ${topPlayers.length ? topPlayers.map((playerId) => `<span class="roster-chip">Player ID ${playerId}</span>`).join('') : '<span class="small-muted">No roster players returned yet.</span>'}
        </div>
      </article>`;
  }).join('')}</div>`;
}

function describeTransaction(tx, leagueState) {
  const rosterNames = (tx.roster_ids || []).map((id) => leagueState.rosterMap.get(id)?.teamName || `Roster ${id}`);
  if (tx.type === 'trade') {
    return `Trade involving ${rosterNames.join(' and ')}.`;
  }
  const adds = Object.keys(tx.adds || {}).length;
  const drops = Object.keys(tx.drops || {}).length;
  if (tx.type === 'waiver') return `${rosterNames[0] || 'A team'} won a waiver claim (${adds} add / ${drops} drop).`;
  if (tx.type === 'free_agent') return `${rosterNames[0] || 'A team'} made a free agent move (${adds} add / ${drops} drop).`;
  return `${tx.type || 'Transaction'} involving ${rosterNames.join(', ')}.`;
}

function renderTransactions(containerId, leagueState, limit = 12) {
  const el = document.getElementById(containerId);
  const items = (leagueState.transactions || []).slice(0, limit);
  if (!items.length) {
    el.innerHTML = emptyState('No completed transactions found for the current week.');
    return;
  }
  el.innerHTML = items.map((tx) => `
    <article class="tx-item">
      <div class="tx-meta">${tx.type?.replace('_', ' ')} · ${formatDateTime(new Date(tx.status_updated || tx.created || Date.now()))}</div>
      <strong>${describeTransaction(tx, leagueState)}</strong>
      <div class="small-muted">Week ${tx.leg ?? state.activeWeek ?? '--'} · Transaction ID ${tx.transaction_id}</div>
    </article>
  `).join('');
}

function setMovementLists() {
  const championsRows = state.leagues.champions?.rows || [];
  const developmentRows = state.leagues.development?.rows || [];
  const promoted = developmentRows.slice(0, 2).map((row) => row.teamName);
  const relegated = championsRows.slice(-2).map((row) => row.teamName);
  document.getElementById('promoted-list').innerHTML = promoted.map((team) => `<li>⬆ ${team}</li>`).join('') || '<li>To be determined</li>';
  document.getElementById('relegated-list').innerHTML = relegated.map((team) => `<li>⬇ ${team}</li>`).join('') || '<li>To be determined</li>';
}

function renderBylaws() {
  const el = document.getElementById('bylaws-content');
  el.innerHTML = BYLAWS.map((item) => `
    <section class="bylaw-card">
      <h3>${item.title}</h3>
      ${item.body ? `<p class="lead compact">${item.body}</p>` : ''}
      ${item.list ? `<ul>${item.list.map((entry) => `<li>${entry}</li>`).join('')}</ul>` : ''}
    </section>
  `).join('');
}

function renderTournament() {
  const el = document.getElementById('tournament-content');
  const rounds = CONFIG.tournament.rounds || [];
  el.innerHTML = rounds.map((round) => `
    <section class="bracket-round">
      <h3>${round.name}</h3>
      <div class="small-muted">Week ${round.week}</div>
      <div class="stack gap-sm" style="margin-top:12px;">
        ${round.matchups.map((match) => `
          <div class="bracket-match">
            <strong>${match.teamA}</strong> <span class="small-muted">(${match.seedA ?? '--'})</span>
            <div class="small-muted">${match.leagueA || 'manual'} ${match.rosterIdA ? `· roster ${match.rosterIdA}` : ''}</div>
            <div style="margin:8px 0; color: var(--muted);">vs</div>
            <strong>${match.teamB}</strong> <span class="small-muted">(${match.seedB ?? '--'})</span>
            <div class="small-muted">${match.leagueB || 'manual'} ${match.rosterIdB ? `· roster ${match.rosterIdB}` : ''}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `).join('');
}

function updateHome() {
  renderScoreboard('home-champions-scoreboard', state.leagues.champions, 3);
  renderScoreboard('home-development-scoreboard', state.leagues.development, 3);
  renderStandings('home-champions-standings', state.leagues.champions, 5);
  renderStandings('home-development-standings', state.leagues.development, 5);

  const allTransactions = [
    ...(state.leagues.champions?.transactions || []).map((tx) => ({ tx, league: state.leagues.champions })),
    ...(state.leagues.development?.transactions || []).map((tx) => ({ tx, league: state.leagues.development })),
  ]
    .sort((a, b) => (b.tx.status_updated || b.tx.created || 0) - (a.tx.status_updated || a.tx.created || 0))
    .slice(0, 10);

  const el = document.getElementById('home-transactions');
  el.innerHTML = allTransactions.length ? allTransactions.map(({ tx, league }) => `
    <article class="tx-item">
      <div class="tx-meta">${league.name} · ${tx.type?.replace('_', ' ')} · ${formatDateTime(new Date(tx.status_updated || tx.created || Date.now()))}</div>
      <strong>${describeTransaction(tx, league)}</strong>
    </article>
  `).join('') : emptyState('No recent transactions available yet.');

  setMovementLists();
}

function renderLeagueViews(leagueKey) {
  const leagueState = state.leagues[leagueKey];
  renderScoreboard(`${leagueKey}-scoreboard`, leagueState);
  renderStandings(`${leagueKey}-standings`, leagueState);
  renderTeams(`${leagueKey}-teams`, leagueState);
  renderTransactions(`${leagueKey}-transactions`, leagueState, 20);
}

async function loadHistoryChain(baseLeagueConfig) {
  const seasons = [];
  let nextId = baseLeagueConfig.leagueId;
  let safety = 0;

  while (nextId && safety < 8) {
    safety += 1;
    const league = await fetchJson(getApiUrl(`/league/${nextId}`)).catch(() => null);
    if (!league) break;
    const season = Number(league.season);
    if (season < CONFIG.historyStartSeason) break;

    const [users, rosters] = await Promise.all([
      fetchJson(getApiUrl(`/league/${nextId}/users`)).catch(() => []),
      fetchJson(getApiUrl(`/league/${nextId}/rosters`)).catch(() => []),
    ]);
    const userMap = new Map(users.map((u) => [u.user_id, u]));
    const rows = sortStandings(rosters.map((roster) => {
      const user = userMap.get(roster.owner_id) || {};
      return {
        roster,
        teamName: user.metadata?.team_name || user.display_name || `Roster ${roster.roster_id}`,
        ownerName: user.display_name || user.username || 'Unknown',
      };
    }));

    seasons.push({
      season,
      leagueId: nextId,
      rows,
      champion: rows[0]?.teamName || 'TBD',
      runnerUp: rows[1]?.teamName || 'TBD',
    });

    nextId = league.previous_league_id;
  }

  return seasons.sort((a, b) => b.season - a.season);
}

function buildHistory() {
  const championsHistory = state.history.champions || [];
  const developmentHistory = state.history.development || [];
  const seasonSet = new Set([...championsHistory.map((s) => s.season), ...developmentHistory.map((s) => s.season)]);
  const seasons = [...seasonSet].sort((a, b) => b - a).map((season) => {
    const c = championsHistory.find((item) => item.season === season);
    const d = developmentHistory.find((item) => item.season === season);
    const promoted = d?.rows?.slice(0, 2).map((r) => r.teamName) || [];
    const relegated = c?.rows?.slice(-2).map((r) => r.teamName) || [];
    return {
      season,
      championsChampion: c?.champion || 'TBD',
      developmentChampion: d?.champion || 'TBD',
      promoted,
      relegated,
      championsTop: c?.rows?.slice(0, 3) || [],
      developmentTop: d?.rows?.slice(0, 3) || [],
    };
  });
  state.history.seasons = seasons;

  const teamStats = {};
  for (const season of seasons) {
    season.championsTop.forEach(() => {});
    const c = championsHistory.find((item) => item.season === season.season);
    const d = developmentHistory.find((item) => item.season === season.season);
    (c?.rows || []).forEach((row, index) => {
      const key = row.teamName;
      teamStats[key] ||= { titles: 0, promotions: 0, relegations: 0, championsSeasons: 0, developmentSeasons: 0 };
      teamStats[key].championsSeasons += 1;
      if (index === 0) teamStats[key].titles += 1;
      if (index >= (c.rows.length - 2)) teamStats[key].relegations += 1;
    });
    (d?.rows || []).forEach((row, index) => {
      const key = row.teamName;
      teamStats[key] ||= { titles: 0, promotions: 0, relegations: 0, championsSeasons: 0, developmentSeasons: 0 };
      teamStats[key].developmentSeasons += 1;
      if (index === 0) teamStats[key].titles += 1;
      if (index < 2) teamStats[key].promotions += 1;
    });
  }
  state.history.teamStats = teamStats;
}

function renderHistory() {
  buildHistory();
  const seasonsEl = document.getElementById('history-seasons');
  seasonsEl.innerHTML = state.history.seasons.map((season) => `
    <article class="bylaw-card">
      <h3>${season.season}</h3>
      <p class="lead compact"><strong>Champions League Champion:</strong> ${season.championsChampion}</p>
      <p class="lead compact"><strong>Development League Champion:</strong> ${season.developmentChampion}</p>
      <p class="lead compact"><strong>Promoted:</strong> ${season.promoted.join(', ') || 'TBD'}</p>
      <p class="lead compact"><strong>Relegated:</strong> ${season.relegated.join(', ') || 'TBD'}</p>
    </article>
  `).join('') || emptyState('History chain not available yet.');

  const statsRows = Object.entries(state.history.teamStats)
    .sort((a, b) => (b[1].titles - a[1].titles) || a[0].localeCompare(b[0]));

  document.getElementById('history-records').innerHTML = statsRows.length ? `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Team</th><th>Titles</th><th>Promotions</th><th>Relegations</th></tr></thead>
        <tbody>
          ${statsRows.map(([team, stats]) => `<tr><td>${team}</td><td>${stats.titles}</td><td>${stats.promotions}</td><td>${stats.relegations}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  ` : emptyState('No record data yet.');

  document.getElementById('history-participation').innerHTML = statsRows.length ? `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Team</th><th>Seasons in Champions</th><th>Seasons in Development</th></tr></thead>
        <tbody>
          ${statsRows.map(([team, stats]) => `<tr><td>${team}</td><td>${stats.championsSeasons}</td><td>${stats.developmentSeasons}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  ` : emptyState('No participation data yet.');
}

function setView(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach((el) => el.classList.toggle('active', el.id === `view-${view}`));
  document.querySelectorAll('.nav-link').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
}

function bindNavigation() {
  document.querySelectorAll('.nav-link').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });
  document.querySelectorAll('[data-view-link]').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.viewLink));
  });
  document.querySelectorAll('[data-league-subnav]').forEach((subnav) => {
    subnav.querySelectorAll('.subnav-link').forEach((button) => {
      button.addEventListener('click', () => {
        subnav.querySelectorAll('.subnav-link').forEach((btn) => btn.classList.toggle('active', btn === button));
        const leagueKey = subnav.dataset.leagueSubnav;
        document.querySelectorAll(`#view-${leagueKey} .league-panel`).forEach((panel) => {
          panel.classList.toggle('active', panel.id === `${leagueKey}-${button.dataset.subview}`);
        });
      });
    });
  });
}

async function loadAllData() {
  try {
    els.globalStatus.textContent = 'Loading live Sleeper data…';
    els.seasonFocus.textContent = CONFIG.seasonFocus;

    const nflState = await fetchJson(getApiUrl('/state/nfl'));
    state.nflState = nflState;
    state.activeWeek = nflState.display_week || nflState.week || 1;
    els.activeWeek.textContent = state.activeWeek;

    state.leagues.champions = await loadLeagueBase(CONFIG.leagues.champions);
    state.leagues.development = await loadLeagueBase(CONFIG.leagues.development);

    await Promise.all([
      loadLeagueWeekData(state.leagues.champions, state.activeWeek),
      loadLeagueWeekData(state.leagues.development, state.activeWeek),
    ]);

    renderLeagueViews('champions');
    renderLeagueViews('development');
    updateHome();

    const [championsHistory, developmentHistory] = await Promise.all([
      loadHistoryChain(CONFIG.leagues.champions),
      loadHistoryChain(CONFIG.leagues.development),
    ]);
    state.history.champions = championsHistory;
    state.history.development = developmentHistory;
    renderHistory();

    renderTournament();
    renderBylaws();

    els.globalStatus.textContent = `Live from Sleeper · Week ${state.activeWeek}`;
    els.lastUpdated.textContent = `Updated ${formatDateTime(new Date())}`;
  } catch (error) {
    console.error(error);
    els.globalStatus.textContent = 'Unable to load Sleeper data right now.';
    els.lastUpdated.textContent = 'Check browser console';
    document.querySelectorAll('#home-champions-scoreboard, #home-development-scoreboard, #home-champions-standings, #home-development-standings, #home-transactions, #champions-scoreboard, #champions-standings, #champions-teams, #champions-transactions, #development-scoreboard, #development-standings, #development-teams, #development-transactions, #history-seasons, #history-records, #history-participation, #tournament-content').forEach((el) => {
      if (el) el.innerHTML = emptyState('Data did not load. Confirm the site is being served over HTTPS and Sleeper is reachable from your browser.');
    });
    renderBylaws();
  }
}

function startRefreshCycle() {
  setInterval(async () => {
    try {
      await Promise.all([
        loadLeagueWeekData(state.leagues.champions, state.activeWeek),
        loadLeagueWeekData(state.leagues.development, state.activeWeek),
      ]);
      updateHome();
      renderLeagueViews('champions');
      renderLeagueViews('development');
      els.lastUpdated.textContent = `Updated ${formatDateTime(new Date())}`;
    } catch (error) {
      console.error('Refresh failed', error);
    }
  }, CONFIG.refreshMs);
}

bindNavigation();
loadAllData().then(startRefreshCycle);
