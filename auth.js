const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const TENANT_ID = process.env.TENANT_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;

// ── RUTAS ──────────────────────────────────────────────────
app.get('/api/login-url', (req, res) => {
    const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?` +
        `client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=https://graph.microsoft.com/.default` +
        `&prompt=select_account`;
    
    res.json({ authUrl });
});

app.post('/api/callback', async (req, res) => {
    const { code } = req.body;
    
    try {
        const tokenResp = await axios.post(
            `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
            {
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
                scope: 'https://graph.microsoft.com/.default'
            }
        );
        
        res.json({
            access_token: tokenResp.data.access_token,
            refresh_token: tokenResp.data.refresh_token
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/graph-request', async (req, res) => {
    const { access_token, method, url, data } = req.body;
    
    try {
        const config = {
            method: method,
            url: url,
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
            }
        };
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        res.json(response.data);
    } catch (error) {
        console.error('Graph API Error:', error.response?.data || error.message);
        res.status(error.response?.status || 400).json({ 
            error: error.response?.data || error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`✅ RINOL Backend OAuth running on port ${PORT}`);
});                code: code,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
                scope: 'https://graph.microsoft.com/.default'
            }
        );
        
        res.json({
            access_token: tokenResp.data.access_token,
            refresh_token: tokenResp.data.refresh_token
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/graph-request', async (req, res) => {
    const { access_token, method, url, data } = req.body;
    
    try {
        const config = {
            method: method,
            url: url,
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
            }
        };
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        res.json(response.data);
    } catch (error) {
        console.error('Graph API Error:', error.response?.data || error.message);
        res.status(error.response?.status || 400).json({ 
            error: error.response?.data || error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`✅ RINOL Backend OAuth running on port ${PORT}`);
});// ── RUTA: Callback (intercambia code por token) ────────────
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
