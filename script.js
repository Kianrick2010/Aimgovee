document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle Logic
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = themeToggleBtn.querySelector('i');

    // Check local storage for theme preference
    const currentTheme = localStorage.getItem('theme') || 'dark'; // Default to dark for cool aesthetic
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);

    themeToggleBtn.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        let newTheme = theme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });

    function updateThemeIcon(theme) {
        if (theme === 'dark') {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        } else {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    }

    // Waitlist Form Handling
    const form = document.getElementById('waitlist-form');
    const formMessage = document.getElementById('form-message');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email-input').value;

        if (email) {
            // In a real static site, you'd post this to Formspree, Netlify Forms, or Formbold
            // e.g. fetch('https://formspree.io/f/your_id', { method: 'POST', body: new FormData(form) })

            formMessage.textContent = `Thank you! ${email} has been added to our waitlist for updates.`;
            formMessage.classList.remove('hidden');
            form.reset();

            setTimeout(() => {
                formMessage.classList.add('hidden');
            }, 5000);
        }
    });

    // Scroll Animations using Intersection Observer
    const sections = document.querySelectorAll('.section, .card');

    // Add base class for animation
    sections.forEach(sec => sec.classList.add('fade-in-section'));

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            }
        });
    }, {
        threshold: 0.1
    });

    sections.forEach(section => {
        observer.observe(section);
    });

    // Chatbot Logic
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatMessages = document.getElementById('chat-messages');

    const deviceChatInput = document.getElementById('device-chat-input');
    const deviceChatSendBtn = document.getElementById('device-chat-send-btn');
    const deviceChatMessages = document.getElementById('device-chat-messages');

    if (chatInput && chatSendBtn && chatMessages) {


        function appendMessage(text, sender, container) {
            const msgDiv = document.createElement('div');
            msgDiv.className = `message ${sender}-message`;
            msgDiv.innerHTML = `<div class="message-bubble">${text}</div>`;
            container.appendChild(msgDiv);
            container.scrollTop = container.scrollHeight;

            if (sender === 'user' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }

            if (sender === 'bot' && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.0; // Normal rate for a natural voice
                utterance.pitch = 1.0; // Normal pitch

                // Find a clear, Siri-like female voice
                const voices = window.speechSynthesis.getVoices();
                const siriVoice = voices.find(v => 
                    v.name.includes('Samantha') || // Mac/iOS Siri voice
                    v.name.includes('Aria') || // High quality Windows voice
                    v.name === 'Google US English' || // Chrome US voice
                    v.name === 'Google UK English Female' || // Chrome UK voice
                    v.name.includes('Zira') // Windows fallback female voice
                );
                
                if (siriVoice) {
                    utterance.voice = siriVoice;
                }

                window.speechSynthesis.speak(utterance);
            }
        }

        let chatState = null;
        let pendingCommand = null;

        const colorMap = {
            'red': {r: 255, g: 0, b: 0},
            'blue': {r: 0, g: 0, b: 255},
            'green': {r: 0, g: 255, b: 0},
            'yellow': {r: 255, g: 255, b: 0},
            'purple': {r: 128, g: 0, b: 128},
            'pink': {r: 255, g: 192, b: 203},
            'orange': {r: 255, g: 165, b: 0},
            'white': {r: 255, g: 255, b: 255}
        };

        async function executeCommandOnLights(lightsToControl, commandStr) {
            let successCount = 0;
            for (const light of lightsToControl) {
                if (commandStr === 'on') {
                    await window.controlDevice(light.device, light.model, 'turn', 'on');
                    successCount++;
                } else if (commandStr === 'off') {
                    await window.controlDevice(light.device, light.model, 'turn', 'off');
                    successCount++;
                } else if (commandStr.startsWith('color:')) {
                    const colorName = commandStr.split(':')[1];
                    let rgb;
                    if (colorName === 'random') {
                        rgb = { r: Math.floor(Math.random()*256), g: Math.floor(Math.random()*256), b: Math.floor(Math.random()*256) };
                    } else {
                        rgb = colorMap[colorName];
                    }
                    if (rgb) {
                        await window.controlDevice(light.device, light.model, 'color', rgb);
                        successCount++;
                    }
                } else if (commandStr.startsWith('brightness:')) {
                    const val = parseInt(commandStr.split(':')[1]);
                    await window.controlDevice(light.device, light.model, 'brightness', val);
                    successCount++;
                }
            }
            return successCount > 0 ? `Done! Command sent.` : "I tried, but something went wrong.";
        }

        async function getDeviceBotResponse(input) {
            const lowerInput = input.toLowerCase();

            // Check if we are waiting for a response about multiple lights
            if (chatState === 'waiting_for_light_selection' && pendingCommand) {
                const lights = (window.connectedDevices || []).filter(d => d.supportCmds && (d.supportCmds.includes('color') || d.supportCmds.includes('brightness')));
                chatState = null; // Reset state
                
                if (lowerInput.includes('all')) {
                    const result = await executeCommandOnLights(lights, pendingCommand);
                    pendingCommand = null;
                    return result;
                } else if (lowerInput.includes('one') || lowerInput.includes('just one')) {
                    const result = await executeCommandOnLights([lights[0]], pendingCommand);
                    pendingCommand = null;
                    return `Okay, applied to ${lights[0].deviceName || 'your first light'}.`;
                } else {
                    pendingCommand = null;
                    return "Cancelled command.";
                }
            }

        // Enhanced Command parsing
        let detectedCommand = null;
        if (lowerInput.includes('turn on') || lowerInput.includes('turn it on') || lowerInput === 'on' || lowerInput.includes('turn lights on') || lowerInput.includes('turn bulb on') || lowerInput.includes('turn the lights on')) detectedCommand = 'on';
        else if (lowerInput.includes('turn off') || lowerInput.includes('turn it off') || lowerInput === 'off' || lowerInput.includes('turn lights off') || lowerInput.includes('turn bulb off') || lowerInput.includes('turn the lights off')) detectedCommand = 'off';
            else if (lowerInput.includes('random') || (lowerInput.includes('change') && (lowerInput.includes('color') || lowerInput.includes('colour')) && !Object.keys(colorMap).some(c => lowerInput.includes(c)))) detectedCommand = 'color:random';
            else if (lowerInput.includes('brightness')) {
                const match = lowerInput.match(/(\d+)/);
                if (match) detectedCommand = `brightness:${match[1]}`;
            } else {
                for (const color of Object.keys(colorMap)) {
                    if (lowerInput.includes(`color to ${color}`) || lowerInput.includes(`colour to ${color}`) || lowerInput.includes(`${color} light`) || lowerInput.includes(`change to ${color}`)) {
                        detectedCommand = `color:${color}`;
                        break;
                    }
                }
            }

            if (detectedCommand) {
                if (!window.connectedDevices || window.connectedDevices.length === 0) {
                    return "No devices connected to the dashboard yet!";
                }

                const lights = window.connectedDevices.filter(d => d.supportCmds && (d.supportCmds.includes('color') || d.supportCmds.includes('brightness')));
                
                if (lights.length === 0) {
                    return "I couldn't find any lights!";
                } else if (lights.length === 1) {
                    return await executeCommandOnLights(lights, detectedCommand);
                } else {
                    chatState = 'waiting_for_light_selection';
                    pendingCommand = detectedCommand;
                    return `You have ${lights.length} lights. Change all of them, or just one?`;
                }
            }

            // Fallback: Pass everything else to Gemini!
            return await getGeneralBotResponse(input);
        }

        async function getGeneralBotResponse(input) {
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        message: input,
                        location: window.userLocationString || "Unknown"
                    })
                });
                if (!response.ok) throw new Error('API Error');
                const data = await response.json();
                
                // Intercept MAP updates
                if (data.response && data.response.includes('[MAP:')) {
                    const cleanResponse = data.response.replace(/\[MAP:.*?\]/, '').trim();
                    const mapMatch = data.response.match(/\[MAP:\s*(.*?)\]/);
                    if (mapMatch && mapMatch[1]) {
                        const destination = mapMatch[1].trim();
                        const mapIframe = document.getElementById('map-iframe');
                        if (mapIframe) {
                            mapIframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(destination)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
                        }
                    }
                    
                    const mapRouteText = document.getElementById('map-route-text');
                    if (mapRouteText) {
                        mapRouteText.textContent = cleanResponse;
                        mapRouteText.classList.remove('hidden');
                    }

                    // Strip the tag from the spoken/visible response
                    return cleanResponse;
                }

                return data.response;
            } catch (error) {
                console.error(error);
                return "I'm having trouble connecting to my AI brain right now!";
            }
        }

        async function handleDeviceChat() {
            if (!deviceChatInput) return;
            const text = deviceChatInput.value.trim();
            if (!text) return;

            appendMessage(text, 'user', deviceChatMessages);
            deviceChatInput.value = '';

            const typingId = Math.random().toString(36).substr(2, 9);
            const msgDiv = document.createElement('div');
            msgDiv.className = 'message bot-message';
            msgDiv.id = typingId;
            msgDiv.innerHTML = '<div class="message-bubble"><i class="fa-solid fa-ellipsis fa-fade"></i></div>';
            deviceChatMessages.appendChild(msgDiv);
            deviceChatMessages.scrollTop = deviceChatMessages.scrollHeight;

            const response = await getDeviceBotResponse(text);
            
            const typingElem = document.getElementById(typingId);
            if(typingElem) typingElem.remove();
            
            appendMessage(response, 'bot', deviceChatMessages);
        }

        async function handleGeneralChat() {
            const text = chatInput.value.trim();
            if (!text) return;

            appendMessage(text, 'user', chatMessages);
            chatInput.value = '';

            const typingId = Math.random().toString(36).substr(2, 9);
            const msgDiv = document.createElement('div');
            msgDiv.className = 'message bot-message';
            msgDiv.id = typingId;
            msgDiv.innerHTML = '<div class="message-bubble"><i class="fa-solid fa-ellipsis fa-fade"></i></div>';
            chatMessages.appendChild(msgDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            const response = await getGeneralBotResponse(text);
            
            const typingElem = document.getElementById(typingId);
            if(typingElem) typingElem.remove();

            appendMessage(response, 'bot', chatMessages);
        }

        if (deviceChatSendBtn) deviceChatSendBtn.addEventListener('click', handleDeviceChat);
        if (deviceChatInput) {
            deviceChatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleDeviceChat();
            });
        }

        chatSendBtn.addEventListener('click', handleGeneralChat);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleGeneralChat();
        });

        // Speech Recognition Setup
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            function setupVoiceInput(micBtnId, inputElem, submitFunc) {
                const micBtn = document.getElementById(micBtnId);
                if (!micBtn) return;
                
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = false;

                recognition.onstart = () => {
                    micBtn.classList.add('listening');
                };

                recognition.onresult = (event) => {
                    const transcript = event.results[event.results.length - 1][0].transcript;
                    inputElem.value = transcript;
                    submitFunc();
                };

                recognition.onerror = (event) => {
                    console.error('Speech recognition error', event.error);
                    inputElem.value = "Mic Error: " + event.error;
                    micBtn.classList.remove('listening');
                };

                recognition.onend = () => {
                    micBtn.classList.remove('listening');
                };

                micBtn.addEventListener('click', () => {
                    if (micBtn.classList.contains('listening')) {
                        recognition.stop();
                    } else {
                        recognition.start();
                    }
                });
            }

            setupVoiceInput('device-mic-btn', deviceChatInput, handleDeviceChat);
            setupVoiceInput('mic-btn', chatInput, handleGeneralChat);

            // Wake Word Detection Logic
            const wakeWordBtn = document.getElementById('wake-word-btn');
            const wakeWordStatus = document.getElementById('wake-word-status');
            let isWakeWordMode = false;
            let wakeWordRecognition = null;
            let isProcessingCommand = false;

            if (wakeWordBtn) {
                wakeWordRecognition = new SpeechRecognition();
                wakeWordRecognition.continuous = true;
                wakeWordRecognition.interimResults = false;

                wakeWordRecognition.onstart = () => {
                    if (!isProcessingCommand) {
                        wakeWordBtn.classList.add('listening');
                        wakeWordStatus.textContent = "Listening for 'Aim'...";
                    }
                };

                wakeWordRecognition.onresult = async (event) => {
                    if (isProcessingCommand) return;
                    
                    const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
                    console.log("Heard:", transcript);

                    // Allow 'aim' or 'a i m'
                    if (transcript.includes('aim') || transcript.includes('a i m') || transcript.includes('hey am') || transcript.includes('a.m.')) {
                        isProcessingCommand = true;
                        wakeWordRecognition.stop(); // Pause listening
                        wakeWordBtn.classList.remove('listening');
                        wakeWordStatus.textContent = "Processing...";

                        // Extract command
                        let command = transcript.replace(/.*?(aim|a i m|hey am|a\.m\.)/i, '').trim();
                        // Remove punctuation from start
                        command = command.replace(/^[.,\/#!$%\^&\*;:{}=\-_`~()]+/, "").trim();

                        if (command) {
                            // Intercept YouTube Voice Commands
                            if (command.includes('pause music') || command.includes('pause the music') || command === 'pause') {
                                if (window.ytPlayer && window.ytPlayer.pauseVideo) window.ytPlayer.pauseVideo();
                                appendMessage("Paused music.", 'bot', deviceChatMessages);
                            } else if (command.includes('volume') || command.includes('turn the music up') || command.includes('turn the music down')) {
                                if (window.ytPlayer && window.ytPlayer.setVolume) {
                                    let currentVol = window.ytPlayer.getVolume();
                                    if (command.includes('up')) {
                                        window.ytPlayer.setVolume(Math.min(100, currentVol + 20));
                                        appendMessage("Turned volume up.", 'bot', deviceChatMessages);
                                    } else if (command.includes('down')) {
                                        window.ytPlayer.setVolume(Math.max(0, currentVol - 20));
                                        appendMessage("Turned volume down.", 'bot', deviceChatMessages);
                                    } else {
                                        // Try to extract a number
                                        const match = command.match(/\d+/);
                                        if (match) {
                                            const vol = parseInt(match[0], 10);
                                            window.ytPlayer.setVolume(Math.min(100, Math.max(0, vol)));
                                            appendMessage(`Set volume to ${vol}%.`, 'bot', deviceChatMessages);
                                        } else {
                                            appendMessage("I couldn't understand the volume level.", 'bot', deviceChatMessages);
                                        }
                                    }
                                }
                            } else if (command.startsWith('play ')) {
                                const songName = command.replace('play ', '').trim();
                                if (songName === 'music' || songName === 'the music') {
                                    if (window.ytPlayer && window.ytPlayer.playVideo) window.ytPlayer.playVideo();
                                    appendMessage("Playing music.", 'bot', deviceChatMessages);
                                } else {
                                    appendMessage(`Searching YouTube for "${songName}"...`, 'bot', deviceChatMessages);
                                    try {
                                        const res = await fetch('/api/youtube-search', {
                                            method: 'POST',
                                            headers: {'Content-Type': 'application/json'},
                                            body: JSON.stringify({ query: songName })
                                        });
                                        const data = await res.json();
                                        if (data.videoId && data.videoId.length >= 11) {
                                            // Extract just the 11 character ID in case Gemini added extra fluff
                                            const idMatch = data.videoId.match(/[a-zA-Z0-9_-]{11}/);
                                            if (idMatch && window.ytPlayer && window.ytPlayer.loadVideoById) {
                                                window.ytPlayer.loadVideoById(idMatch[0]);
                                                appendMessage(`Playing ${songName}.`, 'bot', deviceChatMessages);
                                            } else {
                                                appendMessage("Couldn't find that song.", 'bot', deviceChatMessages);
                                            }
                                        } else {
                                            appendMessage("Couldn't find that song.", 'bot', deviceChatMessages);
                                        }
                                    } catch (e) {
                                        appendMessage("Error searching for song.", 'bot', deviceChatMessages);
                                    }
                                }
                            } else if (command.includes('skip song') || command.includes('skip this song') || command.includes('next song') || command === 'skip') {
                                if (window.ytPlayer && window.ytPlayer.nextVideo) window.ytPlayer.nextVideo();
                                appendMessage("Skipped to next song.", 'bot', deviceChatMessages);
                            } else {
                                deviceChatInput.value = command;
                                await handleDeviceChat();
                            }
                        } else {
                            const utterance = new SpeechSynthesisUtterance("Yes? I'm listening.");
                            window.speechSynthesis.speak(utterance);
                        }

                        // Wait for TTS to finish before resuming
                        const checkSpeaking = setInterval(() => {
                            if (!window.speechSynthesis.speaking) {
                                clearInterval(checkSpeaking);
                                isProcessingCommand = false;
                                if (isWakeWordMode) wakeWordRecognition.start();
                            }
                        }, 500);
                    }
                };

                wakeWordRecognition.onend = () => {
                    if (isWakeWordMode && !isProcessingCommand) {
                        try { wakeWordRecognition.start(); } catch(e){}
                    } else if (!isWakeWordMode) {
                        wakeWordBtn.classList.remove('listening');
                        wakeWordStatus.textContent = 'Enable "Hey AI.M"';
                    }
                };

                wakeWordBtn.addEventListener('click', () => {
                    isWakeWordMode = !isWakeWordMode;
                    if (isWakeWordMode) {
                        try { wakeWordRecognition.start(); } catch(e){}
                    } else {
                        isProcessingCommand = false;
                        wakeWordRecognition.stop();
                    }
                });
            }
        }
    }
    // Govee Devices Logic
    const devicesGrid = document.getElementById('devices-grid');
    if (devicesGrid) {
        fetchDevices();
      // Handle Weather Fetching on Load
    fetchWeather();
    }

    // YOUTUBE LOGIC
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = function() {
        window.ytPlayer = new YT.Player('youtube-player', {
            height: '250',
            width: '100%',
            playerVars: {
                listType: 'playlist',
                list: 'PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG', // YouTube Top Hits Playlist
                autoplay: 0,
                controls: 1,
                modestbranding: 1
            }
        });
    }

    // LOCATION LOGIC
    window.userLocationString = "Unknown";
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await res.json();
                if (data && data.display_name) {
                    window.userLocationString = data.display_name;
                    // Update Map widget to current location
                    const mapIframe = document.getElementById('map-iframe');
                    if (mapIframe) {
                        mapIframe.src = `https://maps.google.com/maps?q=${latitude},${longitude}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
                    }
                }
            } catch(e) {
                console.error("Geocoding failed", e);
            }
        }, (error) => {
            console.error("Geolocation error:", error);
        });
    }

    async function fetchWeather() {
        const weatherTemp = document.getElementById('weather-temp');
        const weatherDesc = document.getElementById('weather-desc');
        const weatherIcon = document.getElementById('weather-icon-el');
        if (!weatherTemp) return;

        try {
            // London coordinates
            const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=51.5074&longitude=-0.1278&current_weather=true');
            const data = await response.json();
            
            if (data && data.current_weather) {
                const temp = data.current_weather.temperature;
                const code = data.current_weather.weathercode;
                
                weatherTemp.textContent = `${temp}°C`;
                
                let desc = "Clear";
                let iconClass = "fa-cloud-sun";
                
                if (code === 0) { desc = "Clear Sky"; iconClass = "fa-sun"; }
                else if (code <= 3) { desc = "Partly Cloudy"; iconClass = "fa-cloud-sun"; }
                else if (code <= 49) { desc = "Foggy"; iconClass = "fa-smog"; }
                else if (code <= 69) { desc = "Raining"; iconClass = "fa-cloud-rain"; }
                else if (code <= 79) { desc = "Snowing"; iconClass = "fa-snowflake"; }
                else { desc = "Stormy"; iconClass = "fa-cloud-bolt"; }
                
                weatherDesc.textContent = `London (${desc})`;
                weatherIcon.className = `fa-solid ${iconClass}`;
            }
        } catch (err) {
            console.error('Weather fetch error:', err);
            weatherDesc.textContent = "Weather unavailable";
        }
    }

    async function fetchDevices() {
        try {
            const response = await fetch('/api/devices');
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch devices');
            }
            
            const data = await response.json();
            const devices = data.data?.devices || [];
            window.connectedDevices = devices;
            renderDevices(devices);
        } catch (error) {
            console.error('Error fetching devices:', error);
            devicesGrid.innerHTML = `
                <div class="card glass">
                    <p style="color: var(--primary);">Error: ${error.message}</p>
                    <p>Make sure your server is running and GOVEE_API_KEY is set in .env.</p>
                </div>
            `;
        }
    }

    function hexToRgb(hex) {
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function(m, r, g, b) {
            return r + r + g + g + b + b;
        });

        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function renderDevices(devices) {
        devicesGrid.innerHTML = ''; // Clear loading state
        
        if (devices.length === 0) {
            devicesGrid.innerHTML = `
                <div class="card glass">
                    <p>No Govee devices found or API key is invalid.</p>
                </div>
            `;
            return;
        }

        devices.forEach(device => {
            const card = document.createElement('div');
            card.className = 'card glass feature-card';
            
            // Check if the device supports color or brightness commands
            const supportsColor = device.supportCmds && device.supportCmds.includes('color');
            const supportsBrightness = device.supportCmds && device.supportCmds.includes('brightness');
            const isLight = supportsColor || supportsBrightness || (device.deviceName && device.deviceName.toLowerCase().includes('light'));
            
            const icon = isLight ? 'fa-lightbulb' : 'fa-plug';
            
            let extraControls = '';
            if (isLight) {
                let colorControl = supportsColor ? `
                    <div class="control-group">
                        <label>Color:</label>
                        <div class="color-picker-container">
                            <div class="pickr-container-${device.device.replace(/:/g, '')}"></div>
                        </div>
                    </div>
                ` : '';
                
                let brightnessControl = supportsBrightness ? `
                    <div class="control-group">
                        <label>Brightness:</label>
                        <input type="range" min="0" max="100" value="100" onchange="window.controlDevice('${device.device}', '${device.model}', 'brightness', parseInt(this.value));" class="modern-range">
                    </div>
                ` : '';

                if (colorControl || brightnessControl) {
                    extraControls = `
                        <div class="light-controls" style="margin-top: 15px; display: flex; flex-direction: column; gap: 10px; align-items: center;">
                            ${colorControl}
                            ${brightnessControl}
                        </div>
                    `;
                }
            }

            card.innerHTML = `
                <div class="card-image-placeholder">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <h3>${device.deviceName || 'Unknown Device'}</h3>
                <p>Model: ${device.model}</p>
                <div class="device-controls" style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
                    <button class="btn btn-primary" onclick="controlDevice('${device.device}', '${device.model}', 'turn', 'on')">Turn On</button>
                    <button class="btn" onclick="controlDevice('${device.device}', '${device.model}', 'turn', 'off')" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 10px 20px; border-radius: 5px; cursor: pointer; transition: all 0.3s ease;">Turn Off</button>
                </div>
                ${extraControls}
            `;
            devicesGrid.appendChild(card);
        });

        // Initialize Pickr for devices that support color
        devices.forEach(device => {
            const supportsColor = device.supportCmds && device.supportCmds.includes('color');
            if (supportsColor) {
                const className = `.pickr-container-${device.device.replace(/:/g, '')}`;
                const pickrElement = document.querySelector(className);
                
                if (pickrElement) {
                    const pickr = Pickr.create({
                        el: className,
                        theme: 'monolith',
                        default: '#ffffff',
                        swatches: [
                            '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#ffffff', '#ff8800'
                        ],
                        components: {
                            preview: true,
                            opacity: false,
                            hue: true,
                            interaction: {
                                input: true,
                                save: true
                            }
                        }
                    });

                    pickr.on('save', (color, instance) => {
                        const rgba = color.toRGBA();
                        const rgb = {
                            r: Math.round(rgba[0]),
                            g: Math.round(rgba[1]),
                            b: Math.round(rgba[2])
                        };
                        window.controlDevice(device.device, device.model, 'color', rgb);
                        instance.hide();
                    });
                }
            }
        });
    }

    // Expose hexToRgb to global scope for the inline onchange handlers
    window.hexToRgb = hexToRgb;

    // Expose controlDevice to global scope so inline onclick works
    const deviceStatusMessage = document.getElementById('device-status-message');
    window.controlDevice = async function(deviceId, model, cmdType, cmdValue) {
        try {
            deviceStatusMessage.textContent = 'Sending command...';
            deviceStatusMessage.classList.remove('hidden');
            
            const response = await fetch('/api/devices/control', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    device: deviceId,
                    model: model,
                    cmd: {
                        name: cmdType,
                        value: cmdValue
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to control device');
            }

            deviceStatusMessage.textContent = 'Command sent successfully!';
            setTimeout(() => {
                deviceStatusMessage.classList.add('hidden');
            }, 3000);
        } catch (error) {
            console.error('Error controlling device:', error);
            deviceStatusMessage.textContent = `Error: ${error.message}`;
            setTimeout(() => {
                deviceStatusMessage.classList.add('hidden');
            }, 5000);
        }
    }
});
