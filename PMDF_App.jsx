import { useState, useEffect, useCallback, useRef } from "react";

// ─── Storage helpers ──────────────────────────────────────────────────────────
const STORAGE_KEY = "pmdf_platform_v3";
const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const save = (data) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
};

// ─── Constants ────────────────────────────────────────────────────────────────
const DISCIPLINES = [
  { id: "port", name: "Língua Portuguesa",          icon: "📝", q: 8,  priority: "alta",  hours: 80,  block: "Básico" },
  { id: "ing",  name: "Língua Inglesa",              icon: "🌐", q: 5,  priority: "media", hours: 30,  block: "Básico" },
  { id: "mat",  name: "Matemática / Raciocínio Lógico", icon: "🔢", q: 10, priority: "alta", hours: 70, block: "Básico" },
  { id: "info", name: "Informática",                 icon: "💻", q: 7,  priority: "media", hours: 40,  block: "Básico" },
  { id: "atu",  name: "Atualidades",                 icon: "📰", q: 5,  priority: "media", hours: 20,  block: "Básico" },
  { id: "legpmdf", name: "Legislação PMDF / LODF",  icon: "🏛️", q: 5,  priority: "alta",  hours: 50,  block: "Básico" },
  { id: "const", name: "Dir. Constitucional + DH",  icon: "⚖️", q: 8,  priority: "alta",  hours: 90,  block: "Específico" },
  { id: "adm",  name: "Direito Administrativo",      icon: "📋", q: 5,  priority: "media", hours: 40,  block: "Específico" },
  { id: "pen",  name: "Direito Penal",               icon: "🔒", q: 6,  priority: "alta",  hours: 70,  block: "Específico" },
  { id: "legesp", name: "Legislação Penal Especial", icon: "📜", q: 4,  priority: "media", hours: 35,  block: "Específico" },
  { id: "proc", name: "Dir. Processual Penal",       icon: "🔍", q: 5,  priority: "alta",  hours: 60,  block: "Específico" },
  { id: "penm", name: "Dir. Penal Militar",          icon: "🎖️", q: 5,  priority: "media", hours: 50,  block: "Específico" },
  { id: "procm", name: "Dir. Processual Penal Militar", icon: "⚔️", q: 4, priority: "media", hours: 35, block: "Específico" },
  { id: "crim", name: "Criminologia",                icon: "🔬", q: 3,  priority: "baixa", hours: 20,  block: "Específico" },
];

const TOTAL_QUESTIONS = 80;
const PASS_PERCENT = 60;
const XP_LEVELS = [
  { level: 1, name: "Plantinha 🌱",   min: 0,     max: 499,    color: "#22c55e" },
  { level: 2, name: "Estudante 📚",   min: 500,   max: 1499,   color: "#3b82f6" },
  { level: 3, name: "Dedicado ⚡",    min: 1500,  max: 2999,   color: "#8b5cf6" },
  { level: 4, name: "Avançado 🏅",    min: 3000,  max: 5999,   color: "#f59e0b" },
  { level: 5, name: "Elite 🎯",       min: 6000,  max: 9999,   color: "#ef4444" },
  { level: 6, name: "Campeão 🏆",     min: 10000, max: Infinity, color: "#1a3a5c" },
];

const BADGES = [
  { id: "first_study", name: "Primeiro Passo", icon: "👣", desc: "Complete seu primeiro registro de estudo", check: (s) => s.sessions.length >= 1 },
  { id: "streak_7",    name: "Uma Semana",     icon: "🔥", desc: "7 dias seguidos de estudo",              check: (s) => s.streak >= 7 },
  { id: "streak_30",   name: "Mês de Ferro",   icon: "💪", desc: "30 dias seguidos de estudo",             check: (s) => s.streak >= 30 },
  { id: "q_100",       name: "Centena",        icon: "💯", desc: "100 questões resolvidas",                check: (s) => s.totalQuestions >= 100 },
  { id: "q_500",       name: "Quinhentas",     icon: "⚡", desc: "500 questões resolvidas",                check: (s) => s.totalQuestions >= 500 },
  { id: "sim_first",   name: "Primeiro Simulado", icon: "📝", desc: "Complete um simulado",               check: (s) => s.simulados.length >= 1 },
  { id: "sim_70",      name: "70% Meta",       icon: "🎯", desc: "Simulado com ≥ 70%",                     check: (s) => s.simulados.some(x => x.percent >= 70) },
  { id: "sim_80",      name: "Elite",          icon: "🏅", desc: "Simulado com ≥ 80%",                     check: (s) => s.simulados.some(x => x.percent >= 80) },
  { id: "hours_50",    name: "50 Horas",       icon: "⏱️", desc: "50 horas de estudo acumuladas",          check: (s) => s.totalHours >= 50 },
  { id: "hours_200",   name: "200 Horas",      icon: "🕐", desc: "200 horas de estudo acumuladas",         check: (s) => s.totalHours >= 200 },
];

const defaultState = () => ({
  sessions: [],
  simulados: [],
  questions: [],
  reviews: [],
  xp: 0,
  streak: 0,
  lastStudyDate: null,
  totalHours: 0,
  totalQuestions: 0,
  provaDate: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
  earnedBadges: [],
  activeTab: "dashboard",
  darkMode: false,
  aiMessages: [],
  weeklyGoalHours: 27,
  weekSessions: [],
});

// ─── Utility functions ────────────────────────────────────────────────────────
const daysUntil = (dateStr) => {
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
};

const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const getDisciplineName = (id) => DISCIPLINES.find(d => d.id === id)?.name || id;
const getDisciplineIcon = (id) => DISCIPLINES.find(d => d.id === id)?.icon || "📚";

const calcXPLevel = (xp) => {
  return XP_LEVELS.find(l => xp >= l.min && xp < l.max) || XP_LEVELS[XP_LEVELS.length - 1];
};

const calcPerformance = (sessions, discId) => {
  const filtered = discId ? sessions.filter(s => s.discipline === discId) : sessions;
  const total = filtered.reduce((a, b) => a + (b.questions || 0), 0);
  const correct = filtered.reduce((a, b) => a + (b.correct || 0), 0);
  if (!total) return null;
  return Math.round((correct / total) * 100);
};

// ─── AI Analysis ──────────────────────────────────────────────────────────────
const generateAIInsight = async (state, userMessage) => {
  const perf = DISCIPLINES.map(d => {
    const p = calcPerformance(state.sessions, d.id);
    return `${d.name}: ${p !== null ? p + "%" : "não estudado"}`;
  }).join(", ");

  const simAvg = state.simulados.length
    ? Math.round(state.simulados.reduce((a, b) => a + b.percent, 0) / state.simulados.length)
    : 0;

  const systemPrompt = `Você é o PMDF Coach, assistente especializado em preparação para concurso da PMDF (Soldado).
Dados do candidato:
- Horas estudadas: ${state.totalHours.toFixed(1)}h
- Streak: ${state.streak} dias
- Questões resolvidas: ${state.totalQuestions}
- Média nos simulados: ${simAvg}%
- Dias até a prova: ${daysUntil(state.provaDate)}
- Desempenho por disciplina: ${perf}

Seja direto, animador e específico. Use emojis. Máximo 3 parágrafos curtos.
Identifique pontos fracos (< 60%), fortes (> 80%) e sugira ação concreta para hoje.
Se não houver dados suficientes, incentive o registro e dê dica de estudo.`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage || "Analise meu desempenho e me dê orientações." }],
      }),
    });
    const data = await resp.json();
    return data.content?.map(c => c.text || "").join("") || "Erro ao conectar com a IA.";
  } catch {
    return "⚠️ Não foi possível conectar com a IA. Verifique sua conexão e tente novamente.";
  }
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  
  :root {
    --navy: #1a3a5c;
    --blue: #2563eb;
    --blue-light: #dbeafe;
    --blue-mid: #eff6ff;
    --green: #16a34a;
    --green-light: #dcfce7;
    --yellow: #ca8a04;
    --yellow-light: #fef9c3;
    --red: #dc2626;
    --red-light: #fee2e2;
    --orange: #ea580c;
    --orange-light: #fff7ed;
    --gray: #6b7280;
    --gray-light: #f9fafb;
    --gray-border: #e5e7eb;
    --white: #ffffff;
    --text: #111827;
    --text-2: #374151;
    --text-3: #6b7280;
    --bg: #f8fafc;
    --bg-card: #ffffff;
    --sidebar-bg: #1a3a5c;
    --sidebar-text: rgba(255,255,255,0.85);
    --sidebar-active: rgba(255,255,255,0.15);
    --input-bg: #f9fafb;
    --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04);
    --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04);
    --radius: 12px;
    --radius-sm: 8px;
    --transition: all 0.2s ease;
  }
  
  [data-dark="true"] {
    --navy: #0f2035;
    --blue: #3b82f6;
    --blue-light: #1e3a5f;
    --blue-mid: #1a2744;
    --green-light: #052e16;
    --yellow-light: #1a1400;
    --red-light: #1f0909;
    --orange-light: #1a0f00;
    --gray-light: #111827;
    --gray-border: #374151;
    --white: #1f2937;
    --text: #f9fafb;
    --text-2: #e5e7eb;
    --text-3: #9ca3af;
    --bg: #0f172a;
    --bg-card: #1e293b;
    --sidebar-bg: #0a1628;
    --sidebar-text: rgba(255,255,255,0.8);
    --input-bg: #1e293b;
    --shadow: 0 1px 3px rgba(0,0,0,0.3);
    --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.3);
    --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.3);
  }

  body { font-family: 'Inter', -apple-system, sans-serif; background: var(--bg); color: var(--text); }
  
  .app { display: flex; min-height: 100vh; }
  
  /* Sidebar */
  .sidebar {
    width: 240px; min-height: 100vh; background: var(--sidebar-bg);
    display: flex; flex-direction: column; position: fixed; left: 0; top: 0; bottom: 0;
    z-index: 100; transition: var(--transition);
  }
  .sidebar-logo {
    padding: 20px 16px 16px; border-bottom: 1px solid rgba(255,255,255,0.08);
    display: flex; align-items: center; gap: 10px;
  }
  .sidebar-logo-icon {
    width: 36px; height: 36px; background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    border-radius: 10px; display: flex; align-items: center; justify-content: center;
    font-size: 18px; flex-shrink: 0;
  }
  .sidebar-logo-text { color: #fff; font-size: 15px; font-weight: 700; line-height: 1.2; }
  .sidebar-logo-sub { color: rgba(255,255,255,0.5); font-size: 11px; }
  .sidebar-nav { padding: 8px; flex: 1; overflow-y: auto; }
  .nav-label { color: rgba(255,255,255,0.35); font-size: 10px; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; padding: 12px 8px 4px; }
  .nav-item {
    display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px;
    color: var(--sidebar-text); font-size: 13.5px; font-weight: 500; cursor: pointer;
    transition: var(--transition); margin-bottom: 2px; border: none; background: none; width: 100%; text-align: left;
  }
  .nav-item:hover { background: rgba(255,255,255,0.08); color: #fff; }
  .nav-item.active { background: rgba(59,130,246,0.25); color: #fff; }
  .nav-icon { font-size: 16px; width: 20px; text-align: center; }
  .sidebar-footer { padding: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
  .theme-toggle {
    display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px;
    background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); font-size: 13px;
    cursor: pointer; border: none; width: 100%; transition: var(--transition);
  }
  .theme-toggle:hover { background: rgba(255,255,255,0.12); color: #fff; }
  
  /* Main */
  .main { margin-left: 240px; flex: 1; min-height: 100vh; }
  .page-header {
    padding: 20px 28px 0; display: flex; align-items: flex-start; justify-content: space-between;
  }
  .page-title { font-size: 22px; font-weight: 800; color: var(--text); }
  .page-sub { font-size: 13px; color: var(--text-3); margin-top: 2px; }
  .page-content { padding: 16px 28px 40px; }
  
  /* Cards */
  .card {
    background: var(--bg-card); border-radius: var(--radius); border: 1px solid var(--gray-border);
    box-shadow: var(--shadow); padding: 20px;
  }
  .card-title { font-size: 13px; font-weight: 600; color: var(--text-3); text-transform: uppercase;
    letter-spacing: 0.04em; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
  
  /* KPI Grid */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
  .kpi-card {
    background: var(--bg-card); border-radius: var(--radius); border: 1px solid var(--gray-border);
    padding: 16px 18px; display: flex; flex-direction: column; gap: 6px;
    box-shadow: var(--shadow); position: relative; overflow: hidden;
  }
  .kpi-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: var(--kpi-color, var(--blue));
  }
  .kpi-label { font-size: 11.5px; font-weight: 600; color: var(--text-3); text-transform: uppercase;
    letter-spacing: 0.05em; }
  .kpi-value { font-size: 28px; font-weight: 800; color: var(--text); line-height: 1; }
  .kpi-sub { font-size: 11.5px; color: var(--text-3); }
  .kpi-icon { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 28px; opacity: 0.12; }
  
  /* Progress bar */
  .progress-wrap { background: var(--gray-border); border-radius: 999px; overflow: hidden; height: 6px; }
  .progress-bar { height: 100%; border-radius: 999px; transition: width 0.6s ease; }
  
  /* Grid layouts */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .mt-4 { margin-top: 14px; }
  .mt-6 { margin-top: 20px; }
  .mb-4 { margin-bottom: 14px; }
  
  /* Discipline table */
  .disc-table { width: 100%; border-collapse: collapse; }
  .disc-table th {
    text-align: left; font-size: 11px; font-weight: 600; color: var(--text-3);
    text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 10px;
    border-bottom: 1px solid var(--gray-border); white-space: nowrap;
  }
  .disc-table td { padding: 10px; border-bottom: 1px solid var(--gray-border); font-size: 13.5px; }
  .disc-table tr:last-child td { border-bottom: none; }
  .disc-table tr:hover td { background: var(--gray-light); }
  .disc-name { display: flex; align-items: center; gap: 8px; font-weight: 500; }
  
  /* Badges */
  .badge-pill {
    display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;
    border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap;
  }
  .badge-alta { background: var(--red-light); color: var(--red); }
  .badge-media { background: var(--yellow-light); color: var(--yellow); }
  .badge-baixa { background: var(--green-light); color: var(--green); }
  .badge-dominado { background: var(--green-light); color: var(--green); }
  .badge-revisao { background: var(--yellow-light); color: var(--yellow); }
  .badge-critico { background: var(--red-light); color: var(--red); }
  .badge-basico { background: var(--blue-light); color: var(--blue); }
  .badge-especifico { background: var(--orange-light); color: var(--orange); }
  
  /* Form elements */
  .form-group { margin-bottom: 14px; }
  .form-label { display: block; font-size: 12.5px; font-weight: 600; color: var(--text-2); margin-bottom: 5px; }
  .form-input, .form-select, .form-textarea {
    width: 100%; padding: 8px 12px; border-radius: var(--radius-sm);
    border: 1px solid var(--gray-border); background: var(--input-bg); color: var(--text);
    font-size: 13.5px; font-family: inherit; transition: var(--transition);
  }
  .form-input:focus, .form-select:focus, .form-textarea:focus {
    outline: none; border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
  }
  .form-textarea { resize: vertical; min-height: 80px; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  
  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
    border-radius: var(--radius-sm); font-size: 13.5px; font-weight: 600;
    cursor: pointer; transition: var(--transition); border: none; font-family: inherit;
  }
  .btn-primary { background: var(--blue); color: #fff; }
  .btn-primary:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: var(--shadow-md); }
  .btn-success { background: var(--green); color: #fff; }
  .btn-success:hover { background: #15803d; }
  .btn-danger { background: var(--red); color: #fff; }
  .btn-danger:hover { background: #b91c1c; }
  .btn-ghost { background: transparent; color: var(--text-2); border: 1px solid var(--gray-border); }
  .btn-ghost:hover { background: var(--gray-light); }
  .btn-sm { padding: 5px 10px; font-size: 12px; }
  .btn-full { width: 100%; justify-content: center; }
  
  /* XP / Gamification */
  .xp-card {
    background: linear-gradient(135deg, var(--navy) 0%, #2563eb 100%);
    border-radius: var(--radius); padding: 20px; color: white; position: relative; overflow: hidden;
  }
  .xp-card::after {
    content: ''; position: absolute; right: -20px; bottom: -20px;
    width: 120px; height: 120px; border-radius: 50%;
    background: rgba(255,255,255,0.06);
  }
  .xp-level { font-size: 28px; font-weight: 900; }
  .xp-name { font-size: 15px; font-weight: 600; opacity: 0.9; }
  .xp-bar-wrap { background: rgba(255,255,255,0.2); border-radius: 999px; height: 8px; margin: 12px 0 4px; }
  .xp-bar { height: 100%; border-radius: 999px; background: #fff; transition: width 0.6s ease; }
  .xp-label { font-size: 11.5px; opacity: 0.75; display: flex; justify-content: space-between; }
  
  /* Achievement badges */
  .achievement-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }
  .achievement {
    background: var(--gray-light); border: 1px solid var(--gray-border); border-radius: var(--radius-sm);
    padding: 14px 10px; text-align: center; transition: var(--transition);
  }
  .achievement.earned { background: var(--blue-mid); border-color: var(--blue); }
  .achievement-icon { font-size: 24px; margin-bottom: 6px; }
  .achievement-name { font-size: 11px; font-weight: 600; color: var(--text-2); line-height: 1.3; }
  .achievement.locked { opacity: 0.4; filter: grayscale(100%); }
  
  /* Calendar */
  .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .cal-day {
    aspect-ratio: 1; border-radius: 6px; display: flex; align-items: center; justify-content: center;
    font-size: 11.5px; font-weight: 500; cursor: pointer; transition: var(--transition);
    border: 1px solid transparent;
  }
  .cal-day.today { border-color: var(--blue); color: var(--blue); font-weight: 700; }
  .cal-day.studied { background: var(--green); color: #fff; }
  .cal-day.partial { background: var(--yellow-light); color: var(--yellow); }
  .cal-day.empty { color: var(--text-3); }
  .cal-day.other-month { opacity: 0.3; }
  .cal-header { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 4px; }
  .cal-hday { text-align: center; font-size: 11px; font-weight: 600; color: var(--text-3);
    text-transform: uppercase; letter-spacing: 0.05em; padding: 4px; }
  
  /* Charts (CSS-based) */
  .bar-chart { display: flex; align-items: flex-end; gap: 6px; height: 140px; padding-top: 10px; }
  .bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .bar {
    width: 100%; border-radius: 6px 6px 0 0; min-height: 4px; transition: height 0.6s ease;
    background: linear-gradient(180deg, var(--blue) 0%, #1d4ed8 100%);
    cursor: pointer; position: relative;
  }
  .bar:hover { filter: brightness(1.1); }
  .bar-label { font-size: 10px; color: var(--text-3); text-align: center; white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis; max-width: 100%; }
  .bar-val { font-size: 10.5px; font-weight: 700; color: var(--text-2); }
  
  /* Horizontal bar */
  .hbar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .hbar-label { font-size: 12px; color: var(--text-2); width: 160px; flex-shrink: 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hbar-wrap { flex: 1; background: var(--gray-border); border-radius: 999px; height: 8px; overflow: hidden; }
  .hbar-fill { height: 100%; border-radius: 999px; transition: width 0.6s ease; }
  .hbar-val { font-size: 12px; font-weight: 700; color: var(--text-2); width: 36px; text-align: right; flex-shrink: 0; }
  
  /* AI Chat */
  .chat-wrap { display: flex; flex-direction: column; height: 420px; }
  .chat-messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .chat-msg { display: flex; gap: 8px; max-width: 85%; }
  .chat-msg.user { flex-direction: row-reverse; align-self: flex-end; }
  .chat-bubble {
    padding: 10px 14px; border-radius: 14px; font-size: 13.5px; line-height: 1.55;
    white-space: pre-wrap; word-break: break-word;
  }
  .chat-msg.ai .chat-bubble { background: var(--gray-light); color: var(--text); border-bottom-left-radius: 4px; }
  .chat-msg.user .chat-bubble { background: var(--blue); color: #fff; border-bottom-right-radius: 4px; }
  .chat-avatar { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center;
    justify-content: center; font-size: 14px; flex-shrink: 0;
    background: linear-gradient(135deg, var(--navy), var(--blue)); color: #fff; }
  .chat-input-row { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--gray-border); }
  .chat-input { flex: 1; padding: 8px 12px; border-radius: 20px; border: 1px solid var(--gray-border);
    background: var(--input-bg); color: var(--text); font-size: 13.5px; font-family: inherit; }
  .chat-input:focus { outline: none; border-color: var(--blue); }
  .chat-loading { opacity: 0.6; font-style: italic; }
  
  /* Simulado */
  .sim-timeline { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }
  .sim-item {
    display: flex; align-items: center; gap: 12px; padding: 10px 14px;
    background: var(--gray-light); border-radius: var(--radius-sm);
    border: 1px solid var(--gray-border);
  }
  .sim-score {
    font-size: 20px; font-weight: 800; color: var(--text);
    min-width: 52px; text-align: center;
  }
  .sim-score.good { color: var(--green); }
  .sim-score.ok { color: var(--yellow); }
  .sim-score.bad { color: var(--red); }
  .sim-meta { flex: 1; }
  .sim-title { font-size: 13px; font-weight: 600; color: var(--text-2); }
  .sim-detail { font-size: 12px; color: var(--text-3); }
  .sim-trend { font-size: 18px; }
  
  /* Cronograma */
  .cron-phase { margin-bottom: 20px; }
  .cron-phase-title {
    font-size: 14px; font-weight: 700; color: var(--text); padding: 10px 14px;
    background: var(--blue-mid); border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    border: 1px solid var(--gray-border); border-bottom: none;
  }
  .cron-week {
    border: 1px solid var(--gray-border); border-bottom: none;
    display: flex; gap: 0; align-items: stretch;
  }
  .cron-week:last-child { border-bottom: 1px solid var(--gray-border); border-radius: 0 0 var(--radius-sm) var(--radius-sm); }
  .cron-week-num {
    width: 60px; padding: 10px; background: var(--gray-light);
    border-right: 1px solid var(--gray-border); display: flex; align-items: center;
    justify-content: center; font-size: 11px; font-weight: 700; color: var(--text-3);
    flex-shrink: 0; text-align: center;
  }
  .cron-week-content { flex: 1; padding: 10px 14px; }
  .cron-week-disc { font-size: 13.5px; font-weight: 600; color: var(--text); }
  .cron-week-focus { font-size: 12px; color: var(--text-3); margin-top: 2px; }
  .cron-week-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .cron-tag {
    padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
    background: var(--blue-light); color: var(--blue);
  }

  /* Revisão */
  .rev-row {
    display: flex; align-items: center; gap: 10px; padding: 8px 0;
    border-bottom: 1px solid var(--gray-border); font-size: 13px;
  }
  .rev-row:last-child { border-bottom: none; }
  .rev-date { 
    width: 90px; padding: 3px 8px; border-radius: var(--radius-sm);
    text-align: center; font-size: 12px; font-weight: 600;
  }
  .rev-date.overdue { background: var(--red-light); color: var(--red); }
  .rev-date.today-rev { background: var(--yellow-light); color: var(--yellow); }
  .rev-date.future { background: var(--green-light); color: var(--green); }
  .rev-disc { flex: 1; color: var(--text-2); }
  .rev-type { font-size: 11.5px; color: var(--text-3); padding: 2px 6px; background: var(--gray-light); border-radius: 4px; }

  /* Tabs */
  .tab-bar { display: flex; gap: 2px; border-bottom: 1px solid var(--gray-border); margin-bottom: 20px; }
  .tab-btn {
    padding: 8px 16px; font-size: 13.5px; font-weight: 500; color: var(--text-3);
    border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent;
    transition: var(--transition); font-family: inherit; margin-bottom: -1px;
  }
  .tab-btn.active { color: var(--blue); border-bottom-color: var(--blue); font-weight: 600; }
  .tab-btn:hover { color: var(--text); }

  /* Notifications / Toast */
  .toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    background: var(--text); color: var(--bg-card); padding: 12px 18px;
    border-radius: var(--radius-sm); font-size: 13.5px; font-weight: 500;
    box-shadow: var(--shadow-lg); animation: slideIn 0.3s ease;
    max-width: 320px;
  }
  @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  /* Modal */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200;
    display: flex; align-items: center; justify-content: center; padding: 20px;
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal {
    background: var(--bg-card); border-radius: var(--radius); padding: 24px;
    max-width: 500px; width: 100%; box-shadow: var(--shadow-lg); max-height: 90vh; overflow-y: auto;
  }
  .modal-title { font-size: 17px; font-weight: 700; color: var(--text); margin-bottom: 16px; }
  
  /* Empty state */
  .empty { text-align: center; padding: 40px 20px; color: var(--text-3); }
  .empty-icon { font-size: 40px; margin-bottom: 12px; }
  .empty-title { font-size: 15px; font-weight: 600; color: var(--text-2); margin-bottom: 6px; }
  .empty-desc { font-size: 13px; line-height: 1.5; }

  /* Responsive */
  @media (max-width: 900px) {
    .sidebar { width: 60px; }
    .sidebar-logo-text, .sidebar-logo-sub, .nav-item span, .nav-label, .sidebar-footer .theme-toggle span { display: none; }
    .main { margin-left: 60px; }
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
    .form-row, .form-row-3 { grid-template-columns: 1fr; }
    .page-content { padding: 12px 16px 32px; }
    .page-header { padding: 16px 16px 0; }
  }
  @media (max-width: 500px) {
    .kpi-grid { grid-template-columns: 1fr 1fr; }
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--gray-border); border-radius: 3px; }

  /* Misc */
  .divider { height: 1px; background: var(--gray-border); margin: 16px 0; }
  .text-muted { color: var(--text-3); font-size: 12.5px; }
  .text-success { color: var(--green); }
  .text-danger { color: var(--red); }
  .text-warning { color: var(--yellow); }
  .fw-700 { font-weight: 700; }
  .flex { display: flex; }
  .flex-center { display: flex; align-items: center; }
  .flex-between { display: flex; align-items: center; justify-content: space-between; }
  .gap-2 { gap: 8px; }
  .gap-3 { gap: 12px; }
  .mb-2 { margin-bottom: 8px; }
  .mb-3 { margin-bottom: 12px; }
  .section-title {
    font-size: 15px; font-weight: 700; color: var(--text);
    margin-bottom: 14px; display: flex; align-items: center; gap: 8px;
  }
`;

// ─── Components ───────────────────────────────────────────────────────────────

function Toast({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, []);
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}

function ProgressBar({ value, max = 100, color = "var(--blue)", height = 6 }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="progress-wrap" style={{ height }}>
      <div className="progress-bar" style={{ width: `${pct}%`, background: color, height }} />
    </div>
  );
}

function KPICard({ icon, label, value, sub, color = "var(--blue)", size = 28 }) {
  return (
    <div className="kpi-card" style={{ "--kpi-color": color }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ fontSize: size }}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      <div className="kpi-icon">{icon}</div>
    </div>
  );
}

function BadgePill({ type }) {
  const map = {
    alta: ["badge-pill badge-alta", "🔴 Alta"],
    media: ["badge-pill badge-media", "🟡 Média"],
    baixa: ["badge-pill badge-baixa", "🟢 Baixa"],
    dominado: ["badge-pill badge-dominado", "✅ Dominado"],
    revisao: ["badge-pill badge-revisao", "🟡 Revisão"],
    critico: ["badge-pill badge-critico", "🔴 Crítico"],
    basico: ["badge-pill badge-basico", "Básico"],
    especifico: ["badge-pill badge-especifico", "Específico"],
  };
  const [cls, label] = map[type] || ["badge-pill", type];
  return <span className={cls}>{label}</span>;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ state, dispatch }) {
  const days = daysUntil(state.provaDate);
  const totalHours = state.totalHours || 0;
  const goalHours = 590;
  const pctDone = Math.min(100, Math.round((totalHours / goalHours) * 100));

  const simAvg = state.simulados.length
    ? Math.round(state.simulados.reduce((a, b) => a + b.percent, 0) / state.simulados.length)
    : 0;

  const dominated = DISCIPLINES.filter(d => {
    const p = calcPerformance(state.sessions, d.id);
    return p !== null && p >= 85;
  }).length;

  const critical = DISCIPLINES.filter(d => {
    const p = calcPerformance(state.sessions, d.id);
    return p !== null && p < 60;
  }).length;

  const level = calcXPLevel(state.xp);
  const nextLevel = XP_LEVELS.find(l => l.min > level.min) || level;
  const xpForNext = nextLevel.min - level.min;
  const xpProgress = state.xp - level.min;

  return (
    <div>
      <div className="kpi-grid">
        <KPICard icon="📅" label="Dias até a Prova" value={days} sub={`Data: ${formatDate(state.provaDate)}`} color="var(--navy)" />
        <KPICard icon="⏱️" label="Horas Estudadas" value={`${totalHours.toFixed(1)}h`} sub={`Meta: ${goalHours}h  (${pctDone}%)`} color="var(--blue)" />
        <KPICard icon="🔥" label="Streak Atual" value={`${state.streak} dias`} sub="Não quebre a sequência!" color="var(--orange)" />
        <KPICard icon="📊" label="Média Simulados" value={simAvg ? `${simAvg}%` : "—"} sub={simAvg >= 60 ? "✅ Acima da meta" : "Meta: 60%"} color={simAvg >= 60 ? "var(--green)" : "var(--red)"} />
      </div>

      <div className="grid-2 mt-4">
        {/* XP Card */}
        <div className="xp-card">
          <div className="flex-between mb-2">
            <div>
              <div className="xp-level">⭐ {level.name}</div>
              <div className="xp-name" style={{ marginTop: 4 }}>{state.xp.toLocaleString()} XP acumulados</div>
            </div>
            <div style={{ fontSize: 40 }}>🎮</div>
          </div>
          <div className="xp-bar-wrap">
            <div className="xp-bar" style={{ width: `${xpForNext > 0 ? Math.round((xpProgress / xpForNext) * 100) : 100}%` }} />
          </div>
          <div className="xp-label">
            <span>{level.name}</span>
            <span>{xpProgress}/{xpForNext} XP para {nextLevel.name}</span>
          </div>
        </div>

        {/* Progress card */}
        <div className="card">
          <div className="card-title">📈 Progresso do Edital</div>
          <div style={{ marginBottom: 14 }}>
            <div className="flex-between mb-2">
              <span style={{ fontSize: 13 }}>Edital concluído</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{pctDone}%</span>
            </div>
            <ProgressBar value={pctDone} color="var(--blue)" height={10} />
          </div>
          <div className="grid-2 gap-2">
            <div style={{ background: "var(--green-light)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green)" }}>{dominated}</div>
              <div style={{ fontSize: 11.5, color: "var(--green)" }}>✅ Dominadas</div>
            </div>
            <div style={{ background: "var(--red-light)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--red)" }}>{critical}</div>
              <div style={{ fontSize: 11.5, color: "var(--red)" }}>🔴 Críticas</div>
            </div>
          </div>
        </div>
      </div>

      {/* Discipline performance */}
      <div className="card mt-4">
        <div className="card-title">📚 Desempenho por Disciplina</div>
        {DISCIPLINES.map(d => {
          const perf = calcPerformance(state.sessions, d.id);
          const hrs = state.sessions.filter(s => s.discipline === d.id).reduce((a, b) => a + (b.hours || 0), 0);
          const color = perf === null ? "var(--gray-border)" : perf >= 85 ? "var(--green)" : perf >= 70 ? "var(--yellow)" : "var(--red)";
          return (
            <div key={d.id} className="hbar-row">
              <div className="hbar-label" title={d.name}>{d.icon} {d.name}</div>
              <div className="hbar-wrap">
                <div className="hbar-fill" style={{ width: `${perf || 0}%`, background: color }} />
              </div>
              <div className="hbar-val" style={{ color }}>{perf !== null ? `${perf}%` : "—"}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", width: 40, textAlign: "right" }}>{hrs.toFixed(1)}h</div>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="card mt-4">
        <div className="card-title">⚡ Ações Rápidas</div>
        <div className="grid-4 gap-2">
          {[
            { label: "Registrar Estudo", icon: "📋", tab: "estudos", color: "var(--blue)" },
            { label: "Novo Simulado", icon: "🏆", tab: "simulados", color: "var(--green)" },
            { label: "Ver Revisões", icon: "🔄", tab: "revisoes", color: "var(--orange)" },
            { label: "Falar com IA", icon: "🤖", tab: "ia", color: "var(--navy)" },
          ].map(a => (
            <button key={a.tab} className="btn btn-ghost btn-full"
              style={{ borderColor: a.color, color: a.color, flexDirection: "column", gap: 6, padding: "12px 8px", height: 70 }}
              onClick={() => dispatch({ type: "SET_TAB", tab: a.tab })}>
              <span style={{ fontSize: 22 }}>{a.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Date prova setting */}
      <div className="card mt-4">
        <div className="card-title">📅 Data da Prova</div>
        <div className="form-row">
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Data prevista</label>
            <input type="date" className="form-input"
              value={state.provaDate}
              onChange={e => dispatch({ type: "SET_PROVA_DATE", date: e.target.value })} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 0 }}>
            <div style={{ background: "var(--blue-mid)", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "var(--blue)", fontWeight: 600 }}>
              ⚠️ Válido até 02/08/2028 (prorrogado)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ESTUDOS ──────────────────────────────────────────────────────────────────
function Estudos({ state, dispatch, toast }) {
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], discipline: "", subject: "", block: "Teoria", hours: "", questions: "", correct: "", notes: "" });
  const [activeTab, setActiveTab] = useState("registro");

  const handleSubmit = () => {
    if (!form.discipline || !form.hours) { toast("Preencha disciplina e horas!"); return; }
    dispatch({ type: "ADD_SESSION", session: { ...form, id: Date.now(), hours: parseFloat(form.hours) || 0, questions: parseInt(form.questions) || 0, correct: parseInt(form.correct) || 0 } });
    toast("✅ Estudo registrado! +50 XP");
    setForm({ ...form, subject: "", hours: "", questions: "", correct: "", notes: "" });
  };

  const sessions = [...state.sessions].reverse().slice(0, 50);

  return (
    <div>
      <div className="tab-bar">
        {["registro", "historico"].map(t => (
          <button key={t} className={`tab-btn ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}>
            {t === "registro" ? "📝 Registrar Estudo" : "📋 Histórico"}
          </button>
        ))}
      </div>

      {activeTab === "registro" && (
        <div className="grid-2">
          <div className="card">
            <div className="section-title">📝 Novo Registro</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Data</label>
                <input type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Bloco</label>
                <select className="form-select" value={form.block} onChange={e => setForm({ ...form, block: e.target.value })}>
                  {["Teoria", "Questões", "Revisão", "Simulado"].map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Disciplina *</label>
              <select className="form-select" value={form.discipline} onChange={e => setForm({ ...form, discipline: e.target.value })}>
                <option value="">Selecione...</option>
                {DISCIPLINES.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Assunto estudado</label>
              <input className="form-input" placeholder="Ex: Interpretação de texto, tipologia textual..." value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Horas *</label>
                <input type="number" step="0.25" min="0" max="12" className="form-input" placeholder="1.5" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Questões</label>
                <input type="number" min="0" className="form-input" placeholder="20" value={form.questions} onChange={e => setForm({ ...form, questions: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Acertos</label>
                <input type="number" min="0" className="form-input" placeholder="15" value={form.correct} onChange={e => setForm({ ...form, correct: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Observações</label>
              <textarea className="form-textarea" placeholder="Dificuldades, dúvidas, próximos passos..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <button className="btn btn-primary btn-full" onClick={handleSubmit}>✅ Registrar Estudo</button>
          </div>

          <div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-title">📊 Resumo da Semana</div>
              {(() => {
                const week = state.sessions.filter(s => {
                  const d = new Date(s.date);
                  const now = new Date();
                  const start = new Date(now); start.setDate(now.getDate() - now.getDay());
                  return d >= start;
                });
                const hrs = week.reduce((a, b) => a + (b.hours || 0), 0);
                const qs = week.reduce((a, b) => a + (b.questions || 0), 0);
                const cor = week.reduce((a, b) => a + (b.correct || 0), 0);
                return (
                  <div className="grid-3 gap-2">
                    <div style={{ textAlign: "center", padding: "10px 4px" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--blue)" }}>{hrs.toFixed(1)}h</div>
                      <div className="text-muted">horas</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "10px 4px" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--green)" }}>{qs}</div>
                      <div className="text-muted">questões</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "10px 4px" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--orange)" }}>
                        {qs > 0 ? Math.round((cor / qs) * 100) : 0}%
                      </div>
                      <div className="text-muted">acerto</div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="card">
              <div className="card-title">🔔 Revisões de Hoje</div>
              {(() => {
                const today = new Date().toDateString();
                const pending = state.reviews.filter(r => {
                  if (!r.nextDate) return false;
                  return new Date(r.nextDate).toDateString() === today || new Date(r.nextDate) < new Date();
                }).slice(0, 5);
                if (!pending.length) return <div className="empty"><div className="empty-icon">✅</div><div className="empty-title">Sem revisões pendentes hoje</div></div>;
                return pending.map(r => (
                  <div key={r.id} className="rev-row">
                    <div className={`rev-date ${new Date(r.nextDate) < new Date() ? "overdue" : "today-rev"}`}>
                      {new Date(r.nextDate) < new Date() ? "Atrasada" : "Hoje"}
                    </div>
                    <div className="rev-disc">{getDisciplineIcon(r.discipline)} {r.subject || getDisciplineName(r.discipline)}</div>
                    <div className="rev-type">D+{r.offset}</div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {activeTab === "historico" && (
        <div className="card">
          <div className="card-title">📋 Histórico de Estudos ({state.sessions.length} registros)</div>
          {!sessions.length && <div className="empty"><div className="empty-icon">📚</div><div className="empty-title">Nenhum estudo registrado ainda</div><div className="empty-desc">Comece registrando seu primeiro estudo!</div></div>}
          <table className="disc-table" style={{ display: sessions.length ? "table" : "none" }}>
            <thead>
              <tr>
                <th>Data</th><th>Disciplina</th><th>Assunto</th><th>Bloco</th><th>Horas</th><th>Questões</th><th>Acertos</th><th>%</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => {
                const pct = s.questions ? Math.round((s.correct / s.questions) * 100) : null;
                const status = pct === null ? "—" : pct >= 85 ? "✅ Dominado" : pct >= 70 ? "🟡 Revisão" : "🔴 Crítico";
                return (
                  <tr key={s.id}>
                    <td>{formatDate(s.date)}</td>
                    <td><div className="disc-name">{getDisciplineIcon(s.discipline)} {getDisciplineName(s.discipline)}</div></td>
                    <td style={{ fontSize: 12, color: "var(--text-3)" }}>{s.subject || "—"}</td>
                    <td><span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 99, background: "var(--blue-light)", color: "var(--blue)", fontWeight: 600 }}>{s.block}</span></td>
                    <td style={{ fontWeight: 600 }}>{s.hours}h</td>
                    <td>{s.questions || 0}</td>
                    <td style={{ color: "var(--green)" }}>{s.correct || 0}</td>
                    <td style={{ fontWeight: 700, color: pct >= 70 ? "var(--green)" : pct >= 60 ? "var(--yellow)" : pct !== null ? "var(--red)" : "var(--text-3)" }}>
                      {pct !== null ? `${pct}%` : "—"}
                    </td>
                    <td style={{ fontSize: 12 }}>{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── SIMULADOS ────────────────────────────────────────────────────────────────
function Simulados({ state, dispatch, toast }) {
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], type: "Completo (80q)", total: 80, correct: "", time: "", notes: "" });

  const handleSubmit = () => {
    if (!form.correct) { toast("Informe a quantidade de acertos!"); return; }
    const correct = parseInt(form.correct);
    const total = parseInt(form.total) || 80;
    const percent = Math.round((correct / total) * 100);
    dispatch({ type: "ADD_SIMULADO", simulado: { ...form, id: Date.now(), correct, total, percent } });
    toast(`🏆 Simulado registrado! ${percent}% — ${percent >= 60 ? "✅ Aprovado" : "❌ Abaixo da média"} +${percent >= 80 ? 800 : percent >= 70 ? 500 : 200} XP`);
    setForm({ ...form, correct: "", time: "", notes: "" });
  };

  const sims = [...state.simulados].reverse();
  const maxPct = sims.length ? Math.max(...sims.map(s => s.percent)) : 0;
  const avgPct = sims.length ? Math.round(sims.reduce((a, b) => a + b.percent, 0) / sims.length) : 0;
  const lastPct = sims[0]?.percent || 0;
  const trend = sims.length >= 2 ? sims[0].percent - sims[1].percent : 0;

  return (
    <div>
      <div className="grid-2">
        <div className="card">
          <div className="section-title">🏆 Registrar Simulado</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Data</label>
              <input type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {["Completo (80q)", "Básico (40q)", "Específico (40q)", "Mini (20q)", "Simulado temático"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Total de questões</label>
              <input type="number" className="form-input" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Acertos *</label>
              <input type="number" className="form-input" placeholder="56" value={form.correct} onChange={e => setForm({ ...form, correct: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Tempo (min)</label>
              <input type="number" className="form-input" placeholder="150" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
            </div>
          </div>
          {form.correct && (
            <div style={{ background: parseInt(form.correct) / parseInt(form.total || 80) >= 0.6 ? "var(--green-light)" : "var(--red-light)", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, color: parseInt(form.correct) / parseInt(form.total || 80) >= 0.6 ? "var(--green)" : "var(--red)" }}>
                {Math.round((parseInt(form.correct) / parseInt(form.total || 80)) * 100)}%
                {parseInt(form.correct) / parseInt(form.total || 80) >= 0.60 ? " ✅ Aprovado" : " ❌ Abaixo do mínimo (60%)"}
              </span>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Pontos fracos identificados</label>
            <textarea className="form-textarea" placeholder="Matérias que errei mais, dúvidas..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button className="btn btn-primary btn-full" onClick={handleSubmit}>✅ Salvar Simulado</button>
        </div>

        <div>
          <div className="kpi-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}>
            <KPICard icon="📊" label="Média Geral" value={avgPct ? `${avgPct}%` : "—"} sub="todos os simulados" color="var(--blue)" />
            <KPICard icon="🏆" label="Melhor Nota" value={maxPct ? `${maxPct}%` : "—"} sub={maxPct >= 60 ? "✅ Acima da meta" : "Meta: 60%"} color={maxPct >= 60 ? "var(--green)" : "var(--red)"} />
            <KPICard icon="📈" label="Último" value={lastPct ? `${lastPct}%` : "—"} sub={trend > 0 ? `↑ +${trend}%` : trend < 0 ? `↓ ${trend}%` : "Estável"} color={lastPct >= 60 ? "var(--green)" : "var(--red)"} />
            <KPICard icon="🎯" label="Total" value={sims.length} sub="simulados feitos" color="var(--navy)" />
          </div>

          {sims.length > 1 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-title">📈 Evolução</div>
              <div className="bar-chart">
                {[...sims].reverse().slice(-8).map((s, i) => {
                  const color = s.percent >= 70 ? "var(--green)" : s.percent >= 60 ? "var(--yellow)" : "var(--red)";
                  return (
                    <div key={s.id} className="bar-wrap">
                      <div className="bar-val" style={{ color }}>{s.percent}%</div>
                      <div className="bar" style={{ height: `${s.percent}%`, background: `linear-gradient(180deg, ${color}, ${color}88)` }} title={`${s.percent}% — ${formatDate(s.date)}`} />
                      <div className="bar-label">#{i + 1}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ borderTop: "1px dashed var(--gray-border)", paddingTop: 6, marginTop: 4 }}>
                <div style={{ display: "flex", justifyContent: "center", gap: 16, fontSize: 11 }}>
                  <span style={{ color: "var(--red)" }}>— Abaixo 60%</span>
                  <span style={{ color: "var(--yellow)" }}>— 60–70%</span>
                  <span style={{ color: "var(--green)" }}>— ≥ 70%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-title">📋 Histórico de Simulados</div>
        {!sims.length && <div className="empty"><div className="empty-icon">🏆</div><div className="empty-title">Nenhum simulado registrado</div><div className="empty-desc">Faça seu primeiro simulado completo (80 questões) e registre aqui.</div></div>}
        <div className="sim-timeline">
          {sims.map((s, i) => {
            const prev = sims[i + 1];
            const trend = prev ? s.percent - prev.percent : null;
            return (
              <div key={s.id} className="sim-item">
                <div style={{ fontSize: 13, color: "var(--text-3)", minWidth: 24, fontWeight: 700 }}>#{sims.length - i}</div>
                <div className={`sim-score ${s.percent >= 70 ? "good" : s.percent >= 60 ? "ok" : "bad"}`}>{s.percent}%</div>
                <div className="sim-meta">
                  <div className="sim-title">{s.type} — {formatDate(s.date)}</div>
                  <div className="sim-detail">{s.correct}/{s.total} questões {s.time ? `• ${s.time}min` : ""} {s.notes ? `• ${s.notes.slice(0, 40)}...` : ""}</div>
                </div>
                <div className="sim-trend">{trend === null ? "—" : trend > 0 ? "⬆️" : trend < 0 ? "⬇️" : "➡️"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── CRONOGRAMA ───────────────────────────────────────────────────────────────
function Cronograma({ state }) {
  const [plan, setPlan] = useState("3m");

  const plans = {
    "3m": {
      title: "📅 Plano 3 Meses — Intensivo",
      phases: [
        { title: "🟢 FASE 1 — Fundamentos (Semanas 1–4)", weeks: [
          { num: "S01", disc: "Língua Portuguesa", focus: "Interpretação de texto, tipologia, leitura ativa", tags: ["Teoria", "4h/dia"] },
          { num: "S02", disc: "Língua Portuguesa", focus: "Ortografia, acentuação, pontuação, coesão", tags: ["Teoria + Questões"] },
          { num: "S03", disc: "Matemática / Lógico", focus: "Razão, proporção, porcentagem, juros simples", tags: ["Teoria", "4h/dia"] },
          { num: "S04", disc: "Matemática / Lógico", focus: "Lógica proposicional, tabelas verdade, negação", tags: ["Questões"] },
        ]},
        { title: "🔵 FASE 2 — Bloco Jurídico (Semanas 5–8)", weeks: [
          { num: "S05", disc: "Dir. Constitucional + DH", focus: "Princípios fundamentais CF/88, direitos individuais, Art. 5º", tags: ["Alta Prioridade", "8q na prova"] },
          { num: "S06", disc: "Dir. Constitucional + DH", focus: "Direitos sociais, segurança pública Art.144, defesa do Estado", tags: ["Alta Prioridade"] },
          { num: "S07", disc: "Legislação PMDF / LODF", focus: "Lei Orgânica do DF — 50% das questões específicas foram LODF!", tags: ["Alta Prioridade", "LODF = 50% das questões"] },
          { num: "S08", disc: "Legislação PMDF / LODF", focus: "Estatuto dos Policiais Militares, Regulamento Disciplinar PMDF", tags: ["Alta Prioridade"] },
        ]},
        { title: "🔴 FASE 3 — Direito Penal + Revisão Geral (Semanas 9–12)", weeks: [
          { num: "S09", disc: "Direito Penal", focus: "Teoria do crime, tipicidade, antijuridicidade, culpabilidade, causas excludentes", tags: ["Alta Prioridade"] },
          { num: "S10", disc: "Direito Penal", focus: "Crimes em espécie: homicídio, lesão, patrimônio, drogas, Adm. Pública", tags: ["Questões intensivas"] },
          { num: "S11", disc: "Dir. Processual Penal", focus: "Inquérito policial, prisões, interceptação telefônica (Lei 9.296/96)", tags: ["Alta Prioridade"] },
          { num: "S12", disc: "🔄 REVISÃO GERAL", focus: "Simulado modelo real (80q), correção detalhada, lacunas — META: ≥ 50%", tags: ["Simulado", "Revisão Total"] },
        ]},
      ]
    },
    "6m": {
      title: "📅 Plano 6 Meses — Completo",
      phases: [
        { title: "🟢 Meses 1–2 — Fundamentos", weeks: [
          { num: "M01", disc: "Português + Mat/Lógico", focus: "Interpretação, gramática, raciocínio lógico, proporção, porcentagem", tags: ["Base cognitiva"] },
          { num: "M02", disc: "Dir. Constitucional + LODF", focus: "CF/88 completa + Lei Orgânica do DF + Estatuto PMDF — Maior bloco do edital (13q)", tags: ["Alta Prioridade", "13q na prova"] },
        ]},
        { title: "🔵 Meses 3–4 — Bloco Penal", weeks: [
          { num: "M03", disc: "Dir. Penal + Processual Penal", focus: "Teoria do crime, crimes em espécie, inquérito policial, prisões, interceptação", tags: ["Alta Prioridade", "11q na prova"] },
          { num: "M04", disc: "Dir. Penal Militar + Leg. Especial", focus: "Crimes militares (80% do DPM), Lei Drogas, ECA, Maria da Penha", tags: ["Específico PM", "9q na prova"] },
        ]},
        { title: "🟣 Meses 5–6 — Finalização + Simulados", weeks: [
          { num: "M05", disc: "Dir. Adm. + Criminologia + Inglês", focus: "Atos adm., poder de polícia, teorias criminológicas, reading comprehension", tags: ["Completar edital"] },
          { num: "M06", disc: "🔄 REVISÃO + SIMULADOS INTENSIVOS", focus: "4 simulados completos, D+90 de toda matéria, meta ≥ 65%", tags: ["Simulados", "Meta ≥ 65%"] },
        ]},
      ]
    },
    "12m": {
      title: "📅 Plano 12 Meses — Profundo",
      phases: [
        { title: "🟢 Fase 1 — Construção de Base (Meses 1–4)", weeks: [
          { num: "M01", disc: "Nivelamento + Português", focus: "Criar hábito de 4h/dia, diagnóstico, interpretação de texto, gramática básica", tags: ["Zero absoluto → 40% no simulado"] },
          { num: "M02", disc: "Matemática / Raciocínio Lógico", focus: "Todo conteúdo: porcentagem, regra de três, lógica, sequências, raciocínio espacial", tags: ["10q na prova"] },
          { num: "M03", disc: "Dir. Constitucional + DH", focus: "CF/88 completa — direit. fundamentais, organização do Estado, segurança pública", tags: ["8q na prova", "Base jurídica"] },
          { num: "M04", disc: "Legislação PMDF / LODF", focus: "LODF profundo, Estatuto dos Policiais Militares, Regulamento Disciplinar PMDF", tags: ["5q na prova", "50% LODF"] },
        ]},
        { title: "🔵 Fase 2 — Bloco Penal Completo (Meses 5–8)", weeks: [
          { num: "M05", disc: "Direito Penal", focus: "Princípios → teoria do crime → crimes em espécie → extinção da punibilidade", tags: ["6q na prova", "Alta prioridade"] },
          { num: "M06", disc: "Dir. Processual Penal", focus: "Inquérito policial, competência, provas, prisões, interceptação telefônica Lei 9.296/96", tags: ["5q na prova"] },
          { num: "M07", disc: "Dir. Penal Militar + CPPM", focus: "CPM — crimes militares (80% do conteúdo cobrado em 2023), CPPM básico", tags: ["9q na prova", "Específico PM"] },
          { num: "M08", disc: "Legislação Penal Especial", focus: "Lei de Drogas 11.343/06, ECA, Maria da Penha 11.340/06, Estatuto do Desarmamento", tags: ["4q na prova"] },
        ]},
        { title: "🟣 Fase 3 — Completar Edital (Meses 9–10)", weeks: [
          { num: "M09", disc: "Dir. Adm. + Criminologia", focus: "Atos adm., poder de polícia, licitação; teorias criminológicas, vitimologia, prevenção", tags: ["8q na prova"] },
          { num: "M10", disc: "Informática + Inglês + Atualidades", focus: "Windows, Word, Excel, Internet; reading comprehension; segurança pública DF", tags: ["17q na prova", "Maximizar pontos"] },
        ]},
        { title: "🔴 Fase 4 — Sprint Final (Meses 11–12)", weeks: [
          { num: "M11", disc: "Simulados Intensivos", focus: "6 simulados completos/mês, correção detalhada, meta ≥ 70% constante, revisão erros", tags: ["Meta ≥ 70%"] },
          { num: "M12", disc: "Sprint Final", focus: "Revisão expressa, mapas mentais, 2 simulados, descanso estratégico — NADA DE CONTEÚDO NOVO", tags: ["Confiança > Estudo", "Dormir bem"] },
        ]},
      ]
    },
  };

  const p = plans[plan];

  return (
    <div>
      <div className="tab-bar">
        {[["3m", "🏃 3 Meses"], ["6m", "🚶 6 Meses"], ["12m", "🎓 12 Meses"]].map(([k, l]) => (
          <button key={k} className={`tab-btn ${plan === k ? "active" : ""}`} onClick={() => setPlan(k)}>{l}</button>
        ))}
      </div>

      <div className="card mb-4" style={{ background: "var(--blue-mid)", borderColor: "var(--blue)" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div><span style={{ fontWeight: 700, color: "var(--blue)" }}>📚 Rotina diária:</span> <span style={{ fontSize: 13 }}>Bloco 1: 1h50 teoria  |  Intervalo 10min  |  Bloco 2: 1h30 questões  |  Bloco 3: 30min revisão  =  4h líquidas</span></div>
          <div><span style={{ fontWeight: 700, color: "var(--blue)" }}>📅 Sábado:</span> <span style={{ fontSize: 13 }}>Revisão semanal + mini simulado (4–6h)</span></div>
          <div><span style={{ fontWeight: 700, color: "var(--blue)" }}>🏆 Domingo:</span> <span style={{ fontSize: 13 }}>Simulado completo + correção + planejamento (3–5h)</span></div>
        </div>
      </div>

      {p.phases.map((phase, pi) => (
        <div key={pi} className="cron-phase">
          <div className="cron-phase-title">{phase.title}</div>
          {phase.weeks.map((w, wi) => (
            <div key={wi} className="cron-week">
              <div className="cron-week-num">{w.num}</div>
              <div className="cron-week-content">
                <div className="cron-week-disc">{w.disc}</div>
                <div className="cron-week-focus">{w.focus}</div>
                <div className="cron-week-tags">
                  {w.tags.map(t => <span key={t} className="cron-tag">{t}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── REVISÕES ─────────────────────────────────────────────────────────────────
function Revisoes({ state }) {
  const today = new Date();
  const allRevs = state.reviews || [];
  const overdue = allRevs.filter(r => r.nextDate && new Date(r.nextDate) < today && !r.done);
  const todayRevs = allRevs.filter(r => r.nextDate && new Date(r.nextDate).toDateString() === today.toDateString());
  const upcoming = allRevs.filter(r => r.nextDate && new Date(r.nextDate) > today).sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate)).slice(0, 15);

  const RevItem = ({ r, status }) => {
    const d = r.nextDate ? new Date(r.nextDate) : null;
    const cls = status === "overdue" ? "overdue" : status === "today" ? "today-rev" : "future";
    const label = status === "overdue" ? `${Math.ceil((today - d) / 86400000)}d atraso` : status === "today" ? "Hoje" : formatDate(r.nextDate);
    return (
      <div className="rev-row">
        <div className={`rev-date ${cls}`}>{label}</div>
        <div className="rev-disc">{getDisciplineIcon(r.discipline)} {r.subject || getDisciplineName(r.discipline)}</div>
        <div className="rev-type">D+{r.offset}</div>
      </div>
    );
  };

  return (
    <div>
      <div className="grid-3 mb-4">
        <div className="card" style={{ borderTop: "3px solid var(--red)" }}>
          <div className="card-title" style={{ color: "var(--red)" }}>🔴 Atrasadas</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--red)" }}>{overdue.length}</div>
          <div className="text-muted">revisões em atraso</div>
        </div>
        <div className="card" style={{ borderTop: "3px solid var(--yellow)" }}>
          <div className="card-title" style={{ color: "var(--yellow)" }}>🟡 Para Hoje</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--yellow)" }}>{todayRevs.length}</div>
          <div className="text-muted">revisões programadas</div>
        </div>
        <div className="card" style={{ borderTop: "3px solid var(--green)" }}>
          <div className="card-title" style={{ color: "var(--green)" }}>🟢 Próximas</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--green)" }}>{upcoming.length}</div>
          <div className="text-muted">revisões futuras</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title">🔴 Atrasadas + Hoje</div>
          {[...overdue, ...todayRevs].length === 0
            ? <div className="empty"><div className="empty-icon">✅</div><div className="empty-title">Sem pendências!</div><div className="empty-desc">Continue registrando estudos para gerar revisões automáticas.</div></div>
            : [...overdue.map(r => ({ ...r, s: "overdue" })), ...todayRevs.map(r => ({ ...r, s: "today" }))].map(r => <RevItem key={r.id} r={r} status={r.s} />)
          }
        </div>
        <div className="card">
          <div className="section-title">📅 Próximas Revisões</div>
          {upcoming.length === 0
            ? <div className="empty"><div className="empty-icon">📆</div><div className="empty-title">Sem revisões futuras ainda</div><div className="empty-desc">As revisões são agendadas automaticamente quando você registra um estudo.</div></div>
            : upcoming.map(r => <RevItem key={r.id} r={r} status="future" />)
          }
        </div>
      </div>

      <div className="card mt-4">
        <div className="section-title">ℹ️ Como funciona a Revisão Espaçada</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          {[["D+1", "No dia seguinte", "var(--red)"], ["D+7", "1 semana", "var(--orange)"], ["D+15", "2 semanas", "var(--yellow)"], ["D+30", "1 mês", "var(--blue)"], ["D+60", "2 meses", "var(--navy)"], ["D+90", "3 meses", "var(--green)"]].map(([d, l, c]) => (
            <div key={d} style={{ textAlign: "center", padding: "12px 8px", background: "var(--gray-light)", borderRadius: 8, borderTop: `3px solid ${c}` }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{d}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
        <div className="text-muted mt-4" style={{ fontSize: 12, lineHeight: 1.6 }}>
          📌 A revisão espaçada é baseada na Curva do Esquecimento de Ebbinghaus. Revisar no momento certo aumenta a retenção de memória em até 400% comparado à releitura passiva. Cada vez que você registra um estudo, o sistema agenda automaticamente as 6 revisões para esse conteúdo.
        </div>
      </div>
    </div>
  );
}

// ─── GAMIFICAÇÃO ─────────────────────────────────────────────────────────────
function Gamificacao({ state }) {
  const level = calcXPLevel(state.xp);
  const nextLevel = XP_LEVELS.find(l => l.min > level.min) || level;
  const xpProgress = state.xp - level.min;
  const xpForNext = nextLevel.min - level.min;

  return (
    <div>
      <div className="xp-card" style={{ marginBottom: 16 }}>
        <div className="flex-between">
          <div>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>Nível atual</div>
            <div className="xp-level">{level.name}</div>
            <div style={{ fontSize: 16, opacity: 0.85, marginTop: 6 }}>{state.xp.toLocaleString()} XP • Streak: 🔥 {state.streak} dias</div>
          </div>
          <div style={{ fontSize: 60 }}>🏆</div>
        </div>
        <div className="xp-bar-wrap" style={{ marginTop: 20 }}>
          <div className="xp-bar" style={{ width: `${xpForNext > 0 ? Math.min(100, Math.round((xpProgress / xpForNext) * 100)) : 100}%` }} />
        </div>
        <div className="xp-label">
          <span>{level.name}</span>
          <span>{xpProgress.toLocaleString()} / {xpForNext.toLocaleString()} XP para {nextLevel.name}</span>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title">⭐ Níveis de Progresso</div>
          {XP_LEVELS.map(l => {
            const isCurrent = l.level === level.level;
            const isDone = state.xp >= l.min;
            return (
              <div key={l.level} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--gray-border)", opacity: isDone ? 1 : 0.45 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: l.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", fontWeight: 700, flexShrink: 0, border: isCurrent ? "3px solid #fff" : "none", boxShadow: isCurrent ? `0 0 0 3px ${l.color}` : "none" }}>
                  {l.level}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{l.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{l.min.toLocaleString()} XP {l.max !== Infinity ? `– ${(l.max + 1).toLocaleString()} XP` : "+"}</div>
                </div>
                {isCurrent && <span style={{ fontSize: 11, fontWeight: 700, color: l.color, background: `${l.color}20`, padding: "2px 8px", borderRadius: 99 }}>ATUAL</span>}
                {isDone && !isCurrent && <span style={{ fontSize: 16 }}>✅</span>}
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="section-title">🏅 Conquistas</div>
          <div className="achievement-grid">
            {BADGES.map(b => {
              const earned = state.earnedBadges.includes(b.id) || b.check(state);
              return (
                <div key={b.id} className={`achievement ${earned ? "earned" : "locked"}`} title={b.desc}>
                  <div className="achievement-icon">{b.icon}</div>
                  <div className="achievement-name">{b.name}</div>
                  {earned && <div style={{ fontSize: 10, color: "var(--blue)", marginTop: 2, fontWeight: 700 }}>✅</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="section-title">⚡ Como ganhar XP</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {[
            ["Registrar estudo", "+50 XP"],
            ["Streak diário", "+25 XP/dia"],
            ["Simulado < 60%", "+200 XP"],
            ["Simulado 60–70%", "+300 XP"],
            ["Simulado ≥ 70%", "+500 XP"],
            ["Simulado ≥ 80%", "+800 XP"],
            ["Completar revisão", "+30 XP"],
            ["100 questões", "+200 XP bônus"],
            ["500 questões", "+600 XP bônus"],
            ["50h estudadas", "+300 XP bônus"],
          ].map(([a, v]) => (
            <div key={a} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--gray-light)", borderRadius: 8, fontSize: 13 }}>
              <span>{a}</span>
              <span style={{ fontWeight: 700, color: "var(--blue)" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── CALENDÁRIO ───────────────────────────────────────────────────────────────
function Calendario({ state }) {
  const [current, setCurrent] = useState(new Date());
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const studiedDays = new Set(state.sessions.map(s => {
    const d = new Date(s.date);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }));

  const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push({ day: null, otherMonth: true });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${month}-${d}`;
    const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
    const studied = studiedDays.has(key);
    days.push({ day: d, isToday, studied });
  }

  return (
    <div>
      <div className="grid-2">
        <div className="card">
          <div className="flex-between mb-4">
            <div className="section-title" style={{ margin: 0 }}>📅 {monthNames[month]} {year}</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setCurrent(new Date(year, month - 1))}>&lsaquo;</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setCurrent(new Date())}>Hoje</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setCurrent(new Date(year, month + 1))}>&rsaquo;</button>
            </div>
          </div>
          <div className="cal-header">
            {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d => <div key={d} className="cal-hday">{d}</div>)}
          </div>
          <div className="calendar-grid">
            {days.map((d, i) => (
              <div key={i} className={`cal-day ${d.day ? d.studied ? "studied" : d.isToday ? "today" : "empty" : "other-month"}`}>
                {d.day || ""}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            {[["studied", "var(--green)", "Estudou"], ["today", "var(--blue)", "Hoje"], ["empty", "var(--text-3)", "Sem estudo"]].map(([cls, c, label]) => (
              <div key={cls} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
                <span style={{ color: "var(--text-3)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="card mb-4">
            <div className="card-title">📊 Resumo do Mês</div>
            {(() => {
              const monthSessions = state.sessions.filter(s => {
                const d = new Date(s.date);
                return d.getMonth() === month && d.getFullYear() === year;
              });
              const hrs = monthSessions.reduce((a, b) => a + (b.hours || 0), 0);
              const qs = monthSessions.reduce((a, b) => a + (b.questions || 0), 0);
              const days = new Set(monthSessions.map(s => new Date(s.date).getDate())).size;
              return (
                <div className="grid-3 gap-2">
                  <div style={{ textAlign: "center", padding: "10px 4px" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--blue)" }}>{hrs.toFixed(1)}h</div>
                    <div className="text-muted">horas</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "10px 4px" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green)" }}>{qs}</div>
                    <div className="text-muted">questões</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "10px 4px" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--orange)" }}>{days}</div>
                    <div className="text-muted">dias estudados</div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="card">
            <div className="card-title">🔄 Próximas Revisões</div>
            {(state.reviews || []).filter(r => {
              if (!r.nextDate) return false;
              const d = new Date(r.nextDate);
              return d.getMonth() === month && d.getFullYear() === year && d >= today;
            }).sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate)).slice(0, 8).map(r => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--gray-border)", fontSize: 13 }}>
                <span style={{ width: 28, height: 28, background: "var(--blue-light)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--blue)", flexShrink: 0 }}>
                  {new Date(r.nextDate).getDate()}
                </span>
                <span style={{ flex: 1, color: "var(--text-2)" }}>{getDisciplineIcon(r.discipline)} {r.subject?.slice(0, 30) || getDisciplineName(r.discipline)}</span>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>D+{r.offset}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EDITAL ───────────────────────────────────────────────────────────────────
function Edital() {
  return (
    <div>
      <div className="card mb-4" style={{ background: "var(--navy)", borderColor: "var(--navy)" }}>
        <div style={{ color: "#fff" }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>📋 Edital PMDF — Concurso Público Nº 04/2023</div>
          <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.6 }}>
            Cargo: Soldado Policial Militar (QPPMC)  •  Banca: Instituto AOCP  •  Vagas: 700 + 1.400 CR<br />
            Provas: 80 questões objetivas (40 básico + 40 específico) + Redação  •  Mínimo: 60% = 48 pontos<br />
            <strong>⚠️ Prorrogado até 02/08/2028</strong> — Novo edital previsto a partir de 2027 com banca Cebraspe
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">📚 Distribuição Completa de Disciplinas</div>
        <table className="disc-table">
          <thead>
            <tr>
              <th>Disciplina</th>
              <th>Bloco</th>
              <th>Questões</th>
              <th>Peso %</th>
              <th>Prioridade</th>
              <th>Dificuldade</th>
              <th>Horas recomendadas</th>
              <th>Tópicos mais cobrados</th>
            </tr>
          </thead>
          <tbody>
            {[
              { ...DISCIPLINES[0], diff: "★★★☆☆", hot: "Interpretação de texto (50% das questões), coesão, gramática" },
              { ...DISCIPLINES[1], diff: "★★☆☆☆", hot: "Reading comprehension (50%), vocabulary" },
              { ...DISCIPLINES[2], diff: "★★★★☆", hot: "Porcentagem, proporção, lógica proposicional" },
              { ...DISCIPLINES[3], diff: "★★☆☆☆", hot: "Windows, Office, Internet, segurança digital" },
              { ...DISCIPLINES[4], diff: "★★☆☆☆", hot: "Segurança pública DF, política nacional" },
              { ...DISCIPLINES[5], diff: "★★★☆☆", hot: "LODF (50% das questões), Estatuto PM, Regulamento Disciplinar" },
              { ...DISCIPLINES[6], diff: "★★★☆☆", hot: "Direitos fundamentais Art.5º, segurança pública Art.144, defesa do Estado" },
              { ...DISCIPLINES[7], diff: "★★★☆☆", hot: "Atos adm., poder de polícia, princípios" },
              { ...DISCIPLINES[8], diff: "★★★★☆", hot: "Teoria do crime, crimes contra vida/patrimônio/Adm. Pública" },
              { ...DISCIPLINES[9], diff: "★★★☆☆", hot: "Lei de Drogas 11.343/06, ECA, Maria da Penha, Desarmamento" },
              { ...DISCIPLINES[10], diff: "★★★★☆", hot: "Inquérito policial, prisões, interceptação telefônica Lei 9.296/96" },
              { ...DISCIPLINES[11], diff: "★★★★☆", hot: "Crimes militares em espécie (80% das questões 2023)" },
              { ...DISCIPLINES[12], diff: "★★★☆☆", hot: "CPPM, inquérito policial militar, prisão militar" },
              { ...DISCIPLINES[13], diff: "★★☆☆☆", hot: "Teorias criminológicas, vitimologia, prevenção criminal" },
            ].map(d => (
              <tr key={d.id}>
                <td><div className="disc-name">{d.icon} {d.name}</div></td>
                <td><BadgePill type={d.block === "Básico" ? "basico" : "especifico"} /></td>
                <td style={{ fontWeight: 700, textAlign: "center" }}>{d.q}</td>
                <td style={{ textAlign: "center" }}>{((d.q / 80) * 100).toFixed(1)}%</td>
                <td><BadgePill type={d.priority} /></td>
                <td style={{ fontSize: 12, letterSpacing: 1 }}>{d.diff}</td>
                <td style={{ textAlign: "center", fontWeight: 600, color: "var(--blue)" }}>{d.hours}h</td>
                <td style={{ fontSize: 12, color: "var(--text-3)" }}>{d.hot}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, background: "var(--blue-mid)" }}>
              <td colSpan={2}><strong>TOTAL</strong></td>
              <td style={{ textAlign: "center" }}><strong>80</strong></td>
              <td style={{ textAlign: "center" }}><strong>100%</strong></td>
              <td colSpan={2}></td>
              <td style={{ textAlign: "center", color: "var(--blue)" }}><strong>590h</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid-2 mt-4">
        <div className="card">
          <div className="section-title">🎯 Estratégia de Aprovação</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.8, color: "var(--text-2)" }}>
            {[
              "✅ Mínimo geral: 60% = 48 pts (ajustado 46,2 pela Dec. 2970/2023)",
              "🔴 LODF responde por ~50% das questões específicas — prioridade máxima",
              "🔴 Crimes militares = 80% do conteúdo de Dir. Penal Militar cobrado em 2023",
              "📝 Redação: tema proposto com texto; nota zero = eliminação imediata",
              "💡 Não há nota de corte por disciplina — maximize o total",
              "⚡ Interpretação de texto = 50% das questões de Português — treine leitura rápida",
            ].map((t, i) => <div key={i} style={{ marginBottom: 8 }}>{t}</div>)}
          </div>
        </div>
        <div className="card">
          <div className="section-title">📌 Próximo Edital (2026/2027)</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.8, color: "var(--text-2)" }}>
            {[
              "🏦 Banca confirmada: Cebraspe (ex-Cespe/UnB)",
              "📝 Formato Cebraspe: questões Certo/Errado",
              "⚠️ Penalização: 1 errada anula 1 certa",
              "📖 Enunciados longos e contextualizados",
              "📊 Interpretação textual intensa",
              "🎯 Validade atual prorrogada até 02/08/2028",
            ].map((t, i) => <div key={i} style={{ marginBottom: 8 }}>{t}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── IA COACH ─────────────────────────────────────────────────────────────────
function IACoach({ state, dispatch }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  const quickPrompts = [
    "Analise meu desempenho e identifique meus pontos fracos",
    "Crie um plano de estudos para esta semana com base nos meus dados",
    "Quais matérias devo revisar com urgência?",
    "Gere um mini simulado de 10 questões de Direito Constitucional",
    "Estou com dificuldades em Direito Penal. Como estudar?",
    "Meu streak caiu. Como me motivar?",
  ];

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [state.aiMessages]);

  const sendMessage = async (msg) => {
    if (!msg.trim() || loading) return;
    const userMsg = { role: "user", text: msg, id: Date.now() };
    dispatch({ type: "ADD_AI_MSG", msg: userMsg });
    setInput("");
    setLoading(true);
    const reply = await generateAIInsight(state, msg);
    dispatch({ type: "ADD_AI_MSG", msg: { role: "ai", text: reply, id: Date.now() + 1 } });
    setLoading(false);
  };

  return (
    <div>
      <div className="grid-2">
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="section-title">🤖 PMDF Coach — IA de Estudos</div>
          <div className="chat-wrap">
            <div className="chat-messages" ref={chatRef}>
              {state.aiMessages.length === 0 && (
                <div className="chat-msg ai">
                  <div className="chat-avatar">🤖</div>
                  <div className="chat-bubble">
                    Olá! Sou seu PMDF Coach powered by Claude AI. 🎯<br /><br />
                    Posso analisar seu desempenho, identificar pontos fracos e fortes, sugerir revisões, criar planos de estudo personalizados e muito mais.<br /><br />
                    Como posso te ajudar hoje?
                  </div>
                </div>
              )}
              {state.aiMessages.map(m => (
                <div key={m.id} className={`chat-msg ${m.role}`}>
                  <div className="chat-avatar">{m.role === "ai" ? "🤖" : "👤"}</div>
                  <div className={`chat-bubble ${loading && m === state.aiMessages[state.aiMessages.length - 1] ? "chat-loading" : ""}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="chat-msg ai">
                  <div className="chat-avatar">🤖</div>
                  <div className="chat-bubble chat-loading">Analisando seus dados... ⏳</div>
                </div>
              )}
            </div>
            <div className="chat-input-row">
              <input className="chat-input" placeholder="Pergunte algo ao seu coach..." value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)} />
              <button className="btn btn-primary" onClick={() => sendMessage(input)} disabled={loading}>
                {loading ? "⏳" : "→"}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-title">⚡ Ações Rápidas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {quickPrompts.map((p, i) => (
              <button key={i} className="btn btn-ghost btn-full"
                style={{ justifyContent: "flex-start", textAlign: "left", fontSize: 13, padding: "10px 14px" }}
                onClick={() => sendMessage(p)}>
                💬 {p}
              </button>
            ))}
          </div>
          <div className="divider" />
          <div className="text-muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
            🔒 Seus dados são enviados apenas ao processar cada mensagem para análise personalizada. A IA usa Claude (Anthropic) como motor de análise.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DOCUMENTAÇÃO ─────────────────────────────────────────────────────────────
function Docs() {
  return (
    <div>
      <div className="card mb-4" style={{ background: "var(--navy)", borderColor: "var(--navy)" }}>
        <div style={{ color: "#fff" }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>🚀 Guia de Deploy — Next.js + Supabase + Vercel</div>
          <div style={{ fontSize: 13, opacity: 0.8 }}>Código-fonte completo abaixo. Copie e cole para criar seu app em produção.</div>
        </div>
      </div>

      {[
        {
          title: "1. Estrutura do Banco de Dados (Supabase / PostgreSQL)",
          code: `-- Usuários (via Supabase Auth)
-- Tabela de sessões de estudo
CREATE TABLE study_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  discipline_id TEXT NOT NULL,
  subject TEXT,
  block TEXT DEFAULT 'Teoria',
  hours DECIMAL(4,2) NOT NULL DEFAULT 0,
  questions INTEGER DEFAULT 0,
  correct INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Simulados
CREATE TABLE simulados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT DEFAULT 'Completo',
  total_questions INTEGER DEFAULT 80,
  correct INTEGER NOT NULL,
  percent INTEGER,
  time_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Revisões espaçadas
CREATE TABLE spaced_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES study_sessions(id),
  discipline_id TEXT NOT NULL,
  subject TEXT,
  study_date DATE NOT NULL,
  offset_days INTEGER NOT NULL,
  next_date DATE NOT NULL,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Perfil do usuário (XP, streak, badges)
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  xp INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_study_date DATE,
  total_hours DECIMAL(8,2) DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  prova_date DATE,
  earned_badges TEXT[] DEFAULT '{}',
  weekly_goal_hours INTEGER DEFAULT 27,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulados ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaced_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own data" ON study_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON simulados FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON spaced_reviews FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own profile" ON user_profiles FOR ALL USING (auth.uid() = id);

-- Índices
CREATE INDEX idx_sessions_user_date ON study_sessions(user_id, date);
CREATE INDEX idx_sessions_discipline ON study_sessions(user_id, discipline_id);
CREATE INDEX idx_reviews_next_date ON spaced_reviews(user_id, next_date);`
        },
        {
          title: "2. Arquitetura Next.js + TypeScript",
          code: `pmdf-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout com providers
│   │   ├── page.tsx            # Redirect to /dashboard
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   └── (app)/
│   │       ├── dashboard/page.tsx
│   │       ├── estudos/page.tsx
│   │       ├── simulados/page.tsx
│   │       ├── cronograma/page.tsx
│   │       ├── revisoes/page.tsx
│   │       ├── gamificacao/page.tsx
│   │       ├── calendario/page.tsx
│   │       ├── ia/page.tsx
│   │       └── edital/page.tsx
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── PageHeader.tsx
│   │   ├── dashboard/
│   │   │   ├── KPIGrid.tsx
│   │   │   ├── ProgressChart.tsx
│   │   │   └── PerformanceTable.tsx
│   │   ├── shared/
│   │   │   ├── BadgePill.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── EmptyState.tsx
│   │   └── ai/
│   │       └── AICoach.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   ├── queries/
│   │   │   ├── sessions.ts
│   │   │   ├── simulados.ts
│   │   │   ├── reviews.ts
│   │   │   └── profiles.ts
│   │   └── utils/
│   │       ├── xp.ts
│   │       ├── reviews.ts
│   │       └── analytics.ts
│   ├── hooks/
│   │   ├── useStudySessions.ts
│   │   ├── useSimulados.ts
│   │   ├── useReviews.ts
│   │   └── useGamification.ts
│   └── types/
│       └── index.ts
├── public/
├── .env.local
├── next.config.js
├── tailwind.config.js
└── package.json`
        },
        {
          title: "3. package.json — Dependências",
          code: `{
  "name": "pmdf-plataforma-estudos",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "@supabase/supabase-js": "^2.43.0",
    "@supabase/ssr": "^0.3.0",
    "tailwindcss": "^3.4.0",
    "@shadcn/ui": "latest",
    "lucide-react": "^0.383.0",
    "recharts": "^2.12.0",
    "date-fns": "^3.6.0",
    "zod": "^3.23.0",
    "react-hook-form": "^7.51.0",
    "@hookform/resolvers": "^3.4.0",
    "sonner": "^1.4.0",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.0"
  }
}`
        },
        {
          title: "4. .env.local — Variáveis de Ambiente",
          code: `# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui

# Anthropic (para IA Coach)
ANTHROPIC_API_KEY=sk-ant-sua-chave-aqui

# App
NEXT_PUBLIC_APP_URL=https://pmdf.vercel.app`
        },
        {
          title: "5. Instruções para rodar localmente",
          code: `# 1. Clone / crie o projeto
npx create-next-app@latest pmdf-app --typescript --tailwind --app
cd pmdf-app

# 2. Instale dependências
npm install @supabase/supabase-js @supabase/ssr
npm install lucide-react recharts date-fns zod react-hook-form sonner
npm install jspdf jspdf-autotable

# 3. Instale e configure shadcn/ui
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card badge input select table
npx shadcn-ui@latest add dialog tabs progress toast

# 4. Configure Supabase
# Crie projeto em https://supabase.com
# Execute o SQL da etapa 1 no SQL Editor
# Copie URL e ANON_KEY para .env.local

# 5. Configure variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas chaves

# 6. Rode o projeto
npm run dev
# Acesse http://localhost:3000`
        },
        {
          title: "6. Deploy no Vercel",
          code: `# Opção A — Via CLI (recomendado)
npm install -g vercel
vercel login
vercel --prod

# Opção B — Via GitHub (mais fácil)
# 1. Suba o código para um repositório GitHub
git init && git add . && git commit -m "initial"
git remote add origin https://github.com/seu-usuario/pmdf-app
git push -u origin main

# 2. Acesse https://vercel.com/new
# 3. Importe o repositório GitHub
# 4. Configure as variáveis de ambiente:
#    NEXT_PUBLIC_SUPABASE_URL
#    NEXT_PUBLIC_SUPABASE_ANON_KEY
#    ANTHROPIC_API_KEY
# 5. Clique em Deploy

# O Vercel detecta Next.js automaticamente.
# Deploy automático a cada push na branch main.
# URL final: https://pmdf-app.vercel.app`
        },
        {
          title: "7. API Route — IA Coach (/api/ai/route.ts)",
          code: `import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { message, userData } = await req.json();

  const systemPrompt = \`Você é o PMDF Coach, especialista em aprovação no concurso 
  da Polícia Militar do Distrito Federal. Analise os dados do candidato e forneça 
  orientações específicas, motivadoras e práticas.
  
  Dados do candidato:
  - Horas estudadas: \${userData.totalHours}h
  - Streak: \${userData.streak} dias
  - Questões resolvidas: \${userData.totalQuestions}
  - Média simulados: \${userData.simAvg}%
  - Dias até a prova: \${userData.daysLeft}
  - Desempenho por disciplina: \${JSON.stringify(userData.performance)}\`;

  const message_response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  });

  return NextResponse.json({ 
    reply: message_response.content[0].type === 'text' 
      ? message_response.content[0].text 
      : '' 
  });
}`
        },
        {
          title: "8. Sugestões Futuras de Melhorias",
          code: `✅ IMPLEMENTADO NO APP ATUAL:
  • Dashboard com KPIs em tempo real
  • Controle de estudos diário
  • Sistema de simulados com evolução
  • Revisão espaçada automática (D+1 a D+90)
  • Gamificação (XP, níveis, badges)
  • Calendário visual de estudos
  • IA Coach personalizada (Claude API)
  • Cronogramas de 3, 6 e 12 meses
  • Análise completa do Edital PMDF 2023
  • Tema claro/escuro

🚀 PRÓXIMAS MELHORIAS SUGERIDAS:
  1. Geração de PDF automático de relatórios semanais/mensais
  2. Notificações push (Service Worker / FCM) para revisões
  3. Banco de questões integrado com filtro por assunto e banca
  4. Simulado interativo (responder questões diretamente no app)
  5. Compartilhamento de progresso em redes sociais
  6. App mobile React Native (iOS/Android)
  7. Modo offline com IndexedDB + sync
  8. Análise de redações com IA
  9. Comunidade (grupos de estudo, ranking)
  10. Integração com YouTube/PDF para playlist de aulas
  11. Cronograma adaptativo com ML baseado em padrões históricos
  12. Notificações de Whatsapp via Twilio/Z-API`
        }
      ].map((block, i) => (
        <div key={i} className="card mt-4">
          <div className="section-title" style={{ fontSize: 14 }}>{block.title}</div>
          <div style={{
            background: "var(--gray-light)", borderRadius: 8, padding: "14px 16px",
            fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 12,
            lineHeight: 1.6, color: "var(--text-2)", overflow: "auto",
            maxHeight: 400, whiteSpace: "pre", border: "1px solid var(--gray-border)"
          }}>
            {block.code}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const OFFSETS = [1, 7, 15, 30, 60, 90];

function reducer(state, action) {
  switch (action.type) {
    case "SET_TAB": return { ...state, activeTab: action.tab };
    case "TOGGLE_DARK": return { ...state, darkMode: !state.darkMode };
    case "SET_PROVA_DATE": return { ...state, provaDate: action.date };
    case "SET_TOAST": return { ...state, toast: action.msg };
    case "ADD_AI_MSG": return { ...state, aiMessages: [...(state.aiMessages || []), action.msg] };
    case "ADD_SESSION": {
      const s = action.session;
      const newSessions = [...state.sessions, s];
      // Calculate XP
      let xpGain = 50;
      if (s.questions > 0) xpGain += Math.floor(s.questions * 0.5);
      // Streak
      const lastDate = state.lastStudyDate;
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      let streak = state.streak;
      if (!lastDate || new Date(lastDate).toDateString() !== today) {
        streak = lastDate && new Date(lastDate).toDateString() === yesterday ? streak + 1 : 1;
        xpGain += 25;
      }
      // Generate reviews
      const reviews = [...(state.reviews || [])];
      OFFSETS.forEach(offset => {
        const nextDate = new Date(s.date);
        nextDate.setDate(nextDate.getDate() + offset);
        reviews.push({ id: `${s.id}-${offset}`, discipline: s.discipline, subject: s.subject, offset, nextDate: nextDate.toISOString().split("T")[0], sessionId: s.id });
      });
      return {
        ...state,
        sessions: newSessions,
        reviews,
        xp: state.xp + xpGain,
        streak,
        lastStudyDate: new Date().toISOString(),
        totalHours: state.totalHours + (s.hours || 0),
        totalQuestions: state.totalQuestions + (s.questions || 0),
      };
    }
    case "ADD_SIMULADO": {
      const sim = action.simulado;
      const xpGain = sim.percent >= 80 ? 800 : sim.percent >= 70 ? 500 : sim.percent >= 60 ? 300 : 200;
      return { ...state, simulados: [...state.simulados, sim], xp: state.xp + xpGain };
    }
    default: return state;
  }
}

const NAV = [
  { id: "dashboard",   icon: "🏠", label: "Dashboard" },
  { id: "edital",      icon: "📋", label: "Edital PMDF" },
  { id: "cronograma",  icon: "🗓️", label: "Cronograma" },
  { id: "estudos",     icon: "📝", label: "Estudos" },
  { id: "simulados",   icon: "🏆", label: "Simulados" },
  { id: "revisoes",    icon: "🔄", label: "Revisões" },
  { id: "gamificacao", icon: "🎮", label: "Gamificação" },
  { id: "calendario",  icon: "📅", label: "Calendário" },
  { id: "ia",          icon: "🤖", label: "IA Coach" },
  { id: "docs",        icon: "🚀", label: "Deploy/Docs" },
];

export default function App() {
  const [state, dispatch] = useState(() => {
    const saved = load();
    return saved ? { ...defaultState(), ...saved } : defaultState();
  });

  const [toast, setToast] = useState("");

  // Use reducer manually
  const dispatchFn = useCallback((action) => {
    if (action.type === "SET_TOAST") { setToast(action.msg); return; }
    setState(prev => {
      const next = reducer(prev, action);
      save(next);
      return next;
    });
  }, []);

  const toastFn = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3200); };

  const pageProps = { state, dispatch: dispatchFn, toast: toastFn };

  const pages = {
    dashboard: <Dashboard {...pageProps} />,
    edital: <Edital />,
    cronograma: <Cronograma {...pageProps} />,
    estudos: <Estudos {...pageProps} />,
    simulados: <Simulados {...pageProps} />,
    revisoes: <Revisoes {...pageProps} />,
    gamificacao: <Gamificacao {...pageProps} />,
    calendario: <Calendario {...pageProps} />,
    ia: <IACoach {...pageProps} />,
    docs: <Docs />,
  };

  const pageTitles = {
    dashboard: ["🏠 Dashboard", "Visão geral do seu progresso"],
    edital: ["📋 Edital PMDF 2023", "Análise completa de disciplinas e prioridades"],
    cronograma: ["🗓️ Cronograma Inteligente", "Planos de 3, 6 e 12 meses"],
    estudos: ["📝 Controle de Estudos", "Registre e acompanhe seus estudos diários"],
    simulados: ["🏆 Simulados", "Registro e evolução nos simulados"],
    revisoes: ["🔄 Revisão Espaçada", "D+1 | D+7 | D+15 | D+30 | D+60 | D+90"],
    gamificacao: ["🎮 Gamificação", "XP, níveis, badges e conquistas"],
    calendario: ["📅 Calendário", "Visualização mensal de estudos e revisões"],
    ia: ["🤖 PMDF Coach IA", "Assistente inteligente powered by Claude"],
    docs: ["🚀 Código-Fonte & Deploy", "Next.js + Supabase + Vercel — pronto para produção"],
  };

  const [title, sub] = pageTitles[state.activeTab] || ["", ""];

  return (
    <>
      <style>{css}</style>
      <div className="app" data-dark={state.darkMode}>
        {/* Sidebar */}
        <nav className="sidebar">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">🎯</div>
            <div>
              <div className="sidebar-logo-text">PMDF</div>
              <div className="sidebar-logo-sub">Plataforma de Estudos</div>
            </div>
          </div>
          <div className="sidebar-nav">
            <div className="nav-label">Principal</div>
            {NAV.slice(0, 3).map(n => (
              <button key={n.id} className={`nav-item ${state.activeTab === n.id ? "active" : ""}`}
                onClick={() => dispatchFn({ type: "SET_TAB", tab: n.id })}>
                <span className="nav-icon">{n.icon}</span>
                <span>{n.label}</span>
              </button>
            ))}
            <div className="nav-label">Registro</div>
            {NAV.slice(3, 6).map(n => (
              <button key={n.id} className={`nav-item ${state.activeTab === n.id ? "active" : ""}`}
                onClick={() => dispatchFn({ type: "SET_TAB", tab: n.id })}>
                <span className="nav-icon">{n.icon}</span>
                <span>{n.label}</span>
              </button>
            ))}
            <div className="nav-label">Ferramentas</div>
            {NAV.slice(6).map(n => (
              <button key={n.id} className={`nav-item ${state.activeTab === n.id ? "active" : ""}`}
                onClick={() => dispatchFn({ type: "SET_TAB", tab: n.id })}>
                <span className="nav-icon">{n.icon}</span>
                <span>{n.label}</span>
              </button>
            ))}
          </div>
          <div className="sidebar-footer">
            <div style={{ padding: "4px 10px", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                🔥 Streak: {state.streak}d  •  ⭐ {state.xp.toLocaleString()} XP
              </div>
            </div>
            <button className="theme-toggle" onClick={() => dispatchFn({ type: "TOGGLE_DARK" })}>
              <span>{state.darkMode ? "☀️" : "🌙"}</span>
              <span>{state.darkMode ? "Tema Claro" : "Tema Escuro"}</span>
            </button>
          </div>
        </nav>

        {/* Main content */}
        <main className="main">
          <div className="page-header">
            <div>
              <div className="page-title">{title}</div>
              <div className="page-sub">{sub}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
              <div style={{ fontSize: 12, color: "var(--text-3)", textAlign: "right" }}>
                <div style={{ fontWeight: 600, color: "var(--text-2)" }}>{calcXPLevel(state.xp).name}</div>
                <div>{state.xp.toLocaleString()} XP</div>
              </div>
            </div>
          </div>
          <div className="page-content">
            {pages[state.activeTab] || pages.dashboard}
          </div>
        </main>

        {toast && <Toast msg={toast} onDone={() => setToast("")} />}
      </div>
    </>
  );
}
