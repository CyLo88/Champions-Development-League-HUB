# Champions & Development League Hub

A GitHub Pages-ready fantasy football site built around two Sleeper leagues, live scoreboards, transactions, league history, and a public-safe bylaws page.

## Files

- `index.html` — one-page app shell
- `styles.css` — site styling
- `app.js` — navigation, Sleeper API fetches, history chain, tournament placeholder, bylaws content

## Current configuration

- Champions League ID: `1253490267638464512`
- Development League ID: `1253490390737100800`
- Season focus: `2025`
- History start season: `2023`
- Refresh interval: `60 seconds`

## What works in this starter version

- Home page with both league scoreboards
- Champions League page with subtabs for scoreboard, standings, teams, and transactions
- Development League page with subtabs for scoreboard, standings, teams, and transactions
- League history page that walks backward through Sleeper's `previous_league_id`
- All-time records and league participation counts
- Public-safe bylaws page
- Manual midseason tournament placeholder page

## Important notes

### Team rosters
This starter version displays Sleeper player IDs on team pages. To show actual player names and positions, add a player lookup layer using Sleeper's player data file or your own cached mapping.

### History logic
The history page treats the top regular-season team in each historical league as that season's "champion" for the initial framework. If you want true playoff champions, wire in Sleeper's playoff bracket endpoints and/or a commissioner-maintained override file.

### Midseason tournament
The tournament section is manual. Edit the `CONFIG.tournament.rounds` structure in `app.js` with real teams, seeds, roster IDs, and weeks when ready.

## How to publish on GitHub Pages

1. Create a new GitHub repository.
2. Upload these files to the repository root.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/root` folder.
6. Save. GitHub Pages will publish the site.

Your live URL will look like:

`https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`

## Suggested next improvements

- Add real player names instead of Sleeper player IDs.
- Add playoff-bracket based champions for league history.
- Add manual tournament editor JSON file.
- Add logos or avatars for teams.
- Add mobile nav polish and theme customization.
