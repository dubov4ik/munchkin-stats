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
      else {
        const initial = ["Єгор", "Женя", "Влад", "Влада", "Таня", "Аня", "Артем", "Боря", "Ліза", "Наташа", "Максим"];
        set(ref(db, 'player_list'), initial);
      }
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
    bg: darkMode ? '#1a1a1a' : '#f8f9fd',
    card: darkMode ? '#2d2d2d' : 'white',
    text: darkMode ? '#ffffff' : '#2d3436',
    subText: darkMode ? '#a0a0a0' : '#636e72',
    border: darkMode ? '#444' : '#eee',
    tableHead: darkMode ? '#000000' : '#2d3436',
    backBtn: darkMode ? '#444' : '#e1e4e8'
  };

  const calculateStats = () => {
    const statsMap = {};
    playerList.forEach(name => { statsMap[name] = { name, matches: 0, wins: 0 }; });
    history.forEach(game => {
      if (game.isArchive) {
        Object.entries(game.matchesCount || {}).forEach(([name, count]) => { if (statsMap[name]) statsMap[name].matches += count; });
        game.winner.split(', ').forEach(w => { const n = w.trim(); if (statsMap[n]) statsMap[n].wins += 1; });
      } else {
        const parts = game.participants?.split(', ') || [], winsArr = game.winner?.split(', ') || [];
        parts.forEach(p => { if (statsMap[p]) { statsMap[p].matches += 1; if (winsArr.includes(p)) statsMap[p].wins += 1; } });
      }
    });
    return Object.values(statsMap).map(p => ({ ...p, rate: p.matches > 0 ? Math.round((p.wins / p.matches) * 100) : 0 })).sort((a, b) => b.wins - a.wins || b.rate - a.rate);
  };

  const currentStats = calculateStats();
  const getLeaders = (f) => {
    const active = currentStats.filter(p => p.matches > 0);
    if (!active.length) return { names: "—", value: 0 };
    const maxVal = Math.max(...active.map(p => p[f]));
    return { names: active.filter(p => p[f] === maxVal).map(p => p.name).join(', '), value: f === 'rate' ? maxVal + "%" : maxVal };
  };

  const podium = { matches: getLeaders('matches'), wins: getLeaders('wins'), rate: getLeaders('rate') };

  const finalReset = (winnersList = []) => {
    if (winnersList.length > 0) {
      push(ref(db, 'games_history'), {
        date: new Date().toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        winner: winnersList.join(', '),
        participants: Object.values(lobbyPlayers).map(p => p.name).join(', ')
      });
    }
    set(ref(db, 'current_game'), { status: 'main', players: {}, targetScore: 10 });
    setWinners([]); setScreen('main');
  };

  const CustomBackButton = ({ onClick, text = "Назад" }) => (
    <button onClick={onClick} style={{
      marginTop: '20px', width: '100%', padding: '14px', borderRadius: '12px',
      background: theme.backBtn, color: theme.text, fontWeight: 'bold', border: 'none',
      cursor: 'pointer', fontSize: '14px', boxSizing: 'border-box'
    }}>{text}</button>
  );

  if (screen === 'main') return (
    <div className="container" style={{background: theme.bg, minHeight: '100vh', padding: '20px 15px', transition: '0.3s'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px'}}>
        <h1 style={{fontSize: '26px', color: theme.text, fontWeight: '800', margin: 0}}>🏆 Munchkin Stats</h1>
        <button onClick={() => setDarkMode(!darkMode)} style={{background: theme.card, border: `1px solid ${theme.border}`, borderRadius: '50%', width: '40px', height: '40px', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
      
      {/* П'єдестал тепер БЕЗ фонового кольору навколо, щоб не було білого квадрата */}
      <div className="podium-container" style={{display: 'grid', gridTemplateColumns: '1fr 1.1fr 1fr', gap: '8px', marginBottom: '25px', background: 'transparent'}}>
        <div className="podium-item" style={{background: theme.card, borderRadius: '16px', padding: '12px 5px', border: `1px solid ${theme.border}`, boxSizing: 'border-box'}}>
          <div style={{fontSize: '10px', color: theme.subText, fontWeight: 'bold'}}>🎮 МАТЧІ</div>
          <div style={{fontSize: '14px', fontWeight: '900', color: theme.text, margin: '4px 0'}}>{podium.matches.names}</div>
          <div style={{fontSize: '16px', fontWeight: '900', color: '#ff7675'}}>{podium.matches.value}</div>
        </div>
        <div className="podium-item gold" style={{background: theme.card, borderRadius: '16px', padding: '12px 5px', border: '2px solid #fdcb6e', boxSizing: 'border-box'}}>
          <div style={{fontSize: '10px', color: theme.subText, fontWeight: 'bold'}}>👑 ПЕРЕМОГИ</div>
          <div style={{fontSize: '15px', fontWeight: '900', color: theme.text, margin: '4px 0'}}>{podium.wins.names}</div>
          <div style={{fontSize: '18px', fontWeight: '900', color: '#ff7675'}}>{podium.wins.value}</div>
        </div>
        <div className="podium-item" style={{background: theme.card, borderRadius: '16px', padding: '12px 5px', border: `1px solid ${theme.border}`, boxSizing: 'border-box'}}>
          <div style={{fontSize: '10px', color: theme.subText, fontWeight: 'bold'}}>📈 %</div>
          <div style={{fontSize: '14px', fontWeight: '900', color: theme.text, margin: '4px 0'}}>{podium.rate.names}</div>
          <div style={{fontSize: '16px', fontWeight: '900', color: '#ff7675'}}>{podium.rate.value}</div>
        </div>
      </div>

      <div className="stats-card" style={{background: theme.card, borderRadius: '20px', padding: '15px', border: `1px solid ${theme.border}`}}>
        <h3 style={{textAlign: 'left', marginBottom: '12px', fontSize: '16px', color: theme.text}}>📊 Рейтинг</h3>
        <table style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead><tr style={{color: theme.subText, fontSize: '11px', borderBottom: `1px solid ${theme.border}`}}>
            <th style={{textAlign: 'left', padding: '10px'}}>ГРАВЕЦЬ</th>
            <th style={{textAlign: 'center'}}>М</th>
            <th style={{textAlign: 'center'}}>🏆</th>
            <th style={{textAlign: 'center'}}>%</th>
          </tr></thead>
          <tbody>
            {currentStats.map((p, i) => (
              <tr key={i} style={{borderBottom: `1px solid ${theme.bg}`, opacity: p.matches === 0 ? 0.3 : 1}}>
                <td style={{padding: '12px 10px', fontWeight: '700', color: theme.text}}>{p.name}</td>
                <td style={{textAlign: 'center', color: theme.text}}>{p.matches}</td>
                <td style={{textAlign: 'center', fontWeight: '800', color: '#6c5ce7'}}>{p.wins}</td>
                <td style={{textAlign: 'center', color: theme.text}}>{p.rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{marginTop: '30px'}}>
        <h3 style={{textAlign: 'left', marginLeft: '5px', marginBottom: '10px', fontSize: '16px', color: theme.text}}>📜 Історія</h3>
        <div style={{background: theme.card, borderRadius: '20px', padding: '5px', border: `1px solid ${theme.border}`}}>
          {[...history].reverse().slice(0, 5).map((g) => (
            <div key={g.id} style={{display: 'flex', justifyContent: 'space-between', padding: '12px 15px', borderBottom: `1px solid ${theme.border}`}}>
              <div style={{textAlign: 'left'}}>
                <div style={{fontSize: '14px', fontWeight: 'bold', color: theme.text}}>{g.winner} 🏆</div>
                <div style={{fontSize: '11px', color: theme.subText}}>{g.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button className="start-btn" onClick={() => setScreen('select-role')} style={{
        marginTop: '25px', width: '100%', padding: '16px', borderRadius: '16px', 
        background: darkMode ? '#6c5ce7' : '#2d3436', color: 'white', fontWeight: 'bold', border: 'none'
      }}>Нова гра</button>
    </div>
  );

  if (screen === 'select-role') return (
    <div className="container" style={{background: theme.bg, minHeight: '100vh', padding: '20px', boxSizing: 'border-box'}}>
      <h2 style={{color: theme.text}}>Хто грає?</h2>
      <button className="role-btn admin" style={{marginBottom: '10px', border: '2px solid #ffd700', background: theme.card, color: theme.text, width: '100%', boxSizing: 'border-box'}} onClick={() => {
        if (!isAdmin) setScreen('admin-auth');
        else { update(ref(db, `current_game/players/Єгор`), { name: "Єгор", levels: { 0: 0 } }); setScreen('lobby'); }
      }}>👑 Єгор</button>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
        {playerList.filter(n => n !== "Єгор").map(n => (
          <button key={n} className="role-btn" onClick={() => { update(ref(db, `current_game/players/${n}`), { name: n, levels: { 0: 0 } }); setScreen('lobby'); }} style={{width: '100%', background: theme.card, color: theme.text, border: `1px solid ${theme.border}`, boxSizing: 'border-box', borderRadius: '12px', padding: '15px'}}>{n}</button>
        ))}
      </div>
      <CustomBackButton onClick={() => setScreen('main')} text="Назад до головної" />
    </div>
  );

  if (screen === 'admin-auth') return (
    <div className="container" style={{background: theme.bg, minHeight: '100vh', padding: '20px', boxSizing: 'border-box'}}>
      <h2 style={{color: theme.text}}>Вхід адміна</h2>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{background: theme.card, color: theme.text, border: `1px solid ${theme.border}`, width: '100%', padding: '15px', borderRadius: '12px', boxSizing: 'border-box'}} placeholder="Пароль" autoFocus />
      <button className="start-btn" onClick={() => { if(password === '2910') { setIsAdmin(true); setScreen('select-role'); } else alert('Невірно'); }} style={{width: '100%', marginTop: '10px', padding: '15px', borderRadius: '12px', background: '#6c5ce7', color: 'white', border: 'none'}}>Увійти</button>
      <CustomBackButton onClick={() => setScreen('select-role')} />
    </div>
  );

  if (screen === 'lobby') return (
    <div className="container" style={{background: theme.bg, minHeight: '100vh', padding: '20px', boxSizing: 'border-box'}}>
      <h2 style={{color: theme.text}}>🏠 Лобі гри</h2>
      <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px'}}>
        {Object.values(lobbyPlayers).map(p => (
          <div key={p.name} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme.card, color: theme.text, border: `1px solid ${theme.border}`, padding: '15px', borderRadius: '12px', boxSizing: 'border-box'}}>
            <span>✅ {p.name}</span>
            {isAdmin && <button onClick={() => remove(ref(db, `current_game/players/${p.name}`))} style={{background: '#ff7675', color: 'white', border: 'none', borderRadius: '50%', width: '25px', height: '25px'}}>✕</button>}
          </div>
        ))}
      </div>
      {isAdmin && <button className="start-btn" onClick={() => update(ref(db, 'current_game'), { status: 'active' })} style={{width: '100%', padding: '15px', borderRadius: '12px', background: '#fdcb6e', color: '#2d3436', fontWeight: 'bold', border: 'none'}}>🚀 Почати гру</button>}
      <CustomBackButton onClick={() => setScreen('select-role')} text="Назад до вибору" />
    </div>
  );

  if (screen === 'game') {
    const players = Object.values(lobbyPlayers), maxR = players.reduce((m, p) => Math.max(m, p.levels ? Object.keys(p.levels).length - 1 : 0), 0);
    return (
      <div className="container" style={{padding: '10px', background: theme.bg, minHeight: '100vh', boxSizing: 'border-box'}}>
        <h2 style={{color: theme.text}}>🎯 Ціль: {targetScore}</h2>
        <div style={{overflowX: 'auto', background: theme.card, borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)'}}>
          <table style={{width: '100%', borderCollapse: 'collapse', minWidth: '400px'}}>
            <thead><tr style={{background: theme.tableHead, color: 'white'}}><th style={{padding: '12px', textAlign: 'left'}}>Ім'я</th><th style={{padding: '12px'}}>LVL</th>{[...Array(maxR + 1)].map((_, i) => <th key={i}>К{i+1}</th>)}</tr></thead>
            <tbody>
              {players.map((p, idx) => {
                const total = Object.values(p.levels || {}).reduce((a, b) => a + b, 1);
                return (
                  <tr key={p.name} style={{borderBottom: `1px solid ${theme.border}`, background: idx % 2 === 0 ? theme.card : (darkMode ? '#333' : '#f9f9f9')}}>
                    <td style={{padding: '12px', fontWeight: 'bold', color: theme.text}}>{p.name}</td>
                    <td style={{padding: '12px', textAlign: 'center', fontSize: '24px', fontWeight: 'bold', color: theme.text}}>{total}</td>
                    {[...Array(maxR + 1)].map((_, i) => {
                      const val = parseInt(p.levels?.[i] || 0);
                      return (
                        <td key={i} style={{padding: '4px', textAlign: 'center'}}>
                          <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                            {isAdmin && <button onClick={() => update(ref(db, `current_game/players/${p.name}/levels`), {[i]: val + 1})} style={{background: '#55efc4', border: 'none', borderRadius: '4px'}}>+</button>}
                            <span style={{color: theme.text}}>{val}</span>
                            {isAdmin && <button onClick={() => update(ref(db, `current_game/players/${p.name}/levels`), {[i]: val - 1})} style={{background: '#fab1a0', border: 'none', borderRadius: '4px'}}>-</button>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {isAdmin && <button className="finish-btn" onClick={() => finalReset(winners)} style={{marginTop: '20px', width: '100%', padding: '15px', background: '#ff7675', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 'bold'}}>🏁 Завершити</button>}
      </div>
    );
  }

  return null;
}

export default App;