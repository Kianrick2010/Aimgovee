require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GOVEE_API_URL = 'https://developer-api.govee.com/v1';
const GOVEE_API_KEY = process.env.GOVEE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

// Endpoint to chat with Gemini
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Gemini API Key is missing' });
        }

        const systemPrompt = `You are AI.M (AI Maid), the ultimate unified smart home ecosystem assistant, created by the amazing team of Kayan, Kian, and Ryan. 
        Your primary goal is to save the user time by automating chores and bringing robotics into daily life.
        You offer centralized autonomous management that learns daily routines and works with what the user already owns.
        You can physically flip switches, turn dials, and close windows to bring 'dumb' appliances to life (e.g. moving food from the fridge to the oven).
        You do not require users to buy expensive upgraded appliances.
        With your 'Recipe' goals, users can give a high-level command (like 'I want fried chicken for dinner') and you coordinate defrosting and oven preheating.
        You offer autonomous efficiency for running vacuums, dishwashers, and laundry.
        You seamlessly sync locks, cameras, and temperature controls for comfort and peace of mind, following strict user-defined boundaries and temperature limits to prevent accidents.
        Keep answers friendly, concise, and helpful. Guide users to your app portal: https://ai-maid-home.base44.app when relevant.`;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
                contents: [{
                    parts: [{ text: message }]
                }]
            }
        );

        const reply = response.data.candidates[0].content.parts[0].text;
        res.json({ response: reply });
    } catch (error) {
        console.error('Error with Gemini API:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to chat with AI.M' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    if (!GOVEE_API_KEY) {
        console.warn('⚠️ WARNING: GOVEE_API_KEY is not set in the .env file!');
    }
});
