// api/auth.js
// Backend para manejar autenticación OAuth sin necesidad de consentimiento admin

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// ── CONFIGURACIÓN ──────────────────────────────────────────
const CLIENT_ID = process.env.CLIENT_ID || "4ccb3c0e-439f-4571-a53f-b31b5138e50f";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "tu-secret-aqui"; // ⚠️ VER INSTRUCCIONES
const TENANT_ID = process.env.TENANT_ID || "8abf00f8-2a9e-4312-b0d4-5f51b1230a96";
const REDIRECT_URI = process.env.REDIRECT_URI || "http://localhost:3000/api/callback";

// ── MIDDLEWARE ─────────────────────────────────────────────
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

// ── RUTA: Generar URL de login ─────────────────────────────
app.get('/api/login-url', (req, res) => {
  const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?` +
    `client_id=${CLIENT_ID}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent('offline_access https://graph.microsoft.com/.default')}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `prompt=select_account`;
  
  res.json({ authUrl });
});

// ── RUTA: Callback (intercambia code por token) ────────────
app.get('/api/callback', async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;
  
  if (error) {
    return res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Error de Autenticación</h1>
          <p>${error}</p>
          <button onclick="window.close()">Cerrar</button>
        </body>
      </html>
    `);
  }
  
  if (!code) {
    return res.status(400).json({ error: "No authorization code received" });
  }
  
  try {
    // Intercambiar code por token
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
        scope: "offline_access https://graph.microsoft.com/.default"
      }
    );
    
    const accessToken = tokenResponse.data.access_token;
    const refreshToken = tokenResponse.data.refresh_token;
    
    // Enviar token de vuelta al cliente
    return res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>✅ Autenticación Exitosa</h1>
          <p>Cerrando ventana...</p>
          <script>
            window.opener.postMessage({
              access_token: '${accessToken}',
              refresh_token: '${refreshToken}'
            }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error("Error intercambiando token:", error.response?.data || error.message);
    return res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Error al obtener token</h1>
          <p>${error.response?.data?.error_description || error.message}</p>
          <button onclick="window.close()">Cerrar</button>
        </body>
      </html>
    `);
  }
});

// ── RUTA: Refrescar token ──────────────────────────────────
app.post('/api/refresh-token', async (req, res) => {
  const { refresh_token } = req.body;
  
  if (!refresh_token) {
    return res.status(400).json({ error: "Refresh token required" });
  }
  
  try {
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refresh_token,
        grant_type: "refresh_token",
        scope: "offline_access https://graph.microsoft.com/.default"
      }
    );
    
    res.json({
      access_token: tokenResponse.data.access_token,
      refresh_token: tokenResponse.data.refresh_token
    });
    
  } catch (error) {
    console.error("Error refrescando token:", error.response?.data || error.message);
    res.status(400).json({ error: "Failed to refresh token" });
  }
});

// ── RUTA: Proxy para llamadas a Microsoft Graph ────────────
app.post('/api/graph-request', async (req, res) => {
  const { access_token, method = 'GET', url, data } = req.body;
  
  if (!access_token) {
    return res.status(401).json({ error: "Access token required" });
  }
  
  try {
    const config = {
      method,
      url,
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json"
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    res.json(response.data);
    
  } catch (error) {
    console.error("Error en Graph request:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error?.message || error.message
    });
  }
});

// ── HEALTH CHECK ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: "✅ Backend funcionando" });
});

// ── INICIAR SERVIDOR ───────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend RINOL ejecutándose en puerto ${PORT}`);
  console.log(`📍 Callback URL: ${REDIRECT_URI}`);
});

module.exports = app;
