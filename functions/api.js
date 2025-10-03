// A lightweight router for Cloudflare Workers
import { Router } from 'itty-router';
const router = Router();

// POST /api/log - Log a completed study session
router.post('/api/log', async (request, env) => {
    const { username, duration } = await request.json();
    if (!username || !duration) {
        return new Response('Missing username or duration', { status: 400 });
    }

    const { success } = await env.DB.prepare(
        'INSERT INTO study_sessions (username, duration_minutes) VALUES (?, ?)'
    ).bind(username, duration).run();

    if (success) {
        return new Response('Session logged', { status: 200 });
    } else {
        return new Response('Failed to log session', { status: 500 });
    }
});

// GET /api/leaderboard?period=...&user=... - Fetch leaderboard data
router.get('/api/leaderboard', async (request, env) => {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily';
    const user = searchParams.get('user');

    let whereClause = '';
    switch (period) {
        case 'daily':
            whereClause = `WHERE date(completed_at) = date('now')`;
            break;
        case 'monthly':
            whereClause = `WHERE strftime('%Y-%m', completed_at) = strftime('%Y-%m', 'now')`;
            break;
        case 'lifetime':
            whereClause = ''; // No filter for lifetime
            break;
    }

    // Query for the top 50 leaderboard
    const leaderboardQuery = `
        SELECT username, SUM(duration_minutes) as total_minutes
        FROM study_sessions
        ${whereClause}
        GROUP BY username
        ORDER BY total_minutes DESC
        LIMIT 50
    `;
    const { results } = await env.DB.prepare(leaderboardQuery).all();
    const leaderboard = results.map((row, index) => ({ ...row, rank: index + 1 }));

    // Query for the current user's rank
    let userRank = null;
    if (user) {
        const userRankQuery = `
            WITH UserRanks AS (
                SELECT username, SUM(duration_minutes) as total_minutes,
                RANK() OVER (ORDER BY SUM(duration_minutes) DESC) as rank
                FROM study_sessions
                ${whereClause}
                GROUP BY username
            )
            SELECT * FROM UserRanks WHERE username = ?
        `;
        userRank = await env.DB.prepare(userRankQuery).bind(user).first();
    }

    return new Response(JSON.stringify({ leaderboard, userRank }), {
        headers: { 'Content-Type': 'application/json' },
    });
});

// Catch-all for other requests
router.all('*', () => new Response('Not Found.', { status: 404 }));

// Export the router
export default {
    fetch: router.handle
}
