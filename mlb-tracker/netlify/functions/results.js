// Netlify serverless function: fetches game results for bet outcome tracking
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const { date } = event.queryStringParameters || {};
    const targetDate = date || new Date().toISOString().split('T')[0];

    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${targetDate}&hydrate=team,linescore`;
    const res = await fetch(url);
    const data = await res.json();

    const results = [];
    for (const dateEntry of data.dates || []) {
      for (const game of dateEntry.games || []) {
        const status = game.status?.detailedState;
        if (status === 'Final' || status === 'Game Over') {
          results.push({
            gameId: game.gamePk,
            away: game.teams.away.team.teamName,
            home: game.teams.home.team.teamName,
            awayScore: game.teams.away.score,
            homeScore: game.teams.home.score,
            winner: game.teams.away.score > game.teams.home.score 
              ? game.teams.away.team.teamName 
              : game.teams.home.team.teamName
          });
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ date: targetDate, results })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
