// games.js — Netlify serverless function
// Tier 1: The Odds API (ODDS_API_KEY env var) — cached 1 hour in /tmp
// Tier 2: MLB Stats API odds field
// Tier 3: Returns null ML lines so frontend can prompt manual entry

const fs = require('fs');
const CACHE_FILE = '/tmp/odds_cache.json';
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function readCache() {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const { timestamp, data } = JSON.parse(raw);
    if (Date.now() - timestamp < CACHE_TTL_MS) return data;
  } catch(e) {}
  return null;
}

function writeCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), data }));
  } catch(e) {}
}

const MLB_ID_TO_ABBR = {
  110:'BAL',111:'BOS',147:'NYY',139:'TBR',141:'TOR',
  145:'CHW',114:'CLE',116:'DET',118:'KCR',142:'MIN',
  117:'HOU',108:'LAA',133:'ATH',136:'SEA',140:'TEX',
  144:'ATL',146:'MIA',121:'NYM',143:'PHI',120:'WSN',
  112:'CHC',113:'CIN',158:'MIL',134:'PIT',138:'STL',
  109:'ARI',115:'COL',119:'LAD',135:'SDP',137:'SFG'
};

const ODDS_NAME_TO_ABBR = {
  'Baltimore Orioles':'BAL','Boston Red Sox':'BOS','New York Yankees':'NYY',
  'Tampa Bay Rays':'TBR','Toronto Blue Jays':'TOR','Chicago White Sox':'CHW',
  'Cleveland Guardians':'CLE','Detroit Tigers':'DET','Kansas City Royals':'KCR',
  'Minnesota Twins':'MIN','Houston Astros':'HOU','Los Angeles Angels':'LAA',
  'Oakland Athletics':'ATH','Athletics':'ATH','Seattle Mariners':'SEA',
  'Texas Rangers':'TEX','Atlanta Braves':'ATL','Miami Marlins':'MIA',
  'New York Mets':'NYM','Philadelphia Phillies':'PHI','Washington Nationals':'WSN',
  'Chicago Cubs':'CHC','Cincinnati Reds':'CIN','Milwaukee Brewers':'MIL',
  'Pittsburgh Pirates':'PIT','St. Louis Cardinals':'STL','Arizona Diamondbacks':'ARI',
  'Colorado Rockies':'COL','Los Angeles Dodgers':'LAD','San Diego Padres':'SDP',
  'San Francisco Giants':'SFG'
};

// TIER 1: The Odds API (with /tmp cache)
async function fetchOddsApiLines() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return {};

  // Return cached result if still fresh
  const cached = readCache();
  if (cached) return cached;

  try {
    const url = `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return {};
    const data = await res.json();
    const lines = {};
    for (const game of data) {
      const homeAbbr = ODDS_NAME_TO_ABBR[game.home_team];
      const awayAbbr = ODDS_NAME_TO_ABBR[game.away_team];
      if (!homeAbbr || !awayAbbr) continue;
      let awayMLs = [], homeMLs = [];
      for (const bm of game.bookmakers || []) {
        for (const market of bm.markets || []) {
          if (market.key !== 'h2h') continue;
          for (const outcome of market.outcomes || []) {
            const abbr = ODDS_NAME_TO_ABBR[outcome.name];
            if (abbr === awayAbbr) awayMLs.push(outcome.price);
            if (abbr === homeAbbr) homeMLs.push(outcome.price);
          }
        }
      }
      if (awayMLs.length > 0 && homeMLs.length > 0) {
        awayMLs.sort((a,b) => a-b);
        homeMLs.sort((a,b) => a-b);
        lines[`${awayAbbr}@${homeAbbr}`] = {
          awayML: awayMLs[Math.floor(awayMLs.length / 2)],
          homeML: homeMLs[Math.floor(homeMLs.length / 2)],
        };
      }
    }
    writeCache(lines); // save for next hour
    return lines;
  } catch(e) {
    console.error('Tier 1 (Odds API) failed:', e.message);
    return {};
  }
}

exports.handler = async function(event, context) {
    const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate'
  };
  try {
    const today = new Date().toLocaleString('en-CA', { timeZone: 'America/New_York' }).split(',')[0];

    // MLB schedule + Odds API in parallel (Odds API may return from cache)
    const [schedRes, oddsLines] = await Promise.all([
      fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=lineups,probablePitcher,linescore,odds&_t=${Date.now()}`),
      fetchOddsApiLines()
    ]);

    const schedData = await schedRes.json();
    const games = [];

    for (const dateObj of schedData.dates || []) {
      for (const g of dateObj.games || []) {
        const awayAbbr = MLB_ID_TO_ABBR[g.teams?.away?.team?.id];
        const homeAbbr = MLB_ID_TO_ABBR[g.teams?.home?.team?.id];
        if (!awayAbbr || !homeAbbr) continue;

        const awayLineup = (g.lineups?.awayPlayers || [])
          .slice(0, 9).map(p => p.fullName).filter(Boolean);
        const homeLineup = (g.lineups?.homePlayers || [])
          .slice(0, 9).map(p => p.fullName).filter(Boolean);

        const awaySP = g.teams?.away?.probablePitcher?.fullName || null;
        const homeSP  = g.teams?.home?.probablePitcher?.fullName || null;

        const gameTime = g.gameDate
          ? new Date(g.gameDate).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York'
            })
          : '';

        // TIER 1: The Odds API (from cache or fresh fetch)
        const oddsKey = `${awayAbbr}@${homeAbbr}`;
        let awayML = null, homeML = null, mlSource = null;

        if (oddsLines[oddsKey]) {
          awayML   = oddsLines[oddsKey].awayML;
          homeML   = oddsLines[oddsKey].homeML;
          mlSource = 'odds-api';
        }

        // TIER 2: MLB Stats API odds field
        if (awayML === null && g.odds) {
          for (const odd of g.odds) {
            if (odd.market === 'h2h') {
              awayML   = odd.awayOdds ?? null;
              homeML   = odd.homeOdds ?? null;
              mlSource = 'mlb-api';
            }
          }
        }

        // TIER 3: null — frontend shows manual input fields
        if (awayML === null) mlSource = 'manual';

        games.push({
          gameId:      String(g.gamePk),
          date:        today,
          awayAbbr,   homeAbbr,
          awayLineup, homeLineup,
          awaySP,     homeSP,
          time:        gameTime,
          awayML,     homeML,
          mlSource,
          status:      g.status?.abstractGameState || 'Preview'
        });
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ games }) };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message, games: [] }) };
  }
};
