// netlify/functions/auth.js
const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Configuración desde variables de entorno (Netlify UI)
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const TENANT_ID = process.env.TENANT_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;

// ── RUTAS (sin /api prefijo, la función ya recibe la ruta base) ──

// 1. Devuelve la URL de login de Microsoft
app.get('/login-url', (req, res) => {
  const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?` +
    `client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=https://graph.microsoft.com/.default` +
    `&prompt=select_account`;
  res.json({ authUrl });
});

// 2. Callback (recibe code por query string, devuelve HTML con postMessage)
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    return res.send(`
      <html><body><h1>❌ Error</h1><p>${error}</p><button onclick="window.close()">Cerrar</button></body></html>
    `);
  }
  if (!code) {
    return res.status(400).json({ error: "No code received" });
  }

  try {
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
        scope: "offline_access https://graph.microsoft.com/.default"
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Enviar tokens a la ventana padre con postMessage
    return res.send(`
      <html>
        <body><script>
          window.opener.postMessage({
            access_token: '${access_token}',
            refresh_token: '${refresh_token}'
          }, '*');
          window.close();
        </script></body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    return res.send(`
      <html><body><h1>❌ Error</h1><p>${err.response?.data?.error_description || err.message}</p><button onclick="window.close()">Cerrar</button></body></html>
    `);
  }
});

// 3. Refrescar token
app.post('/refresh-token', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: "Refresh token required" });

  try {
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token,
        grant_type: "refresh_token",
        scope: "offline_access https://graph.microsoft.com/.default"
      }
    );
    res.json({
      access_token: tokenResponse.data.access_token,
      refresh_token: tokenResponse.data.refresh_token
    });
  } catch (err) {
    res.status(400).json({ error: "Failed to refresh token" });
  }
});

// 4. Proxy para Microsoft Graph
app.post('/graph-request', async (req, res) => {
  const { access_token, method = 'GET', url, data } = req.body;
  if (!access_token) return res.status(401).json({ error: "Access token required" });

  try {
    const response = await axios({
      method,
      url,
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      data
    });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// 5. Health check
app.get('/health', (req, res) => {
  res.json({ status: "✅ Backend funcionando (Netlify Function)" });
});

// Exportar handler serverless
exports.handler = serverless(app);
