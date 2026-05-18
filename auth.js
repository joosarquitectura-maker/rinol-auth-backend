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

console.log('🔐 Backend iniciando con:');
console.log(`   CLIENT_ID: ${CLIENT_ID ? '✅' : '❌'}`);
console.log(`   CLIENT_SECRET: ${CLIENT_SECRET ? '✅' : '❌'}`);
console.log(`   TENANT_ID: ${TENANT_ID ? '✅' : '❌'}`);
console.log(`   REDIRECT_URI: ${REDIRECT_URI}`);

// RUTA: Obtener URL de login
app.get('/api/login-url', (req, res) => {
    const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?` +
        `client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=https://graph.microsoft.com/.default` +
        `&prompt=select_account`;
    
    console.log('📍 Login URL solicitada');
    res.json({ authUrl });
});

// RUTA: Callback (intercambia code por token)
app.get('/api/callback', async (req, res) => {
    const code = req.query.code;
    const error = req.query.error;
    
    if (error) {
        console.error('❌ Error de autenticación:', error);
        return res.send(`
            <html>
                <body style="font-family: Arial; text-align: center; padding: 50px; background: #030303; color: white;">
                    <h1>❌ Error de Autenticación</h1>
                    <p>${error}</p>
                    <button onclick="window.close()" style="padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 5px; cursor: pointer;">Cerrar</button>
                </body>
            </html>
        `);
    }
    
    if (!code) {
        console.error('❌ No se recibió código de autorización');
        return res.status(400).json({ error: "No authorization code received" });
    }
    
    try {
        console.log('🔄 Intercambiando code por token...');
        
        const tokenResponse = await axios.post(
            `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
            {
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
                redirect_uri: REDIRECT_URI,
                grant_type: "authorization_code"
            }
        );
        
        console.log('✅ Token obtenido exitosamente');
        
        const accessToken = tokenResponse.data.access_token;
        const refreshToken = tokenResponse.data.refresh_token;
        
        return res.send(`
            <html>
                <body style="font-family: Arial; text-align: center; padding: 50px; background: #030303; color: white;">
                    <h1>✅ Autenticación Exitosa</h1>
                    <p>Cerrando ventana...</p>
                    <script>
                        window.opener.postMessage({
                            access_token: '${accessToken}',
                            refresh_token: '${refreshToken}'
                        }, '*');
                        setTimeout(() => window.close(), 500);
                    </script>
                </body>
            </html>
        `);
        
    } catch (error) {
        console.error('❌ Error intercambiando token:', error.response?.data || error.message);
        return res.send(`
            <html>
                <body style="font-family: Arial; text-align: center; padding: 50px; background: #030303; color: white;">
                    <h1>❌ Error al obtener token</h1>
                    <p>${error.response?.data?.error_description || error.message}</p>
                    <button onclick="window.close()" style="padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 5px; cursor: pointer;">Cerrar</button>
                </body>
            </html>
        `);
    }
});

// RUTA: Proxy para llamadas a Microsoft Graph
app.post('/api/graph-request', async (req, res) => {
    const { access_token, method = 'GET', url, data } = req.body;
    
    if (!access_token) {
        console.error('❌ Token de acceso requerido');
        return res.status(401).json({ error: "Access token required" });
    }
    
    try {
        console.log(`📊 ${method} ${url}`);
        
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
        console.log('✅ Respuesta exitosa de Graph API');
        res.json(response.data);
        
    } catch (error) {
        console.error('❌ Error en Graph request:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error?.message || error.message
        });
    }
});

// RUTA: Health check
app.get('/api/health', (req, res) => {
    res.json({ status: "✅ Backend funcionando correctamente" });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 ============================================`);
    console.log(`🚀 Backend RINOL v18 escuchando en puerto ${PORT}`);
    console.log(`📍 Callback URL: ${REDIRECT_URI}`);
    console.log(`🚀 ============================================`);
});

module.exports = app;
