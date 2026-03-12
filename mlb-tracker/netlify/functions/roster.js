// roster.js — Netlify serverless function
// Fetches active roster SP/RP splits for all 30 teams

const TEAM_IDS = [110,111,147,139,141,145,114,116,118,142,117,108,133,136,140,144,146,121,143,120,112,113,158,134,138,109,115,119,135,137];

const MLB_ID_TO_ABBR = {
  110:'BAL',111:'BOS',147:'NYY',139:'TBR',141:'TOR',
  145:'CHW',114:'CLE',116:'DET',118:'KCR',142:'MIN',
  117:'HOU',108:'LAA',133:'ATH',136:'SEA',140:'TEX',
  144:'ATL',146:'MIA',121:'NYM',143:'PHI',120:'WSN',
  112:'CHC',113:'CIN',158:'MIL',134:'PIT',138:'STL',
  109:'ARI',115:'COL',119:'LAD',135:'SDP',137:'SFG'
};

const SP_POSITION_CODES = ['SP', 'P'];

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
  try {
    const rosters = {};

    await Promise.all(TEAM_IDS.map(async (teamId) => {
      const abbr = MLB_ID_TO_ABBR[teamId];
      if (!abbr) return;
      try {
        const url = `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active&season=2026`;
        const res = await fetch(url);
        const data = await res.json();
        const sp = [], rp = [];
        for (const player of data.roster || []) {
          const pos = player.position?.abbreviation;
          const name = player.person?.fullName;
          if (!name) continue;
          if (pos === 'SP') sp.push({name});
          else if (pos === 'RP') rp.push({name});
        }
        rosters[abbr] = {sp, rp};
      } catch(e) {
        rosters[abbr] = {sp:[], rp:[]};
      }
    }));

    return { statusCode: 200, headers, body: JSON.stringify({ rosters }) };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message, rosters: {} }) };
  }
};
