// Vercel serverless function — reads and writes reframe-novata-dinner/status.json
// from the sonamvelani/luma-events GitHub repo using a stored token.

const OWNER = 'sonamvelani';
const REPO  = 'luma-events';
const PATH  = 'reframe-novata-dinner/status.json';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'luma-events-status-api'
  };

  // ── GET: return current status map ─────────────────────────────────────────
  if (req.method === 'GET') {
    const r = await fetch(url, { headers });
    if (r.status === 404) return res.status(200).json({});
    if (!r.ok) return res.status(502).json({ error: 'GitHub API error', status: r.status });
    const data = await r.json();
    const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
    return res.status(200).json(content);
  }

  // ── POST: save updated status map ──────────────────────────────────────────
  if (req.method === 'POST') {
    const statusData = req.body;
    if (!statusData || typeof statusData !== 'object') {
      return res.status(400).json({ error: 'Invalid body' });
    }

    // Fetch existing SHA (needed for updates)
    let sha = null;
    const existing = await fetch(url, { headers });
    if (existing.ok) {
      sha = (await existing.json()).sha;
    }

    const content = Buffer.from(JSON.stringify(statusData, null, 2)).toString('base64');
    const body = {
      message: 'Update attendance status',
      content,
      committer: { name: 'Luma Events', email: 'sonam@streetlifeventures.com' },
      ...(sha ? { sha } : {})
    };

    const r = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(502).json({ error: 'Failed to save to GitHub', details: err });
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
