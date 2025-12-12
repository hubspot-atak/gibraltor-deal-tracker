const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');

// Load environment variables from .env file
dotenv.config();

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
if (!HUBSPOT_TOKEN) {
  console.error('Missing HUBSPOT_TOKEN in environment. See .env.example');
  // Fail fast in production so we don't attempt requests with an undefined token.
  // If you want to allow running without a token for local dev, set NODE_ENV=development.
  if (process.env.NODE_ENV === 'production') {
    console.error('Exiting because HUBSPOT_TOKEN is required in production.');
    process.exit(1);
  }
}

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Lightweight request logging for the deal lookup endpoint to help debugging in production.
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/api/deal-lookup') {
    const { email, dealId } = req.body || {};
    console.log('[request] POST /api/deal-lookup', { email: typeof email === 'string' ? email : undefined, dealId });
  }
  next();
});

const HUBSPOT_BASE = 'https://api.hubapi.com';

async function hubspotGet(path, params) {
  const url = `${HUBSPOT_BASE}${path}`;
  return axios.get(url, {
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      Accept: 'application/json',
    },
    params,
  });
}

app.post('/api/deal-lookup', async (req, res) => {
  try {
    const { email, dealId } = req.body || {};
    if (!email || !dealId) {
      return res.status(400).json({ error: 'Missing `email` or `dealId` in request body' });
    }

    // Fetch associations for the deal (contacts)
    let assocResp;
    try {
      assocResp = await hubspotGet(`/crm/v3/objects/deals/${encodeURIComponent(dealId)}/associations/contacts`);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return res.status(404).json({ error: `Deal with id ${dealId} not found` });
      }
      console.error('Error fetching associations:', err.message || err);
      return res.status(500).json({ error: 'Failed to fetch deal associations from HubSpot' });
    }

    const results = (assocResp.data && assocResp.data.results) || [];
    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: `No contacts associated with deal ${dealId}` });
    }

    // For each associated contact, fetch its email and check
    const normalizedTarget = String(email).trim().toLowerCase();
    let matchingContact = null;
    for (const item of results) {
      const contactId = item.id || (item.toObjectId && item.toObjectId) || item.toObjectId;
      if (!contactId) continue;
      try {
        const contactResp = await hubspotGet(`/crm/v3/objects/contacts/${encodeURIComponent(contactId)}`, { properties: 'email' });
        const contactEmail = (contactResp.data && contactResp.data.properties && contactResp.data.properties.email) || '';
        if (String(contactEmail).trim().toLowerCase() === normalizedTarget) {
          matchingContact = { id: contactId, email: contactEmail, raw: contactResp.data };
          break;
        }
      } catch (err) {
        // ignore individual contact fetch errors but log
        console.warn(`Failed to fetch contact ${contactId}:`, err.message || err);
      }
    }

    if (!matchingContact) {
      return res.status(400).json({ error: `Deal ${dealId} is not associated with the email ${email}` });
    }

    // Fetch deal details
    let dealResp;
    try {
      dealResp = await hubspotGet(`/crm/v3/objects/deals/${encodeURIComponent(dealId)}`);
    } catch (err) {
      console.error('Error fetching deal:', err.message || err);
      return res.status(500).json({ error: 'Failed to fetch deal from HubSpot' });
    }

    return res.json({ success: true, deal: dealResp.data, contact: matchingContact });
  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
