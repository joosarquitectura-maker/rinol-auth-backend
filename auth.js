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
});
