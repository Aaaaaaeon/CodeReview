document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const providerSelect = document.getElementById('providerSelect');
    const apiKeyGroup = document.getElementById('apiKeyGroup');
    const ollamaEndpointGroup = document.getElementById('ollamaEndpointGroup');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    
    const auditBtn = document.getElementById('auditBtn');
    const codeInput = document.getElementById('codeInput');
    
    const emptyState = document.getElementById('emptyState');
    const loadingState = document.getElementById('loadingState');
    const resultsState = document.getElementById('resultsState');
    
    const reportStats = document.getElementById('reportStats');
    const statCritique = document.getElementById('statCritique');
    const statMajeur = document.getElementById('statMajeur');
    const statMineur = document.getElementById('statMineur');

    // Default Settings (Override with config.js if present)
    let currentConfig = {
        provider: window.CODEREVIEW_CONFIG?.provider || 'mistral-api',
        apiKey: window.CODEREVIEW_CONFIG?.mistralApiKey || '',
        ollamaEndpoint: window.CODEREVIEW_CONFIG?.ollamaEndpoint || 'http://localhost:11434/api/generate'
    };

    // Load Settings
    function loadSettings() {
        const saved = localStorage.getItem('codeReviewConfig');
        if (saved) {
            currentConfig = { ...currentConfig, ...JSON.parse(saved) };
        }
        
        providerSelect.value = currentConfig.provider;
        document.getElementById('apiKey').value = currentConfig.apiKey;
        document.getElementById('ollamaEndpoint').value = currentConfig.ollamaEndpoint;
        
        toggleSettingGroups();
    }

    // Save Settings
    function saveSettings() {
        currentConfig.provider = providerSelect.value;
        currentConfig.apiKey = document.getElementById('apiKey').value.trim();
        currentConfig.ollamaEndpoint = document.getElementById('ollamaEndpoint').value.trim();
        
        localStorage.setItem('codeReviewConfig', JSON.stringify(currentConfig));
        settingsModal.classList.remove('show');
    }

    // Toggle Form Groups
    function toggleSettingGroups() {
        if (providerSelect.value === 'mistral-api') {
            apiKeyGroup.style.display = 'flex';
            ollamaEndpointGroup.style.display = 'none';
        } else {
            apiKeyGroup.style.display = 'none';
            ollamaEndpointGroup.style.display = 'flex';
        }
    }

    providerSelect.addEventListener('change', toggleSettingGroups);
    settingsBtn.addEventListener('click', () => settingsModal.classList.add('show'));
    closeSettings.addEventListener('click', () => settingsModal.classList.remove('show'));
    saveSettingsBtn.addEventListener('click', saveSettings);
    
    // Close modal on outside click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.remove('show');
    });

    loadSettings();

    // -------------------------
    // Audit Logic
    // -------------------------

    const SYSTEM_PROMPT = `Tu es un auditeur en accessibilité web expert (RGAA / WCAG).
Ton objectif est d'analyser le code HTML/CSS fourni et d'identifier les problèmes d'accessibilité.
Réponds EXCLUSIVEMENT et STRICTEMENT au format JSON avec la structure exacte suivante :
{
  "erreurs": [
    {
      "severite": "Critique" ou "Majeur" ou "Mineur",
      "ligne": "Élément HTML ou extrait de code concerné",
      "description": "Description claire et concise du problème d'accessibilité",
      "correction": "Explication ou bout de code pour corriger le problème"
    }
  ]
}
S'il n'y a aucune erreur, renvoie { "erreurs": [] }.
Ne rajoute AUCUN texte, markdown (pas de \`\`\`json) ou explication en dehors de cet objet JSON.`;

    auditBtn.addEventListener('click', async () => {
        const code = codeInput.value.trim();
        if (!code) {
            alert('Veuillez coller du code HTML/CSS à analyser.');
            return;
        }

        if (currentConfig.provider === 'mistral-api' && !currentConfig.apiKey) {
            alert('Veuillez configurer votre clé API Mistral dans les paramètres.');
            settingsModal.classList.add('show');
            return;
        }

        // Set UI to loading
        emptyState.style.display = 'none';
        resultsState.style.display = 'none';
        reportStats.style.display = 'none';
        loadingState.style.display = 'flex';
        auditBtn.disabled = true;

        try {
            let jsonResponse;

            if (currentConfig.provider === 'mistral-api') {
                // Official Mistral API
                const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${currentConfig.apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'mistral-small-latest',
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: code }
                        ],
                        response_format: { type: "json_object" }
                    })
                });

                if (!response.ok) {
                    throw new Error(`Erreur API Mistral: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                const content = data.choices[0].message.content;
                jsonResponse = parseLLMResponse(content);

            } else {
                // Ollama Local API
                const response = await fetch(currentConfig.ollamaEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'mistral',
                        system: SYSTEM_PROMPT,
                        prompt: code,
                        stream: false,
                        format: 'json'
                    })
                });

                if (!response.ok) {
                    throw new Error(`Erreur Ollama: ${response.status} ${response.statusText}. Assurez-vous qu'Ollama est lancé.`);
                }

                const data = await response.json();
                jsonResponse = parseLLMResponse(data.response);
            }

            renderResults(jsonResponse.erreurs || []);

        } catch (error) {
            console.error(error);
            loadingState.style.display = 'none';
            emptyState.style.display = 'flex';
            emptyState.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--critique-color)"></i><p style="color: var(--critique-color)">Une erreur est survenue: ${error.message}</p>`;
        } finally {
            auditBtn.disabled = false;
        }
    });

    // Extract JSON safely from potential markdown block
    function parseLLMResponse(text) {
        try {
            // Sometime LLMs still wrap in markdown even when instructed not to
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON:", text);
            throw new Error("Le modèle a retourné un format invalide. Réessayez.");
        }
    }

    function renderResults(erreurs) {
        loadingState.style.display = 'none';
        resultsState.style.display = 'flex';
        resultsState.innerHTML = '';

        if (!erreurs || erreurs.length === 0) {
            resultsState.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-check-circle" style="color: #10b981;"></i>
                    <p>Aucun problème d'accessibilité majeur détecté ! Bon travail.</p>
                </div>`;
            reportStats.style.display = 'none';
            return;
        }

        // Stats
        let critiqueCount = 0;
        let majeurCount = 0;
        let mineurCount = 0;

        erreurs.forEach(err => {
            const card = document.createElement('div');
            const severityClass = err.severite.toLowerCase() === 'critique' ? 'critique' : 
                                 err.severite.toLowerCase() === 'majeur' ? 'majeur' : 'mineur';
            
            if (severityClass === 'critique') critiqueCount++;
            else if (severityClass === 'majeur') majeurCount++;
            else mineurCount++;

            let icon = 'fa-circle-info';
            if (severityClass === 'critique') icon = 'fa-triangle-exclamation';
            if (severityClass === 'majeur') icon = 'fa-circle-exclamation';

            card.className = `error-card ${severityClass}`;
            card.innerHTML = `
                <div class="error-header">
                    <span class="error-badge"><i class="fa-solid ${icon}"></i> ${err.severite}</span>
                    <span class="error-line">${escapeHTML(err.ligne || 'N/A')}</span>
                </div>
                <div class="error-desc">${escapeHTML(err.description)}</div>
                <div class="error-correction">
                    <h4><i class="fa-solid fa-wrench"></i> Suggestion de correction</h4>
                    <p>${escapeHTML(err.correction)}</p>
                </div>
            `;
            resultsState.appendChild(card);
        });

        // Update Stats UI
        statCritique.textContent = critiqueCount;
        statCritique.style.display = critiqueCount > 0 ? 'inline-block' : 'none';
        statMajeur.textContent = majeurCount;
        statMajeur.style.display = majeurCount > 0 ? 'inline-block' : 'none';
        statMineur.textContent = mineurCount;
        statMineur.style.display = mineurCount > 0 ? 'inline-block' : 'none';
        reportStats.style.display = 'flex';
    }

    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
});
