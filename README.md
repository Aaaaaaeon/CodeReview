# CodeReview - Auditeur Accessibilité

Un petit outil frontend (HTML/CSS/JS pur) pour vérifier rapidement l'accessibilité d'un bout de code HTML ou CSS par rapport aux critères RGAA/WCAG. Il s'appuie sur le modèle Mistral pour générer des retours structurés et classer les erreurs par sévérité.

## Installation & Configuration

Il n'y a pas de dépendances lourdes (pas de node_modules). 

1. Clonez le projet.
2. Créez un fichier `config.js` à la racine en vous basant sur `config.example.js`.
3. Ajoutez votre clé API Mistral dans `config.js` (le fichier est ignoré par git, donc pas de risque de fuite).

```javascript
window.CODEREVIEW_CONFIG = {
    provider: "mistral-api",
    mistralApiKey: "VOTRE_CLE_API",
    ollamaEndpoint: "http://localhost:11434/api/generate"
};
```

*Note : Si vous préférez utiliser une IA locale, vous pouvez basculer le `provider` sur `"ollama"`.*

## Comment lancer

Puisque c'est du JS vanilla, vous pouvez simplement double-cliquer sur `index.html` pour l'ouvrir dans votre navigateur.

Si vous préférez utiliser un serveur local :
```bash
npx serve .
# ou avec python :
python -m http.server 8000
```

## Fonctionnalités

- Analyse du code via Mistral (API officielle ou Ollama en local).
- Formatage du prompt pour exiger un retour strict en JSON.
- Interface séparant les erreurs par niveau (Critique, Majeur, Mineur) avec propositions de correction.
