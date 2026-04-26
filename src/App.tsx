/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react';
import { 
  Users, 
  Settings, 
  Play, 
  ChevronRight, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Trophy,
  User,
  Smile,
  ArrowRight,
  RotateCcw,
  Upload,
  Download,
  Lock,
  Unlock,
  Image as ImageIcon,
  FileSpreadsheet,
  Save,
  Copy,
  AlertTriangle,
  X,
  Home
} from 'lucide-react';
import Papa from 'papaparse';

// Types
type QuestionType = 'multiple-choice' | 'true-false' | 'fill-blank' | 'match' | 'multi-select';

interface Question {
  id: string;
  type: QuestionType;
  text: string;
  imageUrl?: string;
  options?: string[];
  correctAnswer: any; // index, array of indices, array of strings, or map
  timeLimit: number;
  matchPairs?: { left: string; right: string }[];
}

interface QuestionStats {
  correct: number;
  incorrect: number;
}

interface QuizState {
  roomCode: string;
  adminKey?: string;
  questions: Question[];
  currentQuestionIndex: number;
  participants: Record<string, { id: string; name: string; score: number; lastAnswer: any; lastAnswerCorrect: boolean | null }>;
  status: "LOBBY" | "QUESTION" | "FEEDBACK" | "FINISHED";
  timeLeft: number;
  isLocked: boolean;
  pacing: "manual" | "auto";
  questionStats?: QuestionStats[];
}

const socket: Socket = io(window.location.origin, {
  transports: ['polling', 'websocket'],
  reconnection: true,
  reconnectionAttempts: 10
});

function HomeButton({ onClick }: { onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="p-2 hover:bg-white/10 rounded-lg transition-colors group flex items-center gap-2 text-white/80 hover:text-white"
    >
      <Home className="w-5 h-5 transition-transform group-hover:scale-110" />
      <span className="text-xs font-semibold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Home</span>
    </button>
  );
}

function InteractiveIcon({ children, className }: { children: React.ReactNode, className?: string }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 25, stiffness: 150 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set((e.clientX - centerX) * 0.3);
    mouseY.set((e.clientY - centerY) * 0.3);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div 
      onMouseMove={handleMouseMove} 
      onMouseLeave={handleMouseLeave}
      className={`relative w-full h-full flex items-center justify-center ${className}`}
    >
      <motion.div style={{ x: springX, y: springY }}>
        {children}
      </motion.div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<'landing' | 'auth' | 'session'>('landing');
  const [role, setRole] = useState<'admin' | 'participant' | null>(null);
  const [gameState, setGameState] = useState<QuizState | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      // Auto-reconnect if admin key exists
      const savedKey = localStorage.getItem('quizAdminKey');
      if (savedKey) {
        socket.emit('admin:reconnect', savedKey);
      }
    });

    socket.on('quiz_state', (state: QuizState) => {
      setGameState(state);
    });

    socket.on('admin:key', (key: string) => {
      localStorage.setItem('quizAdminKey', key);
    });

    socket.on('join_success', () => {
      setHasJoined(true);
      setView('session');
    });

    socket.on('kicked', () => {
      setHasJoined(false);
      setPlayerName('');
      setView('landing');
      setRole(null);
      alert('The session has ended or you have been removed.');
    });

    return () => {
      socket.off('connect');
      socket.off('quiz_state');
      socket.off('admin:key');
      socket.off('join_success');
      socket.off('kicked');
    };
  }, []);

  const handleStartSession = (selectedRole: 'admin' | 'participant') => {
    setRole(selectedRole);
    setView('auth');
  };

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-bg-base font-sans overflow-x-hidden">
        {/* Navigation */}
        <nav className="h-16 bg-white border-b border-border-subtle px-6 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight text-brand">Quiz Master</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setView('auth')} className="text-sm font-bold text-text-primary hover:text-brand transition-colors">Log in</button>
            <button onClick={() => setView('auth')} className="quizlet-btn-primary py-2 px-4">Sign up</button>
          </div>
        </nav>

        {/* Hero Section */}
        <header className="max-w-7xl mx-auto px-6 py-20 lg:py-32 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <h1 className="text-6xl lg:text-7xl font-black text-text-primary leading-tight">
              Master any subject with <span className="text-brand">interactive</span> quizzes.
            </h1>
            <p className="text-xl text-text-secondary leading-relaxed max-w-lg">
              Join millions of participants and hosts worldwide. Create, share, and play live quizzes in real-time.
            </p>
            <button 
              onClick={() => setView('auth')}
              className="quizlet-btn-primary text-lg px-10 py-4"
            >
              Get started for free
            </button>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="hidden lg:block relative"
          >
            <div className="w-full aspect-square bg-gradient-to-br from-brand/20 to-brand/5 rounded-3xl flex items-center justify-center border-4 border-white shadow-2xl relative overflow-hidden">
              <InteractiveIcon>
                <motion.div
                  animate={{ 
                    y: [0, -20, 0],
                  }}
                  transition={{ 
                    y: {
                      repeat: Infinity,
                      duration: 2.5,
                      ease: "easeInOut"
                    }
                  }}
                >
                  <Trophy className="w-48 h-48 text-brand" />
                </motion.div>
              </InteractiveIcon>
              {/* Decorative elements */}
              <div className="absolute top-10 left-10 w-20 h-20 bg-brand/10 rounded-2xl rotate-12" />
              <div className="absolute bottom-10 right-10 w-32 h-32 bg-brand/10 rounded-full" />
            </div>
          </motion.div>
        </header>

        {/* Feature Cards Section */}
        <section className="bg-white py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-4xl font-black">Everything you need to succeed</h2>
              <p className="text-text-secondary max-w-2xl mx-auto">Our tools help you study more effectively and achieve your goals with ease.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard 
                icon={<Play className="w-8 h-8" />}
                title="Live Sessions"
                description="Host real-time competitions that keep everyone engaged and motivated."
              />
              <FeatureCard 
                icon={<Clock className="w-8 h-8" />}
                title="Timed Challenges"
                description="Race against the clock to master concepts under pressure."
              />
              <FeatureCard 
                icon={<Users className="w-8 h-8" />}
                title="Join Instantly"
                description="No account needed for players. Just enter a code and start playing."
              />
            </div>
          </div>
        </section>

        {/* Alternating Info Sections */}
        <section className="py-24 space-y-32">
          {/* Info 1: Text Left, Button Right */}
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h3 className="text-3xl font-black">For Participants</h3>
              <p className="text-lg text-text-secondary">Study any topic with fun, competitive games. Join your class and prove your knowledge in real-time battles.</p>
              <div className="md:hidden">
                <button onClick={() => handleStartSession('participant')} className="quizlet-btn-primary w-full">Join as Participant</button>
              </div>
            </div>
            <div className="hidden md:flex justify-end">
              <button onClick={() => handleStartSession('participant')} className="quizlet-btn-outline group flex items-center gap-2">
                Join a Quiz <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Info 2: Button Left, Text Right */}
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
            <div className="hidden md:flex justify-start">
              <button onClick={() => handleStartSession('admin')} className="quizlet-btn-primary flex items-center gap-2 group">
                Create a Quiz <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
              </button>
            </div>
            <div className="space-y-6 md:text-right">
              <h3 className="text-3xl font-black">For Hosts</h3>
              <p className="text-lg text-text-secondary">Create custom quizzes in seconds. Track participant progress with live leaderboards and instant feedback.</p>
              <div className="md:hidden">
                <button onClick={() => handleStartSession('admin')} className="quizlet-btn-outline w-full">Host as Host</button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-text-primary text-white py-12">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
            <span className="text-2xl font-black">Quiz Master</span>
            <div className="flex gap-8 text-sm text-text-muted">
              <a href="#" className="hover:text-white">Help</a>
              <a href="#" className="hover:text-white">Privacy</a>
              <a href="#" className="hover:text-white">Terms</a>
            </div>
            <p className="text-sm text-text-muted">© 2024 Quiz Master Inc.</p>
          </div>
        </footer>
      </div>
    );
  }

  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center p-6 font-sans">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-black mb-2">Welcome back to Quiz Master</h1>
            <p className="text-text-secondary font-medium uppercase tracking-widest text-xs">Choose your path to continue</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div 
              whileHover={{ y: -5 }}
              onClick={() => { setRole('participant'); setView('session'); }}
              className="bg-white p-8 rounded-2xl shadow-quizlet border-b-4 border-brand flex flex-col items-center text-center space-y-6 cursor-pointer"
            >
              <div className="p-4 bg-brand/5 rounded-full">
                <InteractiveIcon>
                  <motion.div 
                    animate={{ 
                      y: [0, -10, 0],
                    }}
                    transition={{ 
                      y: {
                        repeat: Infinity,
                        duration: 2,
                        ease: "easeInOut"
                      }
                    }}
                  >
                    <Trophy className="w-10 h-10 text-brand" />
                  </motion.div>
                </InteractiveIcon>
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Join as Participant</h3>
                <p className="text-text-secondary text-sm">Enter a room code and compete with your class in real-time games.</p>
              </div>
              <button 
                onClick={() => { setRole('participant'); setView('session'); }}
                className="quizlet-btn-primary w-full"
              >
                Join a Quiz
              </button>
            </motion.div>

            <motion.div 
              whileHover={{ y: -5 }}
              onClick={() => { setRole('admin'); setView('session'); }}
              className="bg-white p-8 rounded-2xl shadow-quizlet border-b-4 border-success flex flex-col items-center text-center space-y-6 cursor-pointer"
            >
              <div className="p-4 bg-success/5 rounded-full">
                <InteractiveIcon>
                  <motion.div 
                    animate={{ 
                      y: [0, -10, 0],
                    }}
                    transition={{ 
                      y: {
                        repeat: Infinity,
                        duration: 2,
                        ease: "easeInOut"
                      }
                    }}
                  >
                    <Settings className="w-10 h-10 text-success" />
                  </motion.div>
                </InteractiveIcon>
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Login as Host</h3>
                <p className="text-text-secondary text-sm">Create quiz sets, manage live sessions, and analyze participant results.</p>
              </div>
              <button 
                onClick={() => { setRole('admin'); setView('session'); }}
                className="quizlet-btn-outline w-full border-success text-success hover:bg-success/5"
              >
                Go to Admin
              </button>
            </motion.div>
          </div>
          <div className="mt-12 text-center">
            <button onClick={() => setView('landing')} className="text-sm font-bold text-text-muted hover:text-brand transition-colors">← Back to landing page</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-primary font-sans flex flex-col">
      <header className="h-16 border-b border-border-subtle bg-bg-white px-6 sticky top-0 backdrop-blur-md z-40 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <HomeButton onClick={() => { setRole(null); setView('landing'); }} />
          <span onClick={() => { setRole(null); setView('landing'); }} className="text-xl font-black tracking-tight text-brand cursor-pointer">Quiz Master</span>
          <div className="h-4 w-px bg-border-subtle" />
          <span className="text-[10px] px-2 py-0.5 bg-brand/10 border border-brand/20 text-brand rounded font-bold uppercase tracking-widest">{role}</span>
          {gameState?.status !== "LOBBY" && gameState?.status !== "FINISHED" && (
            <div className="flex items-center gap-2 px-3 py-1 bg-success/10 text-success rounded-full text-[10px] font-bold uppercase tracking-wider transition-all animate-in fade-in slide-in-from-left-4">
              <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
              LIVE: {Object.keys(gameState.participants).length} Participants
            </div>
          )}
        </div>
        <button 
          onClick={() => { 
            if (role === 'admin') {
              if (confirm('Are you sure you want to exit? The session will continue but you will be logged out as admin.')) {
                setRole(null); 
                setView('landing'); 
              }
            } else {
              setRole(null); 
              setView('landing'); 
            }
          }}
          className="quizlet-btn-outline px-4 py-2 border-border-subtle text-text-muted hover:text-text-primary uppercase tracking-widest font-extrabold transition-all text-[10px]"
        >
          Exit Session
        </button>
      </header>

      <main className="flex-1 overflow-auto elegant-scrollbar">
        <div className="max-w-6xl mx-auto p-8 h-full">
          {role === 'admin' ? (
            <AdminPanel 
              gameState={gameState} 
              setView={setView}
              setRole={setRole}
            />
          ) : (
            <ParticipantPanel 
              gameState={gameState} 
              playerName={playerName} 
              setPlayerName={setPlayerName}
              hasJoined={hasJoined}
              setHasJoined={setHasJoined}
              setView={setView}
              setRole={setRole}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="quizlet-card p-8 flex flex-col items-center text-center space-y-4">
      <div className="text-brand mb-2">{icon}</div>
      <h4 className="text-xl font-bold">{title}</h4>
      <p className="text-text-secondary text-sm">{description}</p>
    </div>
  );
}

function RoleButton({ icon, title, description, onClick }: { icon: React.ReactNode, title: string, description: string, onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="quizlet-card p-6 flex items-center gap-5 text-left transition-all"
    >
      <div className="p-3 bg-brand/10 rounded-lg text-brand">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-bold text-text-primary">{title}</h3>
        <p className="text-sm text-text-secondary mt-0.5">{description}</p>
      </div>
    </motion.button>
  );
}

// --- Admin Panel ---

function AdminPanel({ 
  gameState,
  setView,
  setRole
}: { 
  gameState: QuizState | null,
  setView: (v: 'landing' | 'auth' | 'session') => void,
  setRole: (r: 'admin' | 'participant' | null) => void
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('multiple-choice');
  const [newOptions, setNewOptions] = useState(['', '', '', '']);
  const [imageUrl, setImageUrl] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState<any>(0);
  const [timeLimit, setTimeLimit] = useState(15);
  const [customTime, setCustomTime] = useState('');
  const [matchPairs, setMatchPairs] = useState([{ left: '', right: '' }, { left: '', right: '' }]);

  // Draft Logic
  useEffect(() => {
    const saved = localStorage.getItem('quizDraft');
    if (saved) setQuestions(JSON.parse(saved));
  }, []);

  const saveDraft = () => {
    localStorage.setItem('quizDraft', JSON.stringify(questions));
    alert('Draft saved to local storage!');
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const importedQuestions: Question[] = results.data.map((row: any) => {
          const type = (row.Type || 'multiple-choice') as QuestionType;
          let q: Question = {
            id: Math.random().toString(36).substr(2, 9),
            text: row.Question || 'Untitled Question',
            type: type,
            timeLimit: parseInt(row.Time) || 15,
            correctAnswer: null
          };

          if (row.ImageUrl) q.imageUrl = row.ImageUrl;

          if (type === 'multiple-choice' || type === 'multi-select') {
            const opts = [row.A, row.B, row.C, row.D].filter(o => o);
            q.options = opts;
            if (type === 'multi-select') {
              q.correctAnswer = row.Correct.split(',').map((s: string) => parseInt(s.trim()));
            } else {
              q.correctAnswer = parseInt(row.Correct);
            }
          } else if (type === 'true-false') {
            q.options = ['True', 'False'];
            q.correctAnswer = row.Correct.toLowerCase() === 'true' || row.Correct === '0' ? 0 : 1;
          } else if (type === 'fill-blank') {
            q.correctAnswer = row.Correct.split(',').map((s: string) => s.trim());
          }
          return q;
        });
        setQuestions([...questions, ...importedQuestions]);
      }
    });
  };

  const downloadResultsCSV = () => {
    if (!gameState) return;
    const data = Object.values(gameState.participants).map(p => ({
      Name: p.name,
      Score: p.score,
      Status: p.lastAnswerCorrect === null ? 'No Answer' : (p.lastAnswerCorrect ? 'Correct' : 'Incorrect')
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results-${gameState.roomCode}.csv`;
    a.click();
  };

  const getAnalytics = () => {
    if (!gameState || gameState.questions.length === 0) return null;
    const analysis = gameState.questions.map((q, idx) => {
      const answers = Object.values(gameState.participants).filter(p => {
        // This is complex because we don't store historical answer data per question in the current simple backend.
        // For now, we only have data for the *last* question.
        // Ideally we'd expand the backend. Let's assume we can only see current question analytics or expand the state.
        return true; 
      });
      return { text: q.text, idx };
    });
    return analysis;
  };

  const addQuestion = () => {
    if (!newQuestion.trim()) return;
    
    let q: Question = {
      id: Math.random().toString(36).substr(2, 9),
      text: newQuestion,
      type: questionType,
      imageUrl: imageUrl.trim() || undefined,
      timeLimit: customTime ? parseInt(customTime) : timeLimit,
      correctAnswer: null
    };

    if (questionType === 'multiple-choice') {
      q.options = [...newOptions.filter(o => o.trim() !== '')];
      q.correctAnswer = correctAnswer;
    } else if (questionType === 'true-false') {
      q.options = ['True', 'False'];
      q.correctAnswer = correctAnswer;
    } else if (questionType === 'multi-select') {
      q.options = [...newOptions.filter(o => o.trim() !== '')];
      q.correctAnswer = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
    } else if (questionType === 'fill-blank') {
      q.correctAnswer = String(correctAnswer).split(',').map(s => s.trim());
    } else if (questionType === 'match') {
      const validPairs = matchPairs.filter(p => p.left.trim() && p.right.trim());
      q.matchPairs = validPairs;
      // For matching, correctAnswer is a map of left index to right index
      const answerMap: Record<number, number> = {};
      validPairs.forEach((_, i) => answerMap[i] = i); 
      q.correctAnswer = answerMap;
    }

    setQuestions([...questions, q]);
    setNewQuestion('');
    setNewOptions(['', '', '', '']);
    setCorrectAnswer(0);
    setMatchPairs([{ left: '', right: '' }, { left: '', right: '' }]);
    setCustomTime('');
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const startQuiz = () => {
    socket.emit('admin:create_quiz', questions);
  };

  const nextQuestion = () => {
    socket.emit('admin:start_next_question');
  };

  const resetQuiz = () => {
    if (confirm('Are you sure you want to end the session for everyone?')) {
      socket.emit('admin:reset');
      setQuestions([]);
      localStorage.removeItem('quizAdminKey');
      setView('landing');
      setRole(null);
      setHasJoined(false);
    }
  };

  if (!gameState) return <div className="text-center py-12 text-text-muted">Connecting to server...</div>;

  if (gameState.currentQuestionIndex >= 0 || (gameState.status === "LOBBY" && gameState.questions.length > 0)) {
    const currentQ = gameState.questions[gameState.currentQuestionIndex];
    const isFinished = gameState.status === "FINISHED";
    const isLobby = gameState.status === "LOBBY";

    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full">
        <div className="lg:col-span-3 space-y-8">
          <div className="flex justify-between items-center bg-bg-white p-6 rounded-2xl border-2 border-border-subtle shadow-quizlet">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-[10px] text-brand font-bold uppercase tracking-widest mb-1">Session Info</div>
                <h2 className="text-xl font-bold">{isLobby ? 'Lobby Waiting' : (isFinished ? 'Quiz Finished' : 'Quiz in Progress')}</h2>
              </div>

              <div className="h-10 w-px bg-border-subtle hidden md:block" />

              <div className="hidden md:flex gap-4">
                <button 
                  onClick={() => socket.emit('admin:toggle_lock')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 text-[10px] font-bold uppercase tracking-wider transition-all ${gameState.isLocked ? 'bg-error/10 border-error text-error' : 'bg-success/10 border-success text-success'}`}
                >
                  {gameState.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  {gameState.isLocked ? 'Locked' : 'Unlocked'}
                </button>

                <div className="flex bg-bg-base p-1 rounded-lg border-2 border-border-subtle">
                  {['manual', 'auto'].map(m => (
                    <button 
                      key={m}
                      onClick={() => socket.emit('admin:set_pacing', m)}
                      className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all ${gameState.pacing === m ? 'bg-white shadow-sm text-brand' : 'text-text-muted hover:text-text-primary'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {!isFinished && (
              <div className="flex gap-4">
                {isLobby && (
                   <div className="flex flex-col items-end">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Entry Pin</span>
                    <span className="text-2xl font-black text-brand tracking-widest">{gameState.roomCode}</span>
                  </div>
                )}
                {(isLobby || gameState.status === "FEEDBACK") && (
                  <button 
                    onClick={nextQuestion}
                    className="quizlet-btn-primary"
                  >
                    {isLobby ? 'Start Quiz' : 'Next Question'} <ChevronRight className="w-4 h-4 ml-2 inline" />
                  </button>
                )}
              </div>
            )}
          </div>

          {currentQ && (gameState.status === "QUESTION" || gameState.status === "FEEDBACK") && (
            <motion.div 
              key={currentQ.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-bg-white border-2 border-border-subtle p-12 rounded-2xl shadow-quizlet flex flex-col items-center text-center relative"
            >
              {gameState.status === "QUESTION" && (
                <div className="absolute top-8 right-8 flex flex-col items-center">
                   <div className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">Time Remaining</div>
                   <div className={`text-4xl font-black font-mono ${gameState.timeLeft <= 5 ? 'text-error animate-pulse' : 'text-brand'}`}>{gameState.timeLeft}s</div>
                </div>
              )}
              
              <div className="text-xs text-text-muted font-bold uppercase tracking-[0.2em] mb-6">Question {gameState.currentQuestionIndex + 1} of {gameState.questions.length}</div>
              
              {currentQ.imageUrl && (
                <div className="mb-8 max-w-md w-full aspect-video rounded-2xl overflow-hidden border-2 border-border-subtle shadow-sm bg-bg-base flex items-center justify-center">
                   <img src={currentQ.imageUrl} alt="Question" className="w-full h-full object-contain" />
                </div>
              )}

              <h3 className="text-4xl font-bold mb-12 max-w-2xl leading-tight text-text-primary px-6">{currentQ.text}</h3>
              
              <div className="w-full max-w-xl space-y-6">
                {(currentQ.type === 'multiple-choice' || currentQ.type === 'true-false' || currentQ.type === 'multi-select' || !currentQ.type) && currentQ.options && (
                  <div className="space-y-4">
                    {currentQ.options.map((opt, i) => {
                      const responses = Object.values(gameState.participants).filter(r => {
                        if (currentQ.type === 'multi-select') {
                          return Array.isArray(r.lastAnswer) && r.lastAnswer.includes(i);
                        }
                        return r.lastAnswer === i;
                      }).length;
                      const total = Object.keys(gameState.participants).length || 1;
                      const percent = Math.round((responses / total) * 100);
                      const isCorrect = Array.isArray(currentQ.correctAnswer) 
                        ? currentQ.correctAnswer.includes(i) 
                        : i === currentQ.correctAnswer;

                      return (
                        <div key={i} className="flex items-center gap-6 group">
                          <div className={`w-32 text-right text-xs font-black uppercase truncate ${isCorrect ? 'text-success' : 'text-text-secondary'}`}>{opt}</div>
                          <div className="flex-1 h-12 bg-bg-base rounded-xl border-2 border-border-subtle overflow-hidden relative">
                             <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              className={`h-full ${isCorrect ? 'bg-success' : 'bg-brand'} transition-all opacity-80`}
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-[10px] font-black text-text-primary">{responses} participants</span>
                            </div>
                          </div>
                          <div className="w-12 text-sm font-black text-text-secondary">{percent}%</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentQ.type === 'fill-blank' && (
                  <div className="space-y-4">
                    <div className="p-6 bg-success/5 border-2 border-success/20 rounded-2xl">
                      <div className="text-[10px] font-black text-success uppercase tracking-widest mb-1">Correct Answer(s)</div>
                      <div className="text-xl font-bold">{Array.isArray(currentQ.correctAnswer) ? currentQ.correctAnswer.join(', ') : currentQ.correctAnswer}</div>
                    </div>
                    <div className="space-y-2">
                       {Object.values(gameState.participants).map((p, i) => (
                         p.lastAnswer !== null && (
                            <div key={i} className={`flex justify-between p-3 rounded-xl border-2 ${p.lastAnswerCorrect ? 'border-success bg-success/5' : 'border-error bg-error/5'}`}>
                               <span className="text-sm font-bold">{p.name}</span>
                               <span className="text-sm italic">"{p.lastAnswer}"</span>
                            </div>
                         )
                       ))}
                    </div>
                  </div>
                )}

                {currentQ.type === 'match' && (
                   <div className="text-center p-8 bg-bg-base/30 rounded-3xl border-2 border-dashed border-border-subtle text-text-muted">
                      <div className="text-xs font-black uppercase tracking-widest mb-2">Matching Question</div>
                      <div className="text-sm">Correct pairs are being tracked. Check leaderboard for rankings!</div>
                   </div>
                )}
              </div>
            </motion.div>
          )}

          {isLobby && (
            <div className="bg-bg-white border-4 border-dashed border-border-subtle p-24 rounded-3xl flex flex-col items-center justify-center text-center gap-6 shadow-quizlet">
               <div className="w-20 h-20 bg-brand/10 border-2 border-brand/20 rounded-full flex items-center justify-center">
                  <Users className="w-10 h-10 text-brand" />
               </div>
               <div>
                 <h3 className="text-3xl font-black tracking-tight">QUIZ LOBBY</h3>
                 <p className="text-text-secondary mt-1 uppercase tracking-widest text-xs font-bold">Waiting for your participants to join the game</p>
               </div>
            </div>
          )}

          {isFinished && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-12 px-8 bg-bg-white rounded-3xl border-2 border-border-subtle flex flex-col items-center gap-8 shadow-quizlet"
            >
              <div className="flex items-center gap-6 mb-4">
                <Trophy className="w-16 h-16 text-brand" />
                <div className="text-left">
                  <h2 className="text-5xl font-black text-text-primary tracking-tight">GAME OVER</h2>
                  <p className="text-text-secondary text-lg">Detailed results are ready for review.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl text-left">
                <div className="p-6 bg-bg-base border-2 border-border-subtle rounded-2xl">
                   <div className="text-[10px] font-black uppercase text-text-muted tracking-widest mb-2">Performance Analytics</div>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center">
                         <span className="text-xs font-bold">Total Players</span>
                         <span className="text-lg font-black text-brand">{Object.keys(gameState.participants).length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-xs font-bold">Avg. Score</span>
                         <span className="text-lg font-black text-brand">
                            {Object.values(gameState.participants).length > 0
                              ? Math.round(Object.values(gameState.participants).reduce((acc, p) => acc + p.score, 0) / Object.values(gameState.participants).length).toLocaleString()
                              : 0}
                         </span>
                      </div>
                   </div>
                </div>
                
                <div className="p-6 bg-bg-base border-2 border-border-subtle rounded-2xl flex flex-col justify-between">
                   <div className="text-[10px] font-black uppercase text-text-muted tracking-widest mb-2">Reports</div>
                   <button 
                     onClick={downloadResultsCSV}
                     className="w-full bg-white border-2 border-border-subtle p-3 rounded-xl flex items-center justify-between hover:border-brand transition-all group mb-2"
                   >
                     <span className="text-xs font-bold text-text-primary">Download CSV Results</span>
                     <Download className="w-4 h-4 text-text-muted group-hover:text-brand" />
                   </button>
                   <p className="text-[10px] text-text-muted italic">Participant scores and accuracy exports.</p>
                </div>
              </div>

              {gameState.questionStats && gameState.questionStats.length > 0 && (
                <div className="w-full max-w-2xl text-left border-2 border-border-subtle rounded-2xl p-6 bg-bg-base/30">
                  <div className="text-[10px] font-black uppercase text-text-muted tracking-widest mb-4">Question Difficulty Matrix</div>
                  <div className="space-y-3">
                    {gameState.questions.map((q, i) => {
                      const stats = gameState.questionStats?.[i];
                      const total = (stats?.correct || 0) + (stats?.incorrect || 0);
                      const accuracy = total > 0 ? Math.round((stats?.correct || 0) / total * 100) : 0;
                      return (
                        <div key={i} className="flex items-center gap-4 group">
                          <div className="text-xs font-mono font-bold text-text-muted">Q{i + 1}</div>
                          <div className="flex-1 text-xs font-bold truncate text-text-primary">{q.text}</div>
                          <div className="flex items-center gap-2">
                             <div className="w-24 h-2 bg-white rounded-full overflow-hidden border">
                                <div className={`h-full ${accuracy < 50 ? 'bg-error' : (accuracy < 80 ? 'bg-brand' : 'bg-success')}`} style={{ width: `${accuracy}%` }} />
                             </div>
                             <span className="text-[10px] font-black w-8">{accuracy}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button 
                  onClick={resetQuiz}
                  className="quizlet-btn-primary px-10 py-4 text-lg"
                >
                  <RotateCcw className="w-5 h-5 mr-3 inline" /> Start New Game
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar Results */}
        <aside className="lg:col-span-1 bg-bg-white border-2 border-border-subtle rounded-2xl p-6 flex flex-col gap-6 shadow-quizlet">
          <div className="space-y-1">
            <h3 className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em]">Rankings</h3>
            <p className="text-xs text-text-secondary">Top performing participants</p>
          </div>
          
              <div className="flex-1 overflow-auto elegant-scrollbar space-y-2">
                {Object.entries(gameState.participants)
                  .map(([id, res]) => {
                    return { id, name: res.name, score: res.score, hasAnswered: res.lastAnswer !== null };
                  })
                  .sort((a, b) => b.score - a.score)
                  .map((p, i) => (
                    <div key={p.id} className="flex justify-between items-center py-3 border-b border-border-subtle last:border-0 group">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-black w-4 ${i < 3 ? 'text-brand' : 'text-text-muted'}`}>{i + 1}</span>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold group-hover:text-brand transition-colors text-text-primary">{p.name}</span>
                          {gameState.status === "QUESTION" && (
                             <span className={`text-[8px] font-bold uppercase tracking-widest ${p.hasAnswered ? 'text-success' : 'text-text-muted'}`}>
                               {p.hasAnswered ? 'Answered' : 'Thinking...'}
                             </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs font-bold text-brand">{p.score.toLocaleString()}</span>
                        {isLobby && (
                          <button 
                            onClick={() => socket.emit('admin:kick_participant', p.id)}
                            className="p-1 hover:bg-error/10 text-text-muted hover:text-error rounded transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>

          <div className="pt-4 border-t border-border-subtle">
            <button 
              onClick={resetQuiz}
              className="w-full quizlet-btn-outline border-border-subtle text-text-secondary hover:text-text-primary hover:border-brand py-2"
            >
              End Session
            </button>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-bg-white border-2 border-border-subtle p-6 rounded-2xl space-y-6 shadow-quizlet">
          <div className="flex items-center justify-between text-brand">
            <div className="flex items-center gap-3">
              <Plus className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest font-bold">New Question</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={saveDraft}
                title="Save Draft"
                className="p-1.5 bg-bg-base border border-border-subtle rounded hover:border-brand transition-all"
              >
                <Save className="w-4 h-4 text-text-muted" />
              </button>
              <label className="p-1.5 bg-bg-base border border-border-subtle rounded hover:border-brand transition-all cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-text-muted" />
                <input type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
              </label>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Question Type</label>
              <select 
                value={questionType}
                onChange={(e) => {
                  const type = e.target.value as QuestionType;
                  setQuestionType(type);
                  if (type === 'true-false') {
                    setCorrectAnswer(0);
                  } else if (type === 'fill-blank') {
                    setCorrectAnswer('');
                  } else if (type === 'multi-select') {
                    setCorrectAnswer([]);
                  } else if (type === 'multiple-choice') {
                    setCorrectAnswer(0);
                  }
                }}
                className="w-full bg-bg-base border-2 border-border-subtle p-2 rounded-xl text-xs font-bold focus:outline-none focus:border-brand"
              >
                <option value="multiple-choice">Multiple Choice</option>
                <option value="multi-select">Multi-Select</option>
                <option value="true-false">True / False</option>
                <option value="fill-blank">Fill in the Blanks</option>
                <option value="match">Match the Following</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Time Limit</label>
              <div className="flex gap-1.5">
                {[10, 15, 30].map(t => (
                  <button 
                    key={t}
                    onClick={() => { setTimeLimit(t); setCustomTime(''); }}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded border-2 transition-all ${timeLimit === t && !customTime ? 'bg-brand border-brand text-white' : 'border-border-subtle text-text-secondary hover:border-brand'}`}
                  >
                    {t}s
                  </button>
                ))}
              </div>
              <input 
                type="number"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                placeholder="Custom seconds..."
                className="w-full mt-2 quizlet-input py-2 text-[10px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Question Text</label>
              <textarea 
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder={questionType === 'match' ? "Instructions for matching..." : "What determines the state of...?"}
                rows={3}
                className="quizlet-input py-2 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                <ImageIcon className="w-3 h-3" /> Image URL (Optional)
              </label>
              <input 
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="quizlet-input py-2 text-xs"
              />
            </div>

            {questionType === 'multiple-choice' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Options</label>
                  <button 
                    onClick={() => setNewOptions([...newOptions, ''])}
                    className="text-[10px] font-black text-brand uppercase"
                  >
                    + Add Option
                  </button>
                </div>
                {newOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <button 
                      onClick={() => setCorrectAnswer(i)}
                      className={`w-10 h-10 shrink-0 rounded border-2 text-[10px] font-bold transition-all ${correctAnswer === i ? 'bg-success border-success text-white' : 'border-border-subtle text-text-muted hover:border-brand'}`}
                    >
                      {String.fromCharCode(65 + i)}
                    </button>
                    <input 
                      type="text" 
                      value={opt}
                      onChange={(e) => {
                        const next = [...newOptions];
                        next[i] = e.target.value;
                        setNewOptions(next);
                      }}
                      placeholder={`Option ${i + 1}`}
                      className="quizlet-input py-1.5"
                    />
                    {newOptions.length > 2 && (
                      <button 
                        onClick={() => setNewOptions(newOptions.filter((_, idx) => idx !== i))}
                        className="text-text-muted hover:text-error"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {questionType === 'multi-select' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Options (Select all that apply)</label>
                  <button 
                    onClick={() => setNewOptions([...newOptions, ''])}
                    className="text-[10px] font-black text-brand uppercase"
                  >
                    + Add Option
                  </button>
                </div>
                {newOptions.map((opt, i) => {
                  const isSelected = Array.isArray(correctAnswer) && correctAnswer.includes(i);
                  return (
                    <div key={i} className="flex gap-2">
                      <button 
                        onClick={() => {
                          const current = Array.isArray(correctAnswer) ? correctAnswer : [];
                          if (current.includes(i)) {
                            setCorrectAnswer(current.filter(idx => idx !== i));
                          } else {
                            setCorrectAnswer([...current, i]);
                          }
                        }}
                        className={`w-10 h-10 shrink-0 rounded border-2 text-[10px] font-bold transition-all ${isSelected ? 'bg-success border-success text-white' : 'border-border-subtle text-text-muted hover:border-brand'}`}
                      >
                        {String.fromCharCode(65 + i)}
                      </button>
                      <input 
                        type="text" 
                        value={opt}
                        onChange={(e) => {
                          const next = [...newOptions];
                          next[i] = e.target.value;
                          setNewOptions(next);
                        }}
                        placeholder={`Option ${i + 1}`}
                        className="quizlet-input py-1.5"
                      />
                      {newOptions.length > 2 && (
                        <button 
                          onClick={() => setNewOptions(newOptions.filter((_, idx) => idx !== i))}
                          className="text-text-muted hover:text-error"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {questionType === 'true-false' && (
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Correct Answer</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCorrectAnswer(0)}
                    className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${correctAnswer === 0 ? 'bg-success border-success text-white' : 'border-border-subtle hover:border-brand'}`}
                  >
                    True
                  </button>
                  <button 
                    onClick={() => setCorrectAnswer(1)}
                    className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${correctAnswer === 1 ? 'bg-error border-error text-white' : 'border-border-subtle hover:border-brand'}`}
                  >
                    False
                  </button>
                </div>
              </div>
            )}

            {questionType === 'fill-blank' && (
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Correct Answer(s)</label>
                <input 
                  type="text"
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  placeholder="Separate alternatives with commas"
                  className="quizlet-input py-3"
                />
                <p className="text-[9px] text-text-secondary italic">Case-insensitive. Matching any comma-separated value counts as correct.</p>
              </div>
            )}

            {questionType === 'match' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Matching pairs</label>
                  <button 
                    onClick={() => setMatchPairs([...matchPairs, { left: '', right: '' }])}
                    className="text-[10px] font-black text-brand uppercase"
                  >
                    + Add Pair
                  </button>
                </div>
                {matchPairs.map((pair, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input 
                      type="text"
                      value={pair.left}
                      onChange={(e) => {
                        const next = [...matchPairs];
                        next[i].left = e.target.value;
                        setMatchPairs(next);
                      }}
                      placeholder="Left side"
                      className="quizlet-input py-1.5 flex-1"
                    />
                    <div className="text-text-muted">→</div>
                    <input 
                      type="text"
                      value={pair.right}
                      onChange={(e) => {
                        const next = [...matchPairs];
                        next[i].right = e.target.value;
                        setMatchPairs(next);
                      }}
                      placeholder="Right side"
                      className="quizlet-input py-1.5 flex-1"
                    />
                    {matchPairs.length > 2 && (
                      <button 
                        onClick={() => setMatchPairs(matchPairs.filter((_, idx) => idx !== i))}
                        className="text-text-muted hover:text-error"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button 
              onClick={addQuestion}
              className="w-full quizlet-btn-primary py-3 text-xs"
            >
              Add Question
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-3 flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-text-primary">Questions Queue</h3>
            <p className="text-xs text-text-secondary uppercase tracking-widest font-bold">{questions.length} questions ready</p>
          </div>
          {questions.length > 0 && (
            <button 
              onClick={startQuiz}
              className="quizlet-btn-primary px-10 py-3"
            >
              Launch Live Quiz <Play className="w-4 h-4 ml-2 inline fill-current" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto elegant-scrollbar pr-2 space-y-4">
          <AnimatePresence mode="popLayout">
            {questions.map((q, idx) => (
              <motion.div 
                key={q.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="quizlet-card p-6 flex justify-between items-center group"
              >
                <div className="flex gap-6 items-center">
                  <div className="text-lg font-black text-brand w-8 tracking-tighter">0{idx + 1}</div>
                  <div>
                    <h4 className="font-bold text-text-primary group-hover:text-brand transition-colors">{q.text}</h4>
                    <div className="flex flex-wrap gap-4 mt-2">
                      {(q.type === 'multiple-choice' || q.type === 'true-false' || q.type === 'multi-select' || !q.type) && q.options?.map((opt, i) => {
                        const isCorrect = Array.isArray(q.correctAnswer) 
                          ? q.correctAnswer.includes(i) 
                          : i === q.correctAnswer;
                        return (
                          <span key={i} className={`text-[11px] font-bold tracking-tight px-2 py-0.5 rounded ${isCorrect ? 'bg-success/10 text-success border border-success/30' : 'bg-bg-base text-text-muted border border-border-subtle'}`}>
                            {opt}
                          </span>
                        );
                      })}
                      {q.type === 'fill-blank' && (
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black text-text-muted uppercase tracking-widest bg-bg-base px-2 py-0.5 rounded">Fill Blank:</span>
                           <span className="text-[11px] font-bold text-success capitalize">{Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}</span>
                        </div>
                      )}
                      {q.type === 'match' && q.matchPairs && (
                        <div className="flex flex-wrap gap-2">
                          <span className="text-[10px] font-black text-text-muted uppercase tracking-widest bg-bg-base px-2 py-0.5 rounded">Matching:</span>
                          {q.matchPairs.map((pair, i) => (
                            <span key={i} className="text-[10px] font-bold bg-brand/5 text-brand px-2 py-0.5 rounded border border-brand/20">
                              {pair.left} → {pair.right}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex-1" />
                      <div className="text-[10px] font-black text-text-muted bg-bg-base px-2 py-0.5 rounded border border-border-subtle uppercase">
                        {q.timeLimit}s {q.type || 'multiple-choice'}
                      </div>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => removeQuestion(q.id)}
                  className="text-text-muted hover:text-error p-2 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {questions.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center border-4 border-dashed border-border-subtle rounded-3xl text-text-muted py-24 gap-6 bg-white shadow-quizlet">
              <div className="p-6 bg-bg-base rounded-full">
                <Settings className="w-12 h-12 text-text-muted/50" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-text-primary">Your session is empty</p>
                <p className="text-sm">Start adding questions on the left side to get started.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Participant Panel ---

function ParticipantPanel({ 
  gameState, 
  playerName, 
  setPlayerName,
  hasJoined,
  setHasJoined,
  setView,
  setRole
}: { 
  gameState: QuizState | null,
  playerName: string,
  setPlayerName: (name: string) => void,
  hasJoined: boolean,
  setHasJoined: (val: boolean) => void,
  setView: (v: 'landing' | 'auth' | 'session') => void,
  setRole: (r: 'admin' | 'participant' | null) => void
}) {
  const [joinPin, setJoinPin] = useState('');
  const [joinError, setJoinError] = useState('');

  const [fillAnswer, setFillAnswer] = useState('');
  const [matchSelections, setMatchSelections] = useState<Record<number, number>>({});
  const [activeLeftIdx, setActiveLeftIdx] = useState<number | null>(null);
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<number[]>([]);

  useEffect(() => {
    socket.on('join_error', (msg: string) => {
      setJoinError(msg);
    });
    socket.on('join_success', () => {
       setHasJoined(true);
       setJoinError('');
    });
    // Reset local answer state when question changes
    if (gameState?.status === "QUESTION") {
      setFillAnswer('');
      setMatchSelections({});
      setActiveLeftIdx(null);
      setSelectedMultiOptions([]);
    }
    return () => {
      socket.off('join_error');
      socket.off('join_success');
    };
  }, [setHasJoined, gameState?.currentQuestionIndex, gameState?.status]);

  const joinQuiz = () => {
    if (!playerName.trim() || !joinPin.trim()) return;
    console.log(`Client: Emitting join with name: ${playerName}, pin: ${joinPin}`);
    socket.emit('participant:join', { name: playerName, code: joinPin });
  };

  const submitAnswer = (answer: any) => {
    socket.emit('participant:answer', answer);
  };

  const handleMatchSelect = (type: 'left' | 'right', index: number) => {
    if (myAnswer !== null) return;
    if (type === 'left') {
      setActiveLeftIdx(index);
    } else if (type === 'right' && activeLeftIdx !== null) {
      const next = { ...matchSelections, [activeLeftIdx]: index };
      setMatchSelections(next);
      setActiveLeftIdx(null);
      
      // If all paired, auto-submit
      const currentQ = gameState?.questions[gameState.currentQuestionIndex];
      if (currentQ?.matchPairs && Object.keys(next).length === currentQ.matchPairs.length) {
        submitAnswer(next);
      }
    }
  };

  const toggleMultiSelectOption = (index: number) => {
    if (myAnswer !== null) return;
    const next = selectedMultiOptions.includes(index)
      ? selectedMultiOptions.filter(i => i !== index)
      : [...selectedMultiOptions, index];
    setSelectedMultiOptions(next);
  };

  if (!gameState) return <div className="text-center py-12 text-text-muted">Connecting to server...</div>;

  if (!hasJoined) {
    return (
      <div className="max-w-md mx-auto py-12 space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-black text-text-primary uppercase tracking-tight">Enter Game</h2>
          <p className="text-text-secondary uppercase tracking-[0.2em] text-xs font-bold">Join your class's live session</p>
        </div>
        <div className="space-y-6 bg-white border-2 border-border-subtle p-10 rounded-3xl shadow-quizlet">
          <div className="space-y-6">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Room PIN</label>
                <input 
                  type="text" 
                  value={joinPin}
                  onChange={(e) => setJoinPin(e.target.value.toUpperCase())}
                  placeholder="000000"
                  className="w-full bg-bg-base border-2 border-border-subtle p-5 rounded-2xl text-3xl font-black tracking-[0.5em] text-center focus:outline-none focus:border-brand transition-colors text-brand"
                />
             </div>
             
            <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Participant Name</label>
                <div className="relative">
                  <Smile className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input 
                    type="text" 
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter your name"
                    className="quizlet-input p-5 pl-14 text-base"
                    onKeyDown={(e) => e.key === 'Enter' && joinQuiz()}
                  />
                </div>
             </div>
          </div>

          {joinError && (
             <div className="p-4 bg-error/10 border-2 border-error/20 text-error text-[11px] font-black text-center uppercase tracking-widest rounded-xl animate-shake">
                {joinError}
             </div>
          )}

          <button 
            onClick={joinQuiz}
            className="w-full quizlet-btn-primary py-5 text-base"
          >
            Join Quiz <ArrowRight className="w-5 h-5 ml-2 inline" />
          </button>
        </div>
      </div>
    );
  }

  // Lobby State
  if (gameState.status === "LOBBY") {
    return (
      <div className="text-center py-32 space-y-10 flex flex-col items-center">
        <div className="w-28 h-28 bg-white rounded-3xl flex items-center justify-center border-2 border-border-subtle shadow-quizlet animate-pulse">
          <Clock className="w-12 h-12 text-brand" />
        </div>
        <div>
          <h2 className="text-4xl font-black text-text-primary">Hey, {playerName}!</h2>
          <p className="text-text-secondary uppercase tracking-[0.25em] text-xs font-black mt-2">The Host will start the quiz soon</p>
        </div>
        
        <div className="flex items-center gap-4 mt-8 px-8 py-4 bg-bg-base rounded-full border-2 border-border-subtle">
           <div className="flex -space-x-3">
             {Object.values(gameState.participants).slice(0, 5).map((p, i) => (
                <div key={i} className="w-10 h-10 rounded-full bg-brand border-2 border-white flex items-center justify-center text-white text-xs font-black">
                  {p.name[0].toUpperCase()}
                </div>
             ))}
           </div>
           <span className="text-sm font-bold text-text-secondary">
             {Object.keys(gameState.participants).length} participants connected
           </span>
        </div>
      </div>
    );
  }

  // Result / Finished State
  if (gameState.status === "FINISHED") {
    const scores = Object.values(gameState.participants).map(res => {
      return { name: res.name, score: res.score };
    }).sort((a, b) => b.score - a.score);

    const myData = gameState.participants[socket.id];
    const myScore = myData?.score || 0;

    return (
      <div className="max-w-3xl mx-auto space-y-12 py-12">
        <div className="text-center space-y-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 10 }}
          >
            <Trophy className="w-24 h-24 text-brand mx-auto shadow-quizlet" />
          </motion.div>
          <div>
            <h2 className="text-6xl font-black text-text-primary tracking-tight uppercase">Great Job!</h2>
            <div className="text-8xl font-black text-brand tracking-tighter mt-4">{myScore.toLocaleString()}</div>
            <p className="text-text-secondary uppercase tracking-[0.3em] font-black mt-4 text-xs">Total Study Points</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border-2 border-border-subtle overflow-hidden shadow-quizlet">
          <div className="p-8 border-b-2 border-border-subtle flex justify-between items-center bg-bg-base/30">
            <h3 className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">Live Leaderboard</h3>
            <Users className="w-5 h-5 text-text-muted" />
          </div>
          <div className="divide-y-2 divide-border-subtle">
            {scores.map((s, i) => (
              <div key={i} className={`flex items-center justify-between p-8 transition-colors ${s.name === playerName ? 'bg-brand/5 border-l-8 border-brand' : 'hover:bg-bg-base/30'}`}>
                <div className="flex items-center gap-6">
                  <span className={`text-2xl font-black w-8 ${i < 3 ? 'text-brand' : 'text-text-muted'}`}>{i + 1}</span>
                  <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center font-black text-brand text-xl border-2 border-brand/20">
                    {s.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-black text-xl text-text-primary">{s.name} {s.name === playerName && <span className="text-brand text-xs ml-2 uppercase italic">(You)</span>}</div>
                    <div className="text-[11px] text-text-secondary uppercase tracking-widest font-bold">Accuracy Rank: #{i + 1}</div>
                  </div>
                </div>
                <div className="text-4xl font-black text-text-primary">{s.score.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Active question
  const currentQ = gameState.questions[gameState.currentQuestionIndex];
  const myData = gameState.participants[socket.id];
  const myAnswer = myData?.lastAnswer;
  const isFeedback = gameState.status === "FEEDBACK";

  return (
    <div className="max-w-3xl mx-auto space-y-12 py-12 h-full flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <div className="px-5 py-2.5 bg-bg-base rounded-xl border-2 border-border-subtle text-text-secondary text-[11px] font-black tracking-[0.2em] uppercase">
          Question {gameState.currentQuestionIndex + 1} / {gameState.questions.length}
        </div>
        
        {gameState.status === "QUESTION" && (
           <div className={`px-6 py-2.5 rounded-xl font-mono font-black text-2xl border-2 shadow-quizlet ${gameState.timeLeft <= 5 ? 'bg-error/10 border-error text-error animate-pulse' : 'bg-brand/5 border-brand text-brand'}`}>
              00:{gameState.timeLeft.toString().padStart(2, '0')}
           </div>
        )}

        {isFeedback && (
           <div className="text-xs font-black text-text-muted uppercase tracking-widest px-5 py-2.5 border-2 border-border-subtle rounded-xl bg-bg-base">
              TIME'S UP
           </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isFeedback ? (
           <motion.div 
            key="feedback"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className={`flex-1 flex flex-col items-center justify-center p-12 rounded-[40px] border-4 ${myData?.lastAnswerCorrect ? 'bg-success/5 border-success shadow-quizlet' : 'bg-error/5 border-error shadow-quizlet'}`}
           >
              {myData?.lastAnswerCorrect ? (
                <>
                  <CheckCircle2 className="w-40 h-40 text-success mb-8" />
                  <h2 className="text-7xl font-black text-success uppercase tracking-tight">CORRECT</h2>
                  <p className="text-text-secondary mt-4 font-black tracking-widest text-lg">FAST ANSWER BONUS ADDED!</p>
                </>
              ) : (
                <>
                  <div className="w-40 h-40 rounded-full border-8 border-error flex items-center justify-center mb-8">
                    <span className="text-8xl font-black text-error">✕</span>
                  </div>
                  <h2 className="text-7xl font-black text-error uppercase tracking-tight">INCORRECT</h2>
                  <p className="text-text-secondary mt-4 font-black tracking-widest text-lg">KEEP FOCUSING!</p>
                </>
              )}
           </motion.div>
        ) : (
          currentQ && (
            <motion.div 
              key={currentQ.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="flex-1 flex flex-col justify-center gap-10"
            >
              <h2 className="text-5xl font-black leading-tight text-center tracking-tight text-text-primary px-8">{currentQ.text}</h2>
              
              {currentQ.imageUrl && (
                <div className="w-full max-w-lg mx-auto aspect-video rounded-3xl overflow-hidden border-4 border-white shadow-quizlet bg-bg-base mb-4">
                  <img src={currentQ.imageUrl} alt="Question" className="w-full h-full object-contain" />
                </div>
              )}

              <div className="w-full max-w-2xl mx-auto">
                {(currentQ.type === 'multiple-choice' || !currentQ.type) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {currentQ.options?.map((opt, i) => {
                      const isSelected = myAnswer === i;
                      return (
                        <button 
                          key={i}
                          disabled={myAnswer !== null}
                          onClick={() => submitAnswer(i)}
                          className={`
                            p-8 rounded-3xl border-4 text-left transition-all relative overflow-hidden group
                            ${myAnswer === null ? 'border-border-subtle bg-white hover:border-brand hover:scale-[1.02]' : (isSelected ? 'border-brand bg-brand/5 shadow-quizlet scale-[1.02]' : 'border-border-subtle/50 opacity-40')}
                          `}
                        >
                          <div className="relative z-10 flex items-center gap-6">
                            <div className={`
                              w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl border-2 transition-all
                              ${isSelected ? 'bg-brand border-brand text-white' : 'border-border-subtle text-text-muted group-hover:border-brand group-hover:text-brand'}
                            `}>
                              {String.fromCharCode(65 + i)}
                            </div>
                            <span className="text-xl font-black text-text-primary">{opt}</span>
                          </div>
                          {isSelected && <CheckCircle2 className="absolute right-8 top-1/2 -translate-y-1/2 w-8 h-8 text-brand" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQ.type === 'multi-select' && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {currentQ.options?.map((opt, i) => {
                        const isSelected = myAnswer !== null 
                          ? Array.isArray(myAnswer) && myAnswer.includes(i)
                          : selectedMultiOptions.includes(i);
                        return (
                          <button 
                            key={i}
                            disabled={myAnswer !== null}
                            onClick={() => toggleMultiSelectOption(i)}
                            className={`
                              p-8 rounded-3xl border-4 text-left transition-all relative overflow-hidden group
                              ${myAnswer === null ? (isSelected ? 'border-brand bg-brand/5 scale-[1.02]' : 'border-border-subtle bg-white hover:border-brand/60') : (isSelected ? 'border-brand bg-brand/5 opacity-100' : 'border-border-subtle/50 opacity-40')}
                            `}
                          >
                            <div className="relative z-10 flex items-center gap-6">
                              <div className={`
                                w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl border-2 transition-all
                                ${isSelected ? 'bg-brand border-brand text-white' : 'border-border-subtle text-text-muted group-hover:border-brand group-hover:text-brand'}
                              `}>
                                {String.fromCharCode(65 + i)}
                              </div>
                              <span className="text-xl font-black text-text-primary">{opt}</span>
                            </div>
                            {isSelected && <CheckCircle2 className="absolute right-8 top-1/2 -translate-y-1/2 w-8 h-8 text-brand" />}
                          </button>
                        );
                      })}
                    </div>
                    {myAnswer === null && (
                      <div className="flex justify-center">
                        <button 
                          onClick={() => submitAnswer(selectedMultiOptions)}
                          disabled={selectedMultiOptions.length === 0}
                          className="quizlet-btn-primary px-12 py-5 text-xl flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Submit Selected <ChevronRight className="w-6 h-6" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {currentQ.type === 'true-false' && (
                  <div className="flex gap-8">
                    {['True', 'False'].map((opt, i) => {
                      const isSelected = myAnswer === i;
                      return (
                        <button 
                          key={i}
                          disabled={myAnswer !== null}
                          onClick={() => submitAnswer(i)}
                          className={`
                            flex-1 p-12 rounded-3xl border-4 text-center transition-all relative
                            ${myAnswer === null ? 'border-border-subtle bg-white hover:border-brand' : (isSelected ? (i === 0 ? 'border-success bg-success/5 shadow-quizlet' : 'border-error bg-error/5 shadow-quizlet') : 'opacity-40')}
                          `}
                        >
                          <span className={`text-4xl font-black ${i === 0 ? 'text-success' : 'text-error'}`}>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQ.type === 'fill-blank' && (
                  <div className="space-y-6 flex flex-col items-center">
                    <input 
                      type="text"
                      disabled={myAnswer !== null}
                      value={fillAnswer}
                      onChange={(e) => setFillAnswer(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submitAnswer(fillAnswer)}
                      placeholder="Type your answer here..."
                      className="w-full max-w-md bg-white border-4 border-border-subtle p-6 rounded-3xl text-3xl font-black text-center focus:outline-none focus:border-brand transition-all shadow-quizlet"
                    />
                    {myAnswer === null && (
                      <button 
                        onClick={() => submitAnswer(fillAnswer)}
                        className="quizlet-btn-primary px-12 py-4 text-lg"
                      >
                        Submit Answer
                      </button>
                    )}
                  </div>
                )}

                {currentQ.type === 'match' && currentQ.matchPairs && (
                  <div className="grid grid-cols-2 gap-12">
                    <div className="space-y-4">
                      {currentQ.matchPairs.map((pair, i) => {
                        const isPaired = matchSelections[i] !== undefined;
                        const isActive = activeLeftIdx === i;
                        return (
                          <button
                            key={i}
                            disabled={myAnswer !== null || isPaired}
                            onClick={() => handleMatchSelect('left', i)}
                            className={`
                              w-full p-4 rounded-xl border-2 font-bold text-left transition-all
                              ${isPaired ? 'bg-success/10 border-success text-success opacity-50' : (isActive ? 'bg-brand/10 border-brand text-brand scale-105' : 'bg-white border-border-subtle hover:border-brand')}
                            `}
                          >
                            {pair.left}
                          </button>
                        );
                      })}
                    </div>
                    <div className="space-y-4">
                      {/* Shuffle right side for display if needed, but for now simple list */}
                      {currentQ.matchPairs.map((pair, i) => {
                        const isPairedToSomething = Object.values(matchSelections).includes(i);
                        return (
                          <button
                            key={i}
                            disabled={myAnswer !== null || isPairedToSomething || activeLeftIdx === null}
                            onClick={() => handleMatchSelect('right', i)}
                            className={`
                              w-full p-4 rounded-xl border-2 font-bold text-left transition-all
                              ${isPairedToSomething ? 'bg-success/10 border-success text-success opacity-50' : (activeLeftIdx !== null ? 'bg-white border-border-subtle hover:border-brand' : 'bg-bg-base border-transparent text-text-muted cursor-not-allowed')}
                            `}
                          >
                            {pair.right}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {myAnswer !== null && gameState.status === "QUESTION" && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-8 bg-bg-base/50 rounded-2xl border-2 border-border-subtle"
        >
          <p className="text-text-secondary text-sm uppercase tracking-[0.3em] font-black italic">Answer Locked. Stay focused!</p>
        </motion.div>
      )}
    </div>
  );
}
