// Netlify serverless function: fetches today's MLB games with lineups
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const today = new Date().toISOString().split('T')[0];
    const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=lineups,probablePitcher,team`;
    
    const res = await fetch(scheduleUrl);
    const data = await res.json();

    const games = [];

    for (const dateEntry of data.dates || []) {
      for (const game of dateEntry.games || []) {
        const away = game.teams.away;
        const home = game.teams.home;

        const awayLineup = (game.lineups?.awayPlayers || []).map(p => ({
          id: p.id,
          name: p.fullName,
          pos: p.primaryPosition?.abbreviation || '?'
        }));
        const homeLineup = (game.lineups?.homePlayers || []).map(p => ({
          id: p.id,
          name: p.fullName,
          pos: p.primaryPosition?.abbreviation || '?'
        }));

        games.push({
          gameId: game.gamePk,
          status: game.status?.detailedState,
          time: game.gameDate,
          away: {
            team: away.team.teamName,
            teamFull: away.team.name,
            teamId: away.team.id,
            score: away.score,
            pitcher: away.probablePitcher?.fullName || null,
            lineup: awayLineup
          },
          home: {
            team: home.team.teamName,
            teamFull: home.team.name,
            teamId: home.team.id,
            score: home.score,
            pitcher: home.probablePitcher?.fullName || null,
            lineup: homeLineup
          }
        });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ date: today, games })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
