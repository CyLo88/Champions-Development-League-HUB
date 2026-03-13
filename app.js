const CONFIG = {
  seasonFocus: 2025,
  historyStartSeason: 2023,
  refreshMs: 60000,
  leagues: {
    champions: {
      key: 'champions',
      name: 'Champions League',
      leagueId: '1253490267638464512',
    },
    development: {
      key: 'development',
      name: 'Development League',
      leagueId: '1253490390737100800',
    },
  },
  tournament: {
    enabled: true,
    rounds: [
      {
        name: 'Sample Quarterfinals',
        week: 5,
        note: 'Replace these placeholders with the real bracket and roster IDs in app.js.',
        matchups: [
          {
            label: 'QF1',
            teamA: 'Champions Seed 1',
            leagueA: 'champions',
            rosterIdA: null,
            seedA: 1,
            teamB: 'Development Seed 8',
            leagueB: 'development',
            rosterIdB: null,
            seedB: 8,
          },
          {
            label: 'QF2',
            teamA: 'Champions Seed 2',
            leagueA: 'champions',
            rosterIdA: null,
            seedA: 2,
            teamB: 'Development Seed 7',
            leagueB: 'development',
            rosterIdB: null,
            seedB: 7,
          },
        ],
      },
    ],
  },
};

const BYLAWS = [
  {
    title: 'Article I — League Officers',
    body: 'Commissioner and co-commissioner contact details have been intentionally removed from the public website version. Contact league leadership through league chat for disputes or rule questions.',
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
      'Seeded 1–20 after Week 4 using record, then points scored as the tiebreaker.',
      'Played during NFL Weeks 5–10 and tracked manually outside Sleeper.',
      'Weekly tournament results mirror each team’s actual Sleeper lineup and matchup score for that week.',
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
    body: 'The bottom 2 Champions League teams are relegated to Development League, while the 2 Development League finalists are promoted to Champions League.',
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
  modal: document.getElementById('team-modal'),
  modalContent: document.getElementById('team-modal-content'),
};

const PLAYERS_DB_CACHE = { loaded: false, map: null, promise: null };

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

function getApiUrl(path) {
  return `https://api.sleeper.app/v1${path}`;
}

function emptyState(message = 'No data available yet.') {
  return `<div class="empty-state">${message}</div>`;
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

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function getAvatarUrl(avatarId) {
  return avatarId ? `https://sleepercdn.com/avatars/thumbs/${avatarId}` : '';
}

function getTeamName(user, rosterId) {
  return user?.metadata?.team_name || user?.display_name || `Roster ${rosterId}`;
}

async function ensurePlayersDb() {
  if (PLAYERS_DB_CACHE.loaded) return PLAYERS_DB_CACHE.map;
  if (PLAYERS_DB_CACHE.promise) return PLAYERS_DB_CACHE.promise;
  PLAYERS_DB_CACHE.promise = fetchJson(getApiUrl('/players/nfl'))
    .then((data) => {
      PLAYERS_DB_CACHE.loaded = true;
      PLAYERS_DB_CACHE.map = data;
      return data;
    })
    .catch(() => {
      PLAYERS_DB_CACHE.loaded = false;
      PLAYERS_DB_CACHE.map = null;
      return null;
    });
  return PLAYERS_DB_CACHE.promise;
}

function playerLabel(playerId, playersMap) {
  if (!playerId) return 'Unknown player';
  if (!playersMap || !playersMap[playerId]) return `Player ${playerId}`;
  const p = playersMap[playerId];
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.full_name || p.search_full_name || `Player ${playerId}`;
  const bits = [p.position, p.team].filter(Boolean).join(' · ');
  return bits ? `${name} (${bits})` : name;
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
      teamName: getTeamName(user, roster.roster_id),
      ownerName: user.display_name || user.username || 'Unknown',
      avatarUrl: getAvatarUrl(user.avatar || user.metadata?.avatar),
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
    matchups: [],
    transactions: [],
    pairedMatchups: [],
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
        rosterId: a?.roster_id ?? null,
        teamName: rowA?.teamName || 'Bye',
        ownerName: rowA?.ownerName || '',
        points: a?.custom_points ?? a?.points ?? null,
      },
      b: {
        rosterId: b?.roster_id ?? null,
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

function renderScoreboardCard(match) {
  const aWin = Number(match.a.points ?? -Infinity) > Number(match.b.points ?? -Infinity);
  const bWin = Number(match.b.points ?? -Infinity) > Number(match.a.points ?? -Infinity);
  return `
    <article class="score-card">
      <div class="score-head">
        <span>Week ${state.activeWeek ?? '--'}</span>
        <span>Matchup ${match.id ?? '--'}</span>
      </div>
      <div class="team-line ${aWin ? 'score-winner' : ''}">
        <div>
          <strong>${match.a.teamName}</strong>
          <div class="team-meta">${match.a.ownerName || ''} ${match.a.rosterId ? `· Roster ${match.a.rosterId}` : ''}</div>
        </div>
        <div class="team-score live">${formatScore(match.a.points)}</div>
      </div>
      <div class="team-line ${bWin ? 'score-winner' : ''}">
        <div>
          <strong>${match.b.teamName}</strong>
          <div class="team-meta">${match.b.ownerName || ''} ${match.b.rosterId ? `· Roster ${match.b.rosterId}` : match.b.teamName === 'Bye' ? '<span class="bye-note">No opponent this week</span>' : ''}</div>
        </div>
        <div class="team-score live">${formatScore(match.b.points)}</div>
      </div>
    </article>
  `;
}

function renderScoreboard(containerId, leagueState, limit = null) {
  const el = document.getElementById(containerId);
  const matchups = limit ? leagueState.pairedMatchups.slice(0, limit) : leagueState.pairedMatchups;
  if (!matchups?.length) {
    el.innerHTML = emptyState('No matchup data available for this week yet.');
    return;
  }
  el.innerHTML = `<div class="score-grid">${matchups.map(renderScoreboardCard).join('')}</div>`;
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
          <tr><th>#</th><th>Team</th><th>Owner</th><th>Record</th><th>PF</th><th>PA</th><th>Moves</th></tr>
        </thead>
        <tbody>
          ${rows.map((row, index) => {
            const s = row.roster.settings || {};
            const pf = (s.fpts ?? 0) + ((s.fpts_decimal ?? 0) / 100);
            const pa = (s.fpts_against ?? 0) + ((s.fpts_against_decimal ?? 0) / 100);
            const badgeClass = index < 2 ? 'top' : (index >= rows.length - 2 ? 'bottom' : '');
            return `<tr>
              <td><span class="rank-badge ${badgeClass}">${index + 1}</span></td>
              <td>${row.teamName}</td>
              <td>${row.ownerName}</td>
              <td>${formatRecord(row.roster)}</td>
              <td>${pf.toFixed(2)}</td>
              <td>${pa.toFixed(2)}</td>
              <td>${s.total_moves ?? 0}</td>
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
  el.innerHTML = `<div class="team-grid">${leagueState.rows.map((row, index) => {
    const rosterPlayers = row.roster.players || [];
    const starters = row.roster.starters || [];
    const s = row.roster.settings || {};
    const pf = (s.fpts ?? 0) + ((s.fpts_decimal ?? 0) / 100);
    return `
      <article class="team-card">
        <div class="team-top">
          <div>
            <h4>${index + 1}. ${row.teamName}</h4>
            <div class="small-muted">Owner: ${row.ownerName}</div>
            <div class="small-muted">Record: ${formatRecord(row.roster)} · PF: ${pf.toFixed(2)}</div>
          </div>
          ${row.avatarUrl ? `<img class="team-avatar" src="${row.avatarUrl}" alt="${row.teamName} avatar" />` : '<div class="team-avatar"></div>'}
        </div>
        <div class="roster-preview">
          <span class="roster-chip">Roster ${row.roster.roster_id}</span>
          <span class="roster-chip">${rosterPlayers.length} players</span>
          <span class="roster-chip">${starters.length} starters</span>
        </div>
        <button class="team-button" data-team-league="${leagueState.key}" data-team-roster="${row.roster.roster_id}">Open team card</button>
      </article>`;
  }).join('')}</div>`;
}

function summarizeAddsOrDrops(obj = {}) {
  return Object.keys(obj).slice(0, 3).join(', ');
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
      <div class="tx-meta">${leagueState.name} · ${String(tx.type || '').replace('_', ' ')} · ${formatDateTime(new Date(tx.status_updated || tx.created || Date.now()))}</div>
      <strong>${describeTransaction(tx, leagueState)}</strong>
      <div class="small-muted">Week ${tx.leg ?? state.activeWeek ?? '--'} · Adds: ${summarizeAddsOrDrops(tx.adds)}${Object.keys(tx.adds || {}).length > 3 ? '…' : ''}</div>
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

function lookupRosterWeekPoints(leagueKey, rosterId, week) {
  const leagueState = state.leagues[leagueKey];
  if (!leagueState || !leagueState.matchups?.length) return null;
  const hit = leagueState.matchups.find((m) => Number(m.roster_id) === Number(rosterId));
  if (!hit) return null;
  return hit.custom_points ?? hit.points ?? null;
}

function renderTournament() {
  const el = document.getElementById('tournament-content');
  const rounds = CONFIG.tournament.rounds || [];
  if (!rounds.length) {
    el.innerHTML = emptyState('No tournament bracket configured yet.');
    return;
  }
  el.innerHTML = rounds.map((round) => `
    <section class="bracket-round">
      <div>
        <h3>${round.name}</h3>
        <div class="small-muted">Week ${round.week}${round.note ? ` · ${round.note}` : ''}</div>
      </div>
      ${round.matchups.map((match) => {
        const scoreA = match.rosterIdA ? lookupRosterWeekPoints(match.leagueA, match.rosterIdA, round.week) : null;
        const scoreB = match.rosterIdB ? lookupRosterWeekPoints(match.leagueB, match.rosterIdB, round.week) : null;
        const aWin = Number(scoreA ?? -Infinity) > Number(scoreB ?? -Infinity);
        const bWin = Number(scoreB ?? -Infinity) > Number(scoreA ?? -Infinity);
        return `
          <div class="bracket-match">
            <div class="score-head"><span>${match.label}</span><span>Week ${round.week}</span></div>
            <div class="tourney-score ${aWin ? 'score-winner' : ''}">
              <div>
                <strong>${match.teamA}</strong>
                <div class="team-meta">${match.leagueA || 'manual'}${match.rosterIdA ? ` · roster ${match.rosterIdA}` : ' · set roster ID in app.js'}</div>
              </div>
              <div class="team-score live">${formatScore(scoreA)}</div>
            </div>
            <div class="tourney-score ${bWin ? 'score-winner' : ''}">
              <div>
                <strong>${match.teamB}</strong>
                <div class="team-meta">${match.leagueB || 'manual'}${match.rosterIdB ? ` · roster ${match.rosterIdB}` : ' · set roster ID in app.js'}</div>
              </div>
              <div class="team-score live">${formatScore(scoreB)}</div>
            </div>
          </div>
        `;
      }).join('')}
    </section>
  `).join('');
}

function updateHome() {
  renderScoreboard('home-champions-scoreboard', state.leagues.champions, 4);
  renderScoreboard('home-development-scoreboard', state.leagues.development, 4);
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
      <div class="tx-meta">${league.name} · ${String(tx.type || '').replace('_', ' ')} · ${formatDateTime(new Date(tx.status_updated || tx.created || Date.now()))}</div>
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

function findChampionFromBracket(bracket = [], rosterMap = new Map()) {
  if (!Array.isArray(bracket) || !bracket.length) return null;
  const finalMatch = [...bracket].sort((a, b) => (b.r - a.r) || (b.m - a.m))[0];
  if (!finalMatch?.w) return null;
  return rosterMap.get(finalMatch.w)?.teamName || `Roster ${finalMatch.w}`;
}

function findRunnerUpFromBracket(bracket = [], rosterMap = new Map()) {
  if (!Array.isArray(bracket) || !bracket.length) return null;
  const finalMatch = [...bracket].sort((a, b) => (b.r - a.r) || (b.m - a.m))[0];
  if (!finalMatch?.l) return null;
  return rosterMap.get(finalMatch.l)?.teamName || `Roster ${finalMatch.l}`;
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

    const [users, rosters, winnersBracket] = await Promise.all([
      fetchJson(getApiUrl(`/league/${nextId}/users`)).catch(() => []),
      fetchJson(getApiUrl(`/league/${nextId}/rosters`)).catch(() => []),
      fetchJson(getApiUrl(`/league/${nextId}/winners_bracket`)).catch(() => []),
    ]);
    const userMap = new Map(users.map((u) => [u.user_id, u]));
    const rows = sortStandings(rosters.map((roster) => {
      const user = userMap.get(roster.owner_id) || {};
      return {
        roster,
        user,
        teamName: getTeamName(user, roster.roster_id),
        ownerName: user.display_name || user.username || 'Unknown',
      };
    }));
    const rosterMap = new Map(rows.map((row) => [row.roster.roster_id, row]));
    const champion = findChampionFromBracket(winnersBracket, rosterMap) || rows[0]?.teamName || 'TBD';
    const runnerUp = findRunnerUpFromBracket(winnersBracket, rosterMap) || rows[1]?.teamName || 'TBD';

    seasons.push({
      season,
      leagueId: nextId,
      rows,
      champion,
      runnerUp,
      winnersBracket,
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
    const promoted = [d?.champion, d?.runnerUp].filter(Boolean);
    const relegated = c?.rows?.slice(-2).map((r) => r.teamName) || [];
    return {
      season,
      championsChampion: c?.champion || 'TBD',
      developmentChampion: d?.champion || 'TBD',
      promoted,
      relegated,
      championsTop: c?.rows?.slice(0, 3) || [],
      developmentTop: d?.rows?.slice(0, 3) || [],
      championsRunnerUp: c?.runnerUp || 'TBD',
      developmentRunnerUp: d?.runnerUp || 'TBD',
    };
  });
  state.history.seasons = seasons;

  const teamStats = {};
  for (const season of seasons) {
    const c = championsHistory.find((item) => item.season === season.season);
    const d = developmentHistory.find((item) => item.season === season.season);
    (c?.rows || []).forEach((row, index) => {
      const key = row.teamName;
      teamStats[key] ||= { titles: 0, promotions: 0, relegations: 0, championsSeasons: 0, developmentSeasons: 0 };
      teamStats[key].championsSeasons += 1;
      if (row.teamName === c.champion) teamStats[key].titles += 1;
      if (index >= (c.rows.length - 2)) teamStats[key].relegations += 1;
    });
    (d?.rows || []).forEach((row) => {
      const key = row.teamName;
      teamStats[key] ||= { titles: 0, promotions: 0, relegations: 0, championsSeasons: 0, developmentSeasons: 0 };
      teamStats[key].developmentSeasons += 1;
      if (row.teamName === d.champion) teamStats[key].titles += 1;
      if (row.teamName === d.champion || row.teamName === d.runnerUp) teamStats[key].promotions += 1;
    });
  }
  state.history.teamStats = teamStats;
}

function renderHistory() {
  buildHistory();
  const seasonsEl = document.getElementById('history-seasons');
  seasonsEl.innerHTML = state.history.seasons.map((season) => `
    <article class="history-card">
      <h3>${season.season}</h3>
      <p class="lead compact"><strong>Champions title:</strong> ${season.championsChampion}</p>
      <p class="lead compact"><strong>Development title:</strong> ${season.developmentChampion}</p>
      <p class="lead compact"><strong>Promoted:</strong> ${season.promoted.join(', ') || 'TBD'}</p>
      <p class="lead compact"><strong>Relegated:</strong> ${season.relegated.join(', ') || 'TBD'}</p>
      <ul class="history-mini">
        <li><strong>Champions runner-up:</strong> ${season.championsRunnerUp}</li>
        <li><strong>Development runner-up:</strong> ${season.developmentRunnerUp}</li>
        <li><strong>Champions top regular season:</strong> ${(season.championsTop || []).map((t) => t.teamName).join(', ') || 'TBD'}</li>
        <li><strong>Development top regular season:</strong> ${(season.developmentTop || []).map((t) => t.teamName).join(', ') || 'TBD'}</li>
      </ul>
    </article>
  `).join('') || emptyState('History chain not available yet.');

  const statsRows = Object.entries(state.history.teamStats)
    .sort((a, b) => (b[1].titles - a[1].titles) || (b[1].promotions - a[1].promotions) || a[0].localeCompare(b[0]));

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

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-team-league][data-team-roster]');
    if (trigger) {
      openTeamModal(trigger.dataset.teamLeague, trigger.dataset.teamRoster);
      return;
    }
    if (event.target.closest('[data-close-modal="true"]')) {
      closeTeamModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeTeamModal();
  });
}

async function openTeamModal(leagueKey, rosterId) {
  const leagueState = state.leagues[leagueKey];
  if (!leagueState) return;
  const row = leagueState.rosterMap.get(Number(rosterId));
  if (!row) return;

  els.modal.classList.remove('hidden');
  els.modal.setAttribute('aria-hidden', 'false');
  els.modalContent.innerHTML = emptyState('Loading team card…');

  const playersMap = await ensurePlayersDb();
  const s = row.roster.settings || {};
  const pf = (s.fpts ?? 0) + ((s.fpts_decimal ?? 0) / 100);
  const pa = (s.fpts_against ?? 0) + ((s.fpts_against_decimal ?? 0) / 100);
  const starters = (row.roster.starters || []).map((id) => playerLabel(id, playersMap));
  const bench = (row.roster.players || []).filter((id) => !(row.roster.starters || []).includes(id)).map((id) => playerLabel(id, playersMap));
  const recentTransactions = (leagueState.transactions || []).filter((tx) => (tx.roster_ids || []).includes(Number(rosterId)) || (tx.roster_ids || []).includes(String(rosterId))).slice(0, 6);

  els.modalContent.innerHTML = `
    <div class="modal-grid">
      <div>
        <div class="section-kicker">${leagueState.name}</div>
        <h2>${row.teamName}</h2>
        <p class="lead compact">Owner: ${row.ownerName}</p>
        <div class="modal-stat-grid">
          <div class="modal-stat"><div class="section-kicker">Record</div><h3>${formatRecord(row.roster)}</h3></div>
          <div class="modal-stat"><div class="section-kicker">Roster ID</div><h3>${row.roster.roster_id}</h3></div>
          <div class="modal-stat"><div class="section-kicker">Points For</div><h3>${pf.toFixed(2)}</h3></div>
          <div class="modal-stat"><div class="section-kicker">Points Against</div><h3>${pa.toFixed(2)}</h3></div>
        </div>
        <div style="margin-top:18px;">
          <h3>Starters</h3>
          <div class="modal-list">
            ${starters.length ? starters.map((name) => `<span class="roster-chip">${name}</span>`).join('') : '<span class="small-muted">No starters returned yet.</span>'}
          </div>
        </div>
        <div style="margin-top:18px;">
          <h3>Bench / Reserve</h3>
          <div class="modal-list">
            ${bench.length ? bench.map((name) => `<span class="roster-chip">${name}</span>`).join('') : '<span class="small-muted">No bench players returned yet.</span>'}
          </div>
        </div>
      </div>
      <div>
        <h3>Recent Transactions</h3>
        <div style="margin-top:12px;">
          ${recentTransactions.length ? recentTransactions.map((tx) => `
            <article class="tx-item">
              <div class="tx-meta">${String(tx.type || '').replace('_', ' ')} · ${formatDateTime(new Date(tx.status_updated || tx.created || Date.now()))}</div>
              <strong>${describeTransaction(tx, leagueState)}</strong>
            </article>
          `).join('') : emptyState('No recent current-week transactions for this roster.')}
        </div>
      </div>
    </div>
  `;
}

function closeTeamModal() {
  els.modal.classList.add('hidden');
  els.modal.setAttribute('aria-hidden', 'true');
}

async function loadAllData() {
  try {
    els.globalStatus.textContent = 'Loading live Sleeper data…';
    els.seasonFocus.textContent = `Season ${CONFIG.seasonFocus}`;

    const nflState = await fetchJson(getApiUrl('/state/nfl'));
    state.nflState = nflState;
    state.activeWeek = nflState.display_week || nflState.week || 1;
    els.activeWeek.textContent = `Week ${state.activeWeek}`;

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

    els.globalStatus.textContent = `Live from Sleeper`;
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
      renderTournament();
      els.lastUpdated.textContent = `Updated ${formatDateTime(new Date())}`;
    } catch (error) {
      console.error('Refresh failed', error);
    }
  }, CONFIG.refreshMs);
}

bindNavigation();
loadAllData().then(startRefreshCycle);
