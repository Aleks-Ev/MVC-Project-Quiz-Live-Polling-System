
---

# 🚀 QuizDash (Kahoot Clone)

**QuizDash** is a real-time, interactive quiz platform built to demonstrate the power of Full-Stack development using .NET and WebSockets. Users can create custom quizzes, join lobbies via unique PIN codes, and compete in live leaderboards.

### ✨ Key Features
* **JWT Authentication:** Secure user registration and login system with token-based authorization.
* **Real-time Lobby:** Players appear instantly in the lobby as they join, powered by **SignalR**.
* **Unified Hosting:** Frontend and Backend run on the same server, eliminating CORS issues and simplifying deployment.
* **Adaptive Mobile UI:** Hybrid interface optimized for both desktop hosts and mobile players using Tailwind CSS.
* **Global Remote Play:** Easy deployment over the internet via ngrok tunneling.
* **Live Scoring:** Scores are synchronized across all clients immediately after each answer.
 

 

### 🛠 Tech Stack
* **Backend:** ASP.NET Core Web API (.NET 8)
* **Security:** JWT (JSON Web Tokens) for secure API access.
* **Real-time Communication:** Microsoft SignalR (WebSockets)
* **Frontend:** JavaScript (ES6+), HTML5, Tailwind CSS
* **Database:** SQLite (Entity Framework Core)
* **Tunneling:** ngrok (for remote play)

---

### 🏁 Getting Started (Step-by-Step)

#### 1. Setup the Backend
* Navigate to the `QuizBackend` folder:
  ```bash
  cd QuizBackend
  dotnet run
  ```
* Look at the terminal output. You should see: `Now listening on: http://localhost:5178`. 
* **Keep this terminal open.**

#### 2. Setup the "Tunnel" (ngrok)
To let your friends join from their phones over mobile data:
1. Start **ngrok** to tunnel your local port:
   ```bash
   ngrok http 5178
   ```
2. A public URL will appear (e.g., `https://abcd-123.ngrok-free.dev`). **Copy it.**

#### 3. Configuration Update
* Open `wwwroot/js/auth.js` and `wwwroot/js/game.js`.
* Update the `API_URL` (or `activeAPI`) to use your new ngrok link:
  ```javascript
  const API_URL = "https://YOUR-LINK.ngrok-free.dev/api";
  ```

---

### 🎮 How to Play

#### Step 1: Authorization (Important!)
To bypass ngrok's security warning, **every device** (Host PC and all Player phones) must:
1. Open this link in the browser: `https://YOUR-LINK.ngrok-free.dev/api/quizzes`
2. Click the blue **"Visit Site"** button. If you see JSON text or a blank screen, you are good to go!

#### Step 2: Account Creation
1. Open the application and go to the **Sign Up page**.
2. Create an account. Your quizzes will be securely linked to your unique `UserId`.

#### Step 3: The Host (Computer)
1. Go to: `http://localhost:5178/Authorization.html`
2. Log in and navigate to the **Dashboard**.
3. Select a quiz and click **"Create Lobby"**. 

#### Step 4: The Players (Phones)
1. Players go to: `https://YOUR-LINK.ngrok-free.dev/start.html`
2. Enter the **PIN** (The Quiz ID from the Host's screen) and a **Nickname**.
3. Click **"Join"** and wait for the Host to start the game!

---
### 📱 Mobile Integration Note
The project features **Adaptive UI Logic.** While the Host view is designed for large screens (projectors/monitors), the Player view is optimized for mobile browsers:

* Touch-friendly oversized buttons for answers.

* Simplified navigation for small screens.

---

### 🧠 Core Concepts Learned
* **SignalR Hubs:** Implementing bi-directional communication to broadcast events (`PlayerJoined`, `GameStarted`, `ScoreUpdated`).
* **Static File Hosting:** Configuring the .NET server to serve HTML/JS files from the `wwwroot` folder.
* **State Management:** Synchronizing local browser storage (`localStorage`) with server-side state.
* **Tunneling & Network:** Understanding how to expose a local dev environment to the public internet safely.
* **Claims-Based Authorization:** Extracting **UserId** from JWT claims to ensure data privacy.

---

### 📸 Preview
[Start Screen Preview] screenshots/starting_screen.jpg
[Authorization Preview](screenshots/authorization_screen.jpg)
[Dashboard Preview](screenshots/dashboard_screen.jpg)
[Lobby Preview](screenshots/lobby_screen_host.jpg)
[Joining to Lobby Preview](screenshots/join_lobby_screen.jpg)
[Quiz Preview](screenshots/quiz_example.jpg)
[Podium Preview](screenshots/finish_screen_podium.jpg)
[Winners Rating Preview](screenshots/finish_screen_statistics.jpg)

---

### 🐾 Developer Note
This project was developed under the strict supervision of a cat with unpredictable behavior and very sharp claws. Use at your own risk. The cat demands 5% of all fictional points earned during the game.