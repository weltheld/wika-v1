const { put, list } = require('@vercel/blob');

const PREFIX = 'overrides/';

function pathFor(id) {
  return PREFIX + encodeURIComponent(id) + '.txt';
}

async function readAll() {
  const data = { images: {}, texts: {} };
  let blobs;
  try {
    ({ blobs } = await list({ prefix: PREFIX }));
  } catch (e) {
    return data;
  }

  await Promise.all(blobs.map(async (b) => {
    const name = b.pathname.slice(PREFIX.length).replace(/\.txt$/, '');
    const id = decodeURIComponent(name);
    try {
      const res = await fetch(b.url, { cache: 'no-store' });
      if (!res.ok) return;
      const value = await res.text();
      if (id.indexOf('img-') === 0) {
        data.images[id] = value;
      } else if (id.indexOf('text-') === 0) {
        data.texts[id] = value;
      }
    } catch (e) {
      /* skip unreadable entry */
    }
  }));

  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const data = await readAll();
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

    try {
      // Each override is its own blob, so concurrent saves of different
      // (or even the same) keys never clobber each other via a stale
      // read-modify-write cycle - every write is independent and atomic.
      await put(pathFor(id), value, {
        access: 'public',
        contentType: 'text/plain',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
    } catch (e) {
      return res.status(500).json({ error: 'Speichern fehlgeschlagen' });
    }

    const data = await readAll();
    return res.status(200).json(data);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
