const { put, list } = require('@vercel/blob');

const PATHNAME = 'wika-overrides.json';

async function readStore() {
  try {
    const { blobs } = await list({ prefix: PATHNAME });
    const match = blobs.find((b) => b.pathname === PATHNAME);
    if (!match) return { images: {}, texts: {} };
    const res = await fetch(match.url, { cache: 'no-store' });
    if (!res.ok) return { images: {}, texts: {} };
    const data = await res.json();
    return { images: data.images || {}, texts: data.texts || {} };
  } catch (e) {
    return { images: {}, texts: {} };
  }
}

async function writeStore(data) {
  await put(PATHNAME, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const data = await readStore();
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const { kind, id, value } = body || {};
    if (!kind || !id || typeof value !== 'string') {
      return res.status(400).json({ error: 'kind, id, value required' });
    }
    if (kind !== 'image' && kind !== 'text') {
      return res.status(400).json({ error: 'invalid kind' });
    }

    const data = await readStore();
    const bucket = kind === 'image' ? 'images' : 'texts';
    data[bucket][id] = value;

    try {
      await writeStore(data);
    } catch (e) {
      return res.status(500).json({ error: 'Speichern fehlgeschlagen' });
    }

    return res.status(200).json(data);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
