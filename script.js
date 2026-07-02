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

            if (sender === 'bot' && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.15; // Speak a bit faster (default is 1.0)
                utterance.pitch = 1.05; // Slightly more natural pitch

                // Try to find a more human-sounding voice instead of the default robot
                const voices = window.speechSynthesis.getVoices();
                const humanVoice = voices.find(v => 
                    v.name.includes('Natural') || 
                    v.name.includes('Google') || 
                    v.name.includes('Samantha') || 
                    v.name.includes('Zira')
                );
                
                if (humanVoice) {
                    utterance.voice = humanVoice;
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
            if (lowerInput.includes('turn on') || lowerInput.includes('turn it on') || lowerInput === 'on') detectedCommand = 'on';
            else if (lowerInput.includes('turn off') || lowerInput.includes('turn it off') || lowerInput === 'off') detectedCommand = 'off';
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

            // If it's a weather request, pass it to Gemini!
            if (lowerInput.includes('weather') || lowerInput.includes('temperature') || lowerInput.includes('rain')) {
                return await getGeneralBotResponse(input);
            }

            return "I didn't recognize that device command. Try 'turn it on' or ask about the weather!";
        }

        async function getGeneralBotResponse(input) {
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: input })
                });
                if (!response.ok) throw new Error('API Error');
                const data = await response.json();
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
        }
    }
    // Govee Devices Logic
    const devicesGrid = document.getElementById('devices-grid');
    const deviceStatusMessage = document.getElementById('device-status-message');

    if (devicesGrid) {
        fetchDevices();
        fetchWeather();
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
