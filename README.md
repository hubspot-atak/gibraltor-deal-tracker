# HubSpot Deal Proxy

Small Node/Express app that accepts an `email` and `dealId`, verifies the deal is associated with the contact matching the email in HubSpot, and returns the deal data.

**Files**
- `server.js` — main Express server with `/api/deal-lookup` POST endpoint
- `.env.example` — example environment variables
- `package.json` — dependency manifest

## Setup

1. Copy `.env.example` to `.env` and set `HUBSPOT_TOKEN` to your HubSpot Private App token.
2. Install dependencies and start the server:

```powershell
cd "C:\Users\akhil\OneDrive\Desktop\Atak deal tracker cloudways"
npm install
node server.js
```

Or run in background on a server with `pm2`:

```powershell
npm install -g pm2
pm2 start server.js --name hubspot-deal-proxy
```

## API

POST /api/deal-lookup

Request JSON body:

{
  "email": "contact@example.com",
  "dealId": "123456"
}

Success response (200):

{
  "success": true,
  "deal": { ...hubspot deal object... },
  "contact": { "id": "...", "email": "...", "raw": { ... } }
}

Error responses:
- 400: Missing input or deal not associated with email
- 404: Deal not found
- 500: Server or HubSpot API error

## Example curl (local)

```powershell
curl -X POST http://localhost:3000/api/deal-lookup -H "Content-Type: application/json" -d "{ \"email\": \"me@example.com\", \"dealId\": \"123456\" }"
```

## Deploying to Cloudways

- Cloudways supports Node apps. Create a new application (Node.js) and upload the project files.
- Set environment variables on the Cloudways app dashboard: `HUBSPOT_TOKEN` and `PORT` (if needed).
- Use the platform's process manager to run `node server.js` or use `pm2` as shown above.

Notes:
- This implementation expects a HubSpot Private App token set in `HUBSPOT_TOKEN`.
- The code uses HubSpot's CRM endpoints to read deal associations and contact email.
