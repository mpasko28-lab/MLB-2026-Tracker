// Netlify serverless function: fetches MLB standings via MLB Stats API
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const year = new Date().getFullYear();
    const url = `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${year}&standingsTypes=regularSeason&hydrate=team`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    const standings = {};
    
    for (const record of data.records || []) {
      for (const teamRecord of record.teamRecords || []) {
        const name = teamRecord.team.name;
        const shortName = teamRecord.team.teamName; // e.g. "Yankees"
        standings[shortName] = {
          wins: teamRecord.wins,
          losses: teamRecord.losses,
          pct: teamRecord.winningPercentage,
          gb: teamRecord.gamesBack,
          streak: teamRecord.streak?.streakCode || '-'
        };
      }
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ standings, updated: new Date().toISOString() })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
