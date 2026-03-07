// Netlify serverless function: fetches team roster to split SP vs RP
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const { teamId } = event.queryStringParameters || {};
    if (!teamId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'teamId required' }) };
    }

    const url = `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active&hydrate=person(stats(type=season))`;
    const res = await fetch(url);
    const data = await res.json();

    const starters = [];
    const relievers = [];

    for (const player of data.roster || []) {
      const pos = player.position?.abbreviation;
      const name = player.person?.fullName;
      const pid = player.person?.id;
      if (pos === 'SP') starters.push({ id: pid, name });
      else if (pos === 'RP') relievers.push({ id: pid, name });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ teamId, starters, relievers })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
