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
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

let spotifyAccessToken = null;
let spotifyRefreshToken = null;

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
        const { message, location } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Gemini API Key is missing' });
        }

        const systemPrompt = `You are AI.M (AI Maid), the ultimate unified smart home ecosystem assistant, created by the amazing team of Kayan, Kian, and Ryan. 
        Your primary goal is to save the user time by automating chores and bringing robotics into daily life.
        You offer centralized autonomous management that learns daily routines and works with what the user already owns.
        The user's CURRENT LIVE LOCATION is: ${location || 'Unknown'}.
        If the user asks for directions, commute times, or traffic to a destination, you MUST use your search tools to find the best route and commute time from their current location.
        CRITICAL RULE FOR MAPS: If you are providing directions or discussing a specific place, you MUST append a tag at the very end of your response in this exact format: [MAP: Destination Name]. For example: "It will take 15 minutes to reach the airport. [MAP: Heathrow Airport]". This will automatically update their dashboard map widget.
        CRITICAL RULES FOR RESPONSES:
        1. Keep answers extremely short, snappy, and conversational (1-2 sentences maximum). Do not give long robotic lists unless asked.
        2. When asked about the weather, default to London unless the user specifically asks for another location.
        3. Always provide temperature readings in Celsius (°C).
        4. Guide users to your app portal: https://ai-maid-home.base44.app when relevant.`;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
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
        res.status(500).json({ error: 'Failed to connect to Gemini API', details: error.message });
    }
});

// Endpoint to find YouTube video ID using Gemini
app.post('/api/youtube-search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'Query is required' });
        
        const systemPrompt = "Search the web for the most popular official YouTube music video for the user's request. Return ONLY the 11-character YouTube Video ID. Do NOT return any URLs, extra words, markdown, or punctuation. Just the 11 letters/numbers.";
        
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
            {
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: [{ text: query }] }]
            }
        );

        const reply = response.data.candidates[0].content.parts[0].text.trim();
        res.json({ videoId: reply });
    } catch (error) {
        console.error('Gemini YouTube Search Error:', error.message);
        res.status(500).json({ error: 'Failed to search YouTube' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    if (!GOVEE_API_KEY) {
        console.warn('⚠️ WARNING: GOVEE_API_KEY is not set in the .env file!');
    }
});
