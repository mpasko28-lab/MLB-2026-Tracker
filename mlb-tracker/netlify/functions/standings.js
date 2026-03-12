// standings.js — Netlify serverless function
// Fetches current MLB standings from the MLB Stats API

const ABBR_MAP = {
  110:'BAL',111:'BOS',147:'NYY',139:'TBR',141:'TOR',
  145:'CHW',114:'CLE',116:'DET',118:'KCR',142:'MIN',
  117:'HOU',108:'LAA',133:'ATH',136:'SEA',140:'TEX',
  144:'ATL',146:'MIA',121:'NYM',143:'PHI',120:'WSN',
  112:'CHC',113:'CIN',158:'MIL',134:'PIT',138:'STL',
  109:'ARI',115:'COL',119:'LAD',135:'SDP',137:'SFG'
};

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
  try {
    const url = 'https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2026&standingsTypes=regularSeason';
    const res = await fetch(url);
    const data = await res.json();
    const teams = [];
    for (const record of data.records || []) {
      for (const tr of record.teamRecords || []) {
        const abbr = ABBR_MAP[tr.team.id];
        if (abbr) {
          teams.push({ abbr, w: tr.wins, l: tr.losses });
        }
      }
    }
    return { statusCode: 200, headers, body: JSON.stringify({ teams }) };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message, teams: [] }) };
  }
};
