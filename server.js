require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GOVEE_API_URL = 'https://developer-api.govee.com/v1';
const GOVEE_API_KEY = process.env.GOVEE_API_KEY;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// Helper to configure axios with the API key
const goveeClient = axios.create({
    baseURL: GOVEE_API_URL,
    headers: {
        'Govee-API-Key': GOVEE_API_KEY,
        'Content-Type': 'application/json'
    }
});

// Endpoint to get all devices
app.get('/api/devices', async (req, res) => {
    try {
        if (!GOVEE_API_KEY) {
            return res.status(500).json({ error: 'Govee API Key is missing. Please check your .env file.' });
        }
        
        const response = await goveeClient.get('/devices');
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching devices:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch devices from Govee API',
            details: error.response?.data || error.message
        });
    }
});

// Endpoint to control a device (turn on/off, change color/brightness)
app.put('/api/devices/control', async (req, res) => {
    try {
        const { device, model, cmd } = req.body;
        
        if (!device || !model || !cmd) {
            return res.status(400).json({ error: 'Missing required parameters: device, model, or cmd' });
        }

        const response = await goveeClient.put('/devices/control', {
            device,
            model,
            cmd
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Error controlling device:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to control device',
            details: error.response?.data || error.message
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    if (!GOVEE_API_KEY) {
        console.warn('⚠️ WARNING: GOVEE_API_KEY is not set in the .env file!');
    }
});
