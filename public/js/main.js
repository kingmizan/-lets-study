document.addEventListener('DOMContentLoaded', () => {
    // ---- DOM Elements ----
    const timeLeftDisplay = document.getElementById('time-left');
    const sessionTypeDisplay = document.getElementById('session-type');
    const startPauseBtn = document.getElementById('start-pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    const sessionCounterDisplay = document.getElementById('session-counter');

    // Tabs and Views
    const timerView = document.getElementById('timer-view');
    const leaderboardView = document.getElementById('leaderboard-view');
    const timerTabBtn = document.getElementById('timer-tab-btn');
    const leaderboardTabBtn = document.getElementById('leaderboard-tab-btn');

    // Theme Toggle
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = themeToggleBtn.querySelector('i');

    // Leaderboard
    const filterBtns = document.querySelectorAll('.filter-btn');
    const leaderboardTableBody = document.querySelector('#leaderboard-table tbody');
    const userRankDisplay = document.getElementById('user-rank');
    const leaderboardLoading = document.getElementById('leaderboard-loading');

    // Login Modal
    const loginModal = document.getElementById('login-modal');
    const usernameInput = document.getElementById('username-input');
    const loginBtn = document.getElementById('login-btn');

    // --- State Variables ----
    let timer; // Will hold the setInterval instance
    let isRunning = false;
    let secondsLeft = 25 * 60;
    let sessionType = 'Work'; // 'Work', 'Short Break', 'Long Break'
    let workSessionsCompleted = 0;
    let currentUser = null;
    
    // --- Timer Settings (customizable) ----
    const settings = {
        workMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        sessionsForLongBreak: 4
    };

    // --- Core Timer Logic ---
    function updateDisplay() {
        const minutes = Math.floor(secondsLeft / 60);
        const seconds = secondsLeft % 60;
        timeLeftDisplay.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        document.title = `${timeLeftDisplay.textContent} - ${sessionType}`;
    }

    function startPauseTimer() {
        if (isRunning) {
            clearInterval(timer);
            isRunning = false;
            startPauseBtn.textContent = 'Start';
        } else {
            isRunning = true;
            startPauseBtn.textContent = 'Pause';
            timer = setInterval(() => {
                secondsLeft--;
                if (secondsLeft < 0) {
                    clearInterval(timer);
                    handleSessionEnd();
                } else {
                    updateDisplay();
                }
            }, 1000);
        }
    }

    async function handleSessionEnd() {
        new Audio('https://www.soundjay.com/buttons/sounds/button-16.mp3').play();
        if (sessionType === 'Work') {
            // Log completed work session to backend
            await logStudySession(settings.workMinutes);
            workSessionsCompleted++;
            sessionCounterDisplay.textContent = `Completed: ${workSessionsCompleted}`;
            if (workSessionsCompleted % settings.sessionsForLongBreak === 0) {
                sessionType = 'Long Break';
                secondsLeft = settings.longBreakMinutes * 60;
            } else {
                sessionType = 'Short Break';
                secondsLeft = settings.shortBreakMinutes * 60;
            }
        } else { // It was a break
            sessionType = 'Work';
            secondsLeft = settings.workMinutes * 60;
        }
        
        sessionTypeDisplay.textContent = sessionType;
        isRunning = false;
        startPauseBtn.textContent = 'Start';
        updateDisplay();
    }

    function resetTimer() {
        clearInterval(timer);
        isRunning = false;
        sessionType = 'Work';
        secondsLeft = settings.workMinutes * 60;
        sessionTypeDisplay.textContent = sessionType;
        startPauseBtn.textContent = 'Start';
        updateDisplay();
    }

    // --- Backend Communication ---
    async function logStudySession(minutes) {
        if (!currentUser) return;
        try {
            await fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser, duration: minutes }),
            });
            console.log('Session logged!');
        } catch (error) {
            console.error('Failed to log session:', error);
        }
    }

    async function fetchLeaderboard(period = 'daily') {
        leaderboardTableBody.innerHTML = '';
        userRankDisplay.innerHTML = '';
        leaderboardLoading.style.display = 'block';

        try {
            const response = await fetch(`/api/leaderboard?period=${period}&user=${currentUser}`);
            const data = await response.json();

            // Populate table
            data.leaderboard.forEach(entry => {
                const row = `<tr>
                    <td>${entry.rank}</td>
                    <td>${entry.username}</td>
                    <td>${entry.total_minutes}</td>
                </tr>`;
                leaderboardTableBody.innerHTML += row;
            });
            
            // Display user's rank
            if (data.userRank) {
                userRankDisplay.innerHTML = `Your Rank: <strong>#${data.userRank.rank}</strong> with <strong>${data.userRank.total_minutes}</strong> mins`;
            } else if (currentUser) {
                userRankDisplay.innerHTML = "You haven't studied today. Start a session to get on the board!";
            }

        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
            leaderboardTableBody.innerHTML = '<tr><td colspan="3">Could not load data.</td></tr>';
        } finally {
            leaderboardLoading.style.display = 'none';
        }
    }

    // --- UI and Event Listeners ---
    startPauseBtn.addEventListener('click', startPauseTimer);
    resetBtn.addEventListener('click', resetTimer);

    // Tab switching
    timerTabBtn.addEventListener('click', () => {
        timerView.classList.remove('hidden');
        leaderboardView.classList.add('hidden');
        timerTabBtn.classList.add('active');
        leaderboardTabBtn.classList.remove('active');
    });

    leaderboardTabBtn.addEventListener('click', () => {
        timerView.classList.add('hidden');
        leaderboardView.classList.remove('hidden');
        timerTabBtn.classList.remove('active');
        leaderboardTabBtn.classList.add('active');
        fetchLeaderboard(); // Fetch daily by default
    });

    // Leaderboard filter switching
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            fetchLeaderboard(btn.dataset.period);
        });
    });

    // Theme handling
    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
    });

    // Login handling
    loginBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        if (username) {
            currentUser = username;
            localStorage.setItem('letsStudyUser', username);
            loginModal.style.display = 'none';
        } else {
            alert('Please enter a username.');
        }
    });

    // --- Initial Setup ---
    function initialize() {
        // Check for saved theme
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        if (savedTheme === 'dark') {
            themeIcon.classList.replace('fa-moon', 'fa-sun');
        }
        
        // Check for saved user
        const savedUser = localStorage.getItem('letsStudyUser');
        if (savedUser) {
            currentUser = savedUser;
            loginModal.style.display = 'none';
        }

        updateDisplay();
    }

    initialize();
});
