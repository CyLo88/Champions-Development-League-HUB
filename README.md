# Champions & Development League Hub

## Version 2 notes

This build includes:
- refreshed home page and score cards
- Champions and Development league subtabs
- team detail modal with Sleeper roster lookups
- manual midseason tournament bracket scaffold with live score slots
- history page using each league's `previous_league_id`
- public-safe bylaws page

## How to update your live site

1. Open your GitHub repository.
2. Replace `index.html`, `styles.css`, and `app.js` with the updated versions from this package.
3. Commit the changes.
4. GitHub Pages will republish automatically.

## Midseason tournament editing

Open `app.js` and update `CONFIG.tournament.rounds`.
For each matchup, set:
- `teamA`
- `leagueA` (`champions` or `development`)
- `rosterIdA`
- `teamB`
- `leagueB`
- `rosterIdB`
- `week`

Once roster IDs are filled in, the site will show live tournament points for those matchups.
