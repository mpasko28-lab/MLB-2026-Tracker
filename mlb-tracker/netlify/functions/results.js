// results.js — Netlify serverless function
// Fetches final score for a given gamePk to resolve bet log outcomes

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
  const gameId = event.queryStringParameters?.gameId;
  if (!gameId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing gameId' }) };
  }
  try {
    const url = `https://statsapi.mlb.com/api/v1.1/game/${gameId}/feed/live`;
    const res = await fetch(url);
    const data = await res.json();
    const state = data.gameData?.status?.abstractGameState;
    const final = state === 'Final';
    const linescore = data.liveData?.linescore;
    const awayScore = linescore?.teams?.away?.runs ?? null;
    const homeScore = linescore?.teams?.home?.runs ?? null;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ final, awayScore, homeScore, state })
    };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
