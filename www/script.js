class PickleballRemoteApp {
    constructor() {
        // Korrekte Server-URL für Set-Management Backend
        this.API_BASE_URL = 'http://91.99.146.195:8001';
        this.sessionId = null;
        this.currentGameState = null;
        this.init();
    }

    async init() {
        console.log('Loading Pickleball Remote App with Set Management...');
        
        document.getElementById('joinBtn').addEventListener('click', () => {
            const sessionId = document.getElementById('sessionInput').value.trim();
            console.log('Join button clicked, sessionId:', sessionId);
            this.joinSession(sessionId);
        });

        this.setupScoreButtons();
    }

    setupScoreButtons() {
        // Team A Score Buttons
        const addPointA = document.getElementById('addPointA');
        const subtractPointA = document.getElementById('subtractPointA');
        
        // Team B Score Buttons
        const addPointB = document.getElementById('addPointB');
        const subtractPointB = document.getElementById('subtractPointB');

        if (addPointA) {
            addPointA.addEventListener('click', () => this.updateScore('A', 'add'));
        }
        if (subtractPointA) {
            subtractPointA.addEventListener('click', () => this.updateScore('A', 'subtract'));
        }
        if (addPointB) {
            addPointB.addEventListener('click', () => this.updateScore('B', 'add'));
        }
        if (subtractPointB) {
            subtractPointB.addEventListener('click', () => this.updateScore('B', 'subtract'));
        }
    }

    async joinSession(sessionId) {
        console.log('Starting joinSession for:', sessionId);
       
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/session/${sessionId}/join`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                mode: 'cors'
            });
           
            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);
           
            if (data.success) {
                console.log('Session join successful, switching to score section');
                this.sessionId = sessionId;
                this.currentGameState = data.session;
                this.showScoreSection();
                this.updateUI(data.session);
                this.connectWebSocket();
            } else {
                console.error('Session join failed:', data);
                alert('Session join failed: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Join session error:', error);
            alert('Connection error: ' + error.message);
        }
    }

    connectWebSocket() {
        if (!this.sessionId) return;

        const wsUrl = `ws://91.99.146.195:8001/ws/session/${this.sessionId}`;
        console.log('Connecting to WebSocket:', wsUrl);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log('WebSocket message received:', message);
            
            if (message.type === 'score_update') {
                this.updateUI(message.data);
            } else if (message.type === 'set_complete') {
                this.handleSetComplete(message.data);
            } else if (message.type === 'match_complete') {
                this.handleMatchComplete(message.data);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('WebSocket connection closed');
        };
    }

    async updateScore(team, action) {
        if (!this.sessionId || !this.currentGameState) return;

        // Lokale Score-Aktualisierung
        if (action === 'add') {
            if (team === 'A') {
                this.currentGameState.scoreA += 1;
            } else {
                this.currentGameState.scoreB += 1;
            }
        } else if (action === 'subtract') {
            if (team === 'A') {
                this.currentGameState.scoreA = Math.max(0, this.currentGameState.scoreA - 1);
            } else {
                this.currentGameState.scoreB = Math.max(0, this.currentGameState.scoreB - 1);
            }
        }

        // UI sofort aktualisieren
        this.updateUI(this.currentGameState);

        // Score an Server senden
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'score_update',
                scoreA: this.currentGameState.scoreA,
                scoreB: this.currentGameState.scoreB,
                server: this.currentGameState.server
            }));
        }
    }

    showScoreSection() {
        console.log('Switching to score section');
        const sessionSection = document.getElementById('sessionSection');
        const scoreSection = document.getElementById('scoreSection');
       
        if (sessionSection) {
            sessionSection.classList.add('hidden');
            console.log('Hidden session section');
        }
        if (scoreSection) {
            scoreSection.classList.remove('hidden');
            console.log('Shown score section');
        }
    }

    updateUI(gameState) {
        console.log('Updating UI with:', gameState);
        
        // Grundlegende Score-Anzeige
        const scoreAElement = document.getElementById('scoreA');
        const scoreBElement = document.getElementById('scoreB');
        
        if (scoreAElement) scoreAElement.textContent = gameState.scoreA || 0;
        if (scoreBElement) scoreBElement.textContent = gameState.scoreB || 0;

        // Team-Namen aktualisieren
        const teamAElement = document.getElementById('teamA');
        const teamBElement = document.getElementById('teamB');
        
        if (teamAElement) teamAElement.textContent = gameState.teamA || 'Team A';
        if (teamBElement) teamBElement.textContent = gameState.teamB || 'Team B';

        // Server-Anzeige
        const serverElement = document.getElementById('serverDisplay');
        if (serverElement) {
            serverElement.textContent = `Aufschlag: Team ${gameState.server || 'A'}`;
        }
    }

    // Set-Management Event-Handler
    handleSetComplete(data) {
        console.log('Set completed:', data);
        alert(`Satz beendet! Gewinner: Team ${data.set_winner}\nStand: ${data.sets_won_A}-${data.sets_won_B}`);
        
        this.currentGameState = {
            ...this.currentGameState,
            current_set: data.current_set,
            sets_won_A: data.sets_won_A,
            sets_won_B: data.sets_won_B,
            scoreA: data.scoreA || 0,
            scoreB: data.scoreB || 0
        };
        
        this.updateUI(this.currentGameState);
    }

    handleMatchComplete(data) {
        console.log('Match completed:', data);
        alert(`Match beendet!\nGewinner: Team ${data.winner}\nEndstand: ${data.final_score}`);
        
        this.currentGameState.match_complete = true;
        this.currentGameState.match_winner = data.winner;
    }

    // Set-Management API-Calls (verfügbar aber ohne UI-Buttons)
    async endCurrentSet(winner) {
        if (!this.sessionId) return;

        try {
            const response = await fetch(`${this.API_BASE_URL}/api/session/${this.sessionId}/end-set`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ winner: winner })
            });

            const data = await response.json();
            console.log('End set response:', data);

            if (data.success) {
                this.currentGameState.current_set = data.current_set;
                this.currentGameState.sets_won_A = data.sets_won_A;
                this.currentGameState.sets_won_B = data.sets_won_B;
                this.currentGameState.scoreA = 0;
                this.currentGameState.scoreB = 0;
                
                this.updateUI(this.currentGameState);

                if (data.match_complete) {
                    alert(`Match beendet! Gewinner: Team ${data.match_winner}`);
                } else {
                    alert(`Satz ${data.current_set - 1} beendet. Team ${winner} gewinnt den Satz!`);
                }
            }
        } catch (error) {
            console.error('Error ending set:', error);
            alert('Fehler beim Beenden des Satzes');
        }
    }

    async startNewSet() {
        if (!this.sessionId) return;

        try {
            const response = await fetch(`${this.API_BASE_URL}/api/session/${this.sessionId}/new-set`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });

            const data = await response.json();
            console.log('New set response:', data);

            if (data.success) {
                this.currentGameState.scoreA = 0;
                this.currentGameState.scoreB = 0;
                this.currentGameState.server = 'A';
                
                this.updateUI(this.currentGameState);
                alert(`Neuer Satz ${data.current_set} gestartet!`);
            }
        } catch (error) {
            console.error('Error starting new set:', error);
            alert('Fehler beim Starten des neuen Satzes');
        }
    }
}

// App initialisieren und global verfügbar machen
console.log('Loading Pickleball Remote App with Set Management...');
window.app = new PickleballRemoteApp();
