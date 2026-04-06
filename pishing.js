import React, { useState, useEffect, useRef } from 'react';
import { Smile, Send, Bot, User, AlertTriangle, Loader } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp } from 'firebase/firestore';

// --- Firebase Configuration ---
// This now uses the environment's configuration automatically.
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config)
  : { apiKey: "FALLBACK_API_KEY", authDomain: "FALLBACK_AUTH_DOMAIN", projectId: "FALLBACK_PROJECT_ID" };

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Main App Component
export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [phishingScore, setPhishingScore] = useState(null);
  const [analysis, setAnalysis] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);

  const chatEndRef = useRef(null);

  // --- Authentication ---
  // Handles user sign-in automatically using the environment's token.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsAuthReady(true);
      } else if (typeof __initial_auth_token !== 'undefined') {
        try {
          await signInWithCustomToken(auth, __initial_auth_token);
        } catch (error) {
          console.error("Custom token sign-in failed:", error);
          setIsAuthReady(true); // Still ready, but failed auth
        }
      } else {
        try {
          await signInAnonymously(auth);
        } catch(error) {
            console.error("Anonymous sign-in failed:", error);
            setIsAuthReady(true); // Still ready, but failed auth
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Firestore Message Sync ---
  // Fetches chat history and listens for new messages.
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const messagesColPath = `artifacts/${appId}/users/${user.uid}/messages`;
    const q = query(collection(db, messagesColPath));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = [];
      querySnapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort messages by timestamp client-side for robustness
      msgs.sort((a, b) => a.timestamp?.toMillis() - b.timestamp?.toMillis());
      
      setMessages(msgs);

      if (msgs.length === 0) {
        startNewSession();
      }
    }, (error) => {
        console.error("Firestore snapshot error: ", error);
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // --- Chat Scroll ---
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // --- Gemini API Call ---
  const callGeminiAPI = async (prompt) => {
      const apiKey = ""; // This is handled by the environment, so it can be left empty.
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      
      const payload = {
          contents: [{ role: "user", parts: [{ text: prompt }] }]
      };

      try {
          const response = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
          
          if (!response.ok) {
              throw new Error(`API call failed with status: ${response.status}`);
          }

          const result = await response.json();
          if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
            return result.candidates[0].content.parts[0].text;
          } else {
            console.error("Unexpected API response structure:", result);
            return "Sorry, I encountered an error. Let's try that again.";
          }
      } catch (error) {
          console.error("Error calling Gemini API:", error);
          return "Sorry, I'm having trouble connecting. Please try again later.";
      }
  };

  // --- Add Message to Firestore ---
  const addMessageToDb = async (message) => {
    if (!user) return;
    const messagesColPath = `artifacts/${appId}/users/${user.uid}/messages`;
    await addDoc(collection(db, messagesColPath), {
      ...message,
      timestamp: serverTimestamp()
    });
  };

  // --- Start New Simulation Session ---
  const startNewSession = async () => {
      setSessionActive(false);
      setIsTyping(true);
      setShowAnalysis(false);
      setPhishingScore(null);
      setAnalysis('');

      const botWelcome = {
          text: "Hello! I'm your personal security assistant. I'll generate a phishing message, and you tell me if it's a threat. Ready to start?",
          isUser: false
      };
      await addMessageToDb(botWelcome);

      const prompt = "Generate a creative and realistic phishing email or text message. Make it subtle. Include a fake link that looks plausible but is not a real, well-known domain.";
      const scenario = await callGeminiAPI(prompt);
      setCurrentScenario(scenario);
      
      const botScenario = {
          text: `Great! Here's the scenario:\n\n${scenario}`,
          isUser: false,
          isPhishingAttempt: true
      };
      await addMessageToDb(botScenario);
      
      setIsTyping(false);
      setSessionActive(true);
  };
  
  // --- Handle User Message Submission ---
  const handleSend = async () => {
    if (input.trim() === '' || !sessionActive) return;

    const userMessage = { text: input, isUser: true };
    await addMessageToDb(userMessage);
    setInput('');
    setIsTyping(true);
    setSessionActive(false);

    const analysisPrompt = `
      Analyze the following potential phishing message and the user's response.
      
      Phishing Message: "${currentScenario}"
      User's Analysis: "${input}"

      Based on this, provide:
      1. A "phishing score" from 0 to 100, where 100 is a definite phishing attempt.
      2. A brief, clear analysis explaining the signs of phishing (or lack thereof) in the message. Explain why the user's analysis was correct or incorrect. Format this as a friendly, educational explanation.

      Return ONLY a JSON object with "score" and "analysis" keys. Example: {"score": 85, "analysis": "This looks like phishing because..."}
    `;

    const rawResponse = await callGeminiAPI(analysisPrompt);
    
    try {
        const jsonString = rawResponse.replace(/```json|```/g, '').trim();
        const result = JSON.parse(jsonString);
        setPhishingScore(result.score);
        setAnalysis(result.analysis);
    } catch (e) {
        console.error("Failed to parse Gemini response:", e, "Raw response:", rawResponse);
        setPhishingScore(50);
        setAnalysis("I had trouble analyzing the response fully, but let's review the original message for common phishing signs.");
    }

    setShowAnalysis(true);
    setIsTyping(false);
  };

  // --- Render Individual Message ---
  const renderMessage = (msg) => {
    const messageClasses = msg.isUser
      ? 'bg-blue-500 text-white self-end'
      : 'bg-gray-200 text-gray-800 self-start';
    const icon = msg.isUser ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6" />;

    return (
      <div key={msg.id} className={`flex items-start gap-3 my-4 ${msg.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`p-2 rounded-full ${msg.isUser ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-700'}`}>
            {icon}
        </div>
        <div
          className={`max-w-md md:max-w-lg rounded-lg p-4 text-sm shadow-sm ${messageClasses}`}
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {msg.text}
          {msg.isPhishingAttempt && (
            <div className="mt-3 p-3 bg-red-100 border-l-4 border-red-500 text-red-800 rounded-r-lg">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                <h4 className="font-bold">Potential Phishing Message</h4>
              </div>
              <p className="text-xs mt-1">This is a simulated phishing message. Analyze it carefully.</p>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // --- Main Render ---
  if (!isAuthReady) {
    return (
        <div className="flex items-center justify-center h-screen bg-gray-50">
            <Loader className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="ml-4 text-gray-600">Connecting to the simulator...</p>
        </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <header className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">AI Phishing Simulator</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Bot className="w-5 h-5" />
            <span>Powered by Gemini</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          {messages.map(renderMessage)}
          {isTyping && (
            <div className="flex items-start gap-3 my-4 flex-row">
                 <div className="p-2 rounded-full bg-gray-200 text-gray-700">
                    <Bot className="w-6 h-6" />
                </div>
              <div className="bg-gray-200 text-gray-800 self-start rounded-lg p-4 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </main>
      
      {showAnalysis && (
        <div className="bg-white p-4 md:p-6 border-t border-gray-200 shadow-lg">
            <div className="max-w-4xl mx-auto">
                <h3 className="text-lg font-bold mb-2 text-gray-800">Analysis Complete</h3>
                <div className="flex items-center gap-4 mb-4">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold transition-all duration-500 ${phishingScore > 70 ? 'bg-red-500' : phishingScore > 40 ? 'bg-yellow-500' : 'bg-green-500'}`}>
                        {phishingScore !== null ? `${phishingScore}%` : <Loader className="animate-spin" />}
                    </div>
                    <div>
                        <p className="font-semibold text-gray-800">Likelihood of Phishing</p>
                        <p className="text-sm text-gray-600">Our AI-powered analysis of the message content.</p>
                    </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-700" style={{ whiteSpace: 'pre-wrap' }}>{analysis || "Analyzing..."}</p>
                </div>
                 <button 
                    onClick={startNewSession}
                    className="mt-4 w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors font-semibold"
                >
                    Start New Simulation
                </button>
            </div>
        </div>
      )}

      <footer className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center bg-gray-100 rounded-lg p-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={sessionActive ? "Type your analysis here..." : "A new scenario is being generated..."}
              className="flex-1 bg-transparent px-4 py-2 text-sm text-gray-800 focus:outline-none"
              disabled={!sessionActive || showAnalysis || isTyping}
            />
            <button
              onClick={handleSend}
              className="p-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed"
              disabled={!input.trim() || !sessionActive || showAnalysis || isTyping}
            >
              <Send />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
