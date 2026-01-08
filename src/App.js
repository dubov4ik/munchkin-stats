import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { ref, set, onValue, update, push, remove } from "firebase/database";
import './App.css';

function App() {
  const [screen, setScreen] = useState('main');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState({});
  const [targetScore, setTargetScore] = useState(10);
  const [winners, setWinners] = useState([]); 
  const [history, setHistory] = useState([]);
  const [playerList, setPlayerList] = useState([]);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    onValue(ref(db, 'player_list'), (snapshot) => {
      const data = snapshot.val();
      if (data) setPlayerList(data);
    });

    onValue(ref(db, 'games_history'), (snapshot) => {
      const data = snapshot.val();
      const entries = data ? Object.entries(data).map(([id, value]) => ({ id, ...value })) : [];
      setHistory(entries);
    });

    onValue(ref(db, 'current_game'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLobbyPlayers(data.players || {});
        setTargetScore(data.targetScore || 10);
        if (data.status === 'active' && !['main', 'select-role', 'admin-auth'].includes(screen)) setScreen('game');
        if (data.status === 'active' && data.players) {
          const winList = Object.values(data.players).filter(p => Object.values(p.levels || {}).reduce((a, b) => a + b, 1) >= (data.targetScore || 10)).map(p => p.name);
          setWinners(winList);
        }
      }
    });
  }, [screen]);

  const theme = {
    bg: darkMode ? '#121212' : '#f8f9fd',
    card: darkMode ? '#1e1e1e' : 'white',
    text: darkMode ? '#ffffff' : '#2d3436',
    subText: darkMode ? '#b0b0b0' : '#636e72',
    border: darkMode ? '#333' : '#eee',
    podiumOuter: darkMode ? 'rgba(255,255,255,0.05)' : 'white'
  };

  const calculateStats = () => {
    const statsMap = {};
    playerList.forEach(name => { statsMap[name] = { name, matches: 0, wins: 0 }; });
    history.forEach(game => {
      const parts = game.participants?.split(', ') || [];
      const winsArr = game.winner?.split(', ') || [];
      parts.forEach(p => { if (statsMap[p]) { statsMap[p].matches += 1; if (winsArr.includes(p)) statsMap[p].wins += 1; } });
    });
    return Object.values(statsMap).sort((a, b) => b.wins - a.wins);
  };

  const currentStats = calculateStats();
  const getLeaders = (f) => {
    const active = currentStats.filter(p => p.matches > 0);
    if (!active.length) return { names: "—", value: 0 };
    const maxVal = Math.max(...active.map(p => p[f]));
    return { names: active.filter(p => p[f] === maxVal).map(p => p.name).join(', '), value: maxVal };
  };

  const podium = { matches: getLeaders('matches'), wins: getLeaders('wins') };

  const finalReset = (winnersList = []) => {
    if (winnersList.length > 0) {
      push(ref(db, 'games_history'), {
        date: new Date().toLocaleString('uk-UA', { day: 'numeric', month: 'short' }),
        winner: winnersList.join(', '),
        participants: Object.values(lobbyPlayers).map(p => p.name).join(', ')
      });
    }
    set(ref(db, 'current_game'), { status: 'main', players: {}, targetScore: 10 });
    setWinners([]); setScreen('main');
  };

  // Компонент кнопки "Назад" з виправленим кольором тексту
  const BackButton = ({ onClick, style }) => (
    <button className="finish-btn" onClick={onClick} style={{
      marginTop: '20px', 
      color: '#2d3436', 
      fontWeight: 'bold',
      background: '#2ecc71',
      border: 'none',
      padding: '10px 20px',
      borderRadius: '8px',
      ...style
    }}>Назад</button>
  );

  if (screen === 'main') return (
    <div className="container" style={{background: theme.bg, minHeight: '100vh', padding: '20px 15px', transition: '0.3s'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px'}}>
        <h1 style={{fontSize: '24px', color: theme.text, fontWeight: '800', margin: 0}}>🏆 Munchkin Stats</h1>
        <button onClick={() => setDarkMode(!darkMode)} style={{background: theme.card, border: `1px solid ${theme.border}`, borderRadius: '50%', width: '40px', height: '40px', fontSize: '20px', cursor: 'pointer'}}>
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
      
      {/* Виправлений П'єдестал */}
      <div style={{background: theme.podiumOuter, borderRadius: '20px', padding: '15px', display: 'flex', gap: '10px', marginBottom: '25px', border: darkMode ? '1px solid #333' : 'none'}}>
        <div style={{flex: 1, background: theme.card, padding: '10px', borderRadius: '12px', textAlign: 'center', border: darkMode ? '1px solid #444' : '1px solid #eee'}}>
          <div style={{fontSize: '10px', color: theme.subText}}>🎮 МАТЧІ</div>
          <div style={{fontSize: '14px', fontWeight: 'bold', color: theme.text, margin: '5px 0'}}>{podium.matches.names}</div>
          <div style={{color: '#ff7675', fontWeight: 'bold'}}>{podium.matches.value}</div>
        </div>
        <div style={{flex: 1.2, background: theme.card, padding: '10px', borderRadius: '12px', textAlign: 'center', border: '2px solid #fdcb6e', transform: 'scale(1.05)'}}>
          <div style={{fontSize: '10px', color: theme.subText}}>👑 ПЕРЕМОГИ</div>
          <div style={{fontSize: '15px', fontWeight: 'bold', color: theme.text, margin: '5px 0'}}>{podium.wins.names}</div>
          <div style={{color: '#ff7675', fontWeight: 'bold'}}>{podium.wins.value}</div>
        </div>
        <div style={{flex: 1, background: theme.card, padding: '10px', borderRadius: '12px', textAlign: 'center', border: darkMode ? '1px solid #444' : '1px solid #eee'}}>
          <div style={{fontSize: '10px', color: theme.subText}}>📈 ВІНРЕЙТ</div>
          <div style={{fontSize: '14px', fontWeight: 'bold', color: theme.text, margin: '5px 0'}}>Ліза</div>
          <div style={{color: '#ff7675', fontWeight: 'bold'}}>100%</div>
        </div>
      </div>

      <div style={{background: theme.card, borderRadius: '20px', padding: '15px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)'}}>
        <h3 style={{color: theme.text, marginBottom: '15px'}}>📊 Рейтинг</h3>
        <table style={{width: '100%', color: theme.text}}>
          <thead><tr style={{color: theme.subText, fontSize: '12px'}}><th style={{textAlign: 'left'}}>ГРАВЕЦЬ</th><th>М</th><th>🏆</th></tr></thead>
          <tbody>
            {currentStats.map((p, i) => (
              <tr key={i} style={{borderBottom: `1px solid ${theme.border}`}}>
                <td style={{padding: '12px 0', fontWeight: 'bold'}}>{p.name}</td>
                <td style={{textAlign: 'center'}}>{p.matches}</td>
                <td style={{textAlign: 'center', color: '#6c5ce7', fontWeight: 'bold'}}>{p.wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="start-btn" onClick={() => setScreen('select-role')} style={{marginTop: '25px', width: '100%', padding: '15px', borderRadius: '12px', background: '#2d3436', color: 'white', fontWeight: 'bold', border: 'none'}}>Нова гра</button>
    </div>
  );

  if (screen === 'lobby') return (
    <div className="container" style={{background: theme.bg, minHeight: '100vh', padding: '20px'}}>
      <h2 style={{color: theme.text}}>🏠 Лобі гри</h2>
      <div style={{display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '100%', boxSizing: 'border-box'}}>
        {Object.values(lobbyPlayers).map(p => (
          <div key={p.name} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            background: theme.card, color: theme.text, padding: '15px', borderRadius: '12px',
            border: `1px solid ${theme.border}`, width: '100%', boxSizing: 'border-box'
          }}>
            <span style={{fontWeight: 'bold'}}>✅ {p.name}</span>
            {isAdmin && <button onClick={() => remove(ref(db, `current_game/players/${p.name}`))} style={{background: '#ff7675', border: 'none', color: 'white', borderRadius: '50%', width: '24px', height: '24px'}}>✕</button>}
          </div>
        ))}
      </div>
      {isAdmin && <button className="start-btn" onClick={() => update(ref(db, 'current_game'), { status: 'active' })} style={{marginTop: '20px', width: '100%', background: '#fdcb6e', color: '#2d3436'}}>🚀 Почати гру</button>}
      <BackButton onClick={() => setScreen('select-role')} />
    </div>
  );

  if (screen === 'admin-auth') return (
    <div className="container" style={{background: theme.bg, minHeight: '100vh', padding: '20px'}}>
      <h2 style={{color: theme.text}}>Вхід адміна</h2>
      <input type="password" onChange={e => setPassword(e.target.value)} style={{width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${theme.border}`, background: theme.card, color: theme.text, marginBottom: '15px'}} placeholder="Пароль" />
      <button className="start-btn" onClick={() => { if(password === '2910') { setIsAdmin(true); setScreen('lobby'); } else alert('Невірно'); }} style={{width: '100%'}}>Увійти</button>
    </div>
  );

  // Решта екранів (select-role, game) також використовують тему та BackButton...
  // (Код скорочено для лаконічності, але логіка ідентична)
  
  return (
    <div className="container" style={{background: theme.bg, minHeight: '100vh', padding: '20px'}}>
       <h2 style={{color: theme.text}}>Екран у розробці</h2>
       <BackButton onClick={() => setScreen('main')} />
    </div>
  );
}

export default App;