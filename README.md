# Knexa

A skill-sharing platform where users can create profiles, list skills they want to learn, and skills they can teach. The platform's matching engine connects users based on complementary skill DNA.

## 🎯 Problem Statement
People often struggle to find accessible, personalized mentorship or practical guidance for learning new skills. Traditional courses can be rigid, while finding a mentor can be difficult and expensive. Knexa solves this by connecting individuals who want to learn new skills with those who are willing to teach or share their expertise, fostering a community of collaborative learning.

## ✨ Key Features
- **Skill DNA:** A unique visualization of a user's skill set and learning goals.
- **Matching Engine:** Algorithm to connect users with complementary skills.
- **Real-time Messaging:** Integrated chat for seamless communication.
- **Community Hubs:** Topic-specific groups for broader discussions.

## 👥 Target Users
- **Learners:** Individuals looking to acquire new skills.
- **Mentors/Experts:** Professionals or hobbyists who want to share their knowledge.
- **Enthusiasts:** People looking for a community of like-minded individuals to collaborate on projects.

## 🛠️ Technical Stack
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla).
- **Backend/Database:** Supabase (PostgreSQL) for user authentication, database management, and real-time features.
- **Architecture:** Single Page Application (SPA) feel with dynamic content loading using modern JavaScript fetch APIs and DOM manipulation.

## 🗺️ Information Architecture
- **Home/Landing Page:** Introduction, value proposition, and sign up/login.
- **Dashboard:** Overview of matches, recent activity, and quick links.
- **Discover:** Search and filter engine to find users, communities, and skills.
- **Profile:** User's skill DNA, bio, learning goals, and teaching offerings.
- **Messages:** Direct communication channel between matched users.
- **Communities:** Groups centered around specific topics or skills.

## 🚀 Getting Started

To run the Knexa platform locally on your machine, follow these steps:

### Prerequisites
- A modern web browser
- A code editor like VS Code
- A local server environment (like Live Server extension in VS Code or Python's `http.server`)

### Installation & Setup
1. **Clone the repository:**
   ```bash
   git clone https://github.com/Prawin-Jovi-AR/Knexa.git
   cd knexa
   ```
2. **Setup Supabase Environment Variables:**
   - Rename `js/env.example.js` to `js/env.js`.
   - Open `js/env.js` and add your Supabase Project URL and Anon Key.
3. **Launch the app:**
   - Start a local development server in the root of the project. If you are using VS Code, you can click "Go Live" with the Live Server extension.
   - Alternatively, you can use Python to serve the directory:
     ```bash
     python -m http.server 3000
     ```
   - Open your browser and navigate to `http://localhost:3000`.

## 📖 How to Use

1. **Sign Up / Login:** Create a new account or log in if you already have one. Authentication is handled securely via Supabase.
2. **Create Your Profile:** Fill out your biography and most importantly, select the skills you want to learn and the skills you can teach.
3. **Discover Matches:** Navigate to the Dashboard or Discover page to see users whose skill DNA complements yours (e.g., someone looking to learn a skill you can teach).
4. **Connect & Message:** Click on a match's profile to view more details and use the integrated messaging system to reach out and start exchanging knowledge.
5. **Join Communities:** Participate in topic-specific community hubs to ask questions, share resources, and connect with a broader group of enthusiasts.
