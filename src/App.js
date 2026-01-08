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

  if (screen === 'main') return (
    <div className="container" style={{background: '#f8f9fd', minHeight: '100vh', padding: '20px 15px'}}>
      <h1 style={{fontSize: '26px', color: '#2d3436', marginBottom: '25px', fontWeight: '800'}}>🏆 Munchkin Stats</h1>
      
      <div className="podium-container" style={{display: 'grid', gridTemplateColumns: '1fr 1.1fr 1fr', gap: '8px', marginBottom: '25px'}}>
        <div className="podium-item" style={{background: 'white', borderRadius: '16px', padding: '12px 5px', border: '1px solid #eee'}}>
          <div style={{fontSize: '10px', color: '#636e72'}}>🎮 МАТЧІ</div>
          <div style={{fontSize: '14px', fontWeight: 'bold'}}>{podium.matches.names}</div>
          <div style={{fontSize: '16px', color: '#ff7675'}}>{podium.matches.value}</div>
        </div>
        <div className="podium-item gold" style={{background: 'white', borderRadius: '16px', padding: '12px 5px', border: '2px solid #fdcb6e'}}>
          <div style={{fontSize: '10px', color: '#636e72'}}>👑 ПЕРЕМОГИ</div>
          <div style={{fontSize: '15px', fontWeight: 'bold'}}>{podium.wins.names}</div>
          <div style={{fontSize: '18px', color: '#ff7675'}}>{podium.wins.value}</div>
        </div>
        <div className="podium-item" style={{background: 'white', borderRadius: '16px', padding: '12px 5px', border: '1px solid #eee'}}>
          <div style={{fontSize: '10px', color: '#636e72'}}>📈 ВІНРЕЙТ</div>
          <div style={{fontSize: '14px', fontWeight: 'bold'}}>Ліза</div>
          <div style={{fontSize: '16px', color: '#ff7675'}}>100%</div>
        </div>
      </div>

      <div className="stats-card" style={{background: 'white', borderRadius: '20px', padding: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.03)'}}>
        <h3 style={{marginBottom: '12px'}}>📊 Рейтинг</h3>
        <table style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead><tr style={{color: '#b2bec3', fontSize: '11px'}}><th style={{textAlign: 'left', padding: '10px'}}>ГРАВЕЦЬ</th><th>М</th><th>🏆</th></tr></thead>
          <tbody>
            {currentStats.map((p, i) => (
              <tr key={i} style={{borderBottom: '1px solid #f8f9fd'}}>
                <td style={{padding: '12px 10px', fontWeight: 'bold'}}>{p.name}</td>
                <td style={{textAlign: 'center'}}>{p.matches}</td>
                <td style={{textAlign: 'center', fontWeight: 'bold', color: '#6c5ce7'}}>{p.wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="start-btn" onClick={() => setScreen('select-role')} style={{marginTop: '25px', width: '100%', padding: '16px', borderRadius: '16px', background: '#2d3436', color: 'white', fontWeight: 'bold', border: 'none'}}>Нова гра</button>
    </div>
  );

  if (screen === 'select-role') return (
    <div className="container" style={{padding: '20px'}}>
      <h2>Хто грає?</h2>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
        {playerList.map(n => (
          <button key={n} className="role-btn" onClick={() => { update(ref(db, `current_game/players/${n}`), { name: n, levels: { 0: 0 } }); setScreen('lobby'); }} style={{padding: '15px', borderRadius: '12px', border: '1px solid #eee', background: 'white'}}>{n}</button>
        ))}
      </div>
      <button className="finish-btn" onClick={() => setScreen('main')} style={{marginTop: '20px'}}>Назад</button>
    </div>
  );

  if (screen === 'lobby') return (
    <div className="container" style={{padding: '20px'}}>
      <h2>🏠 Лобі гри</h2>
      {Object.values(lobbyPlayers).map(p => (
        <div key={p.name} style={{padding: '15px', background: '#f1f2f6', borderRadius: '12px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between'}}>
          <span>✅ {p.name}</span>
          {isAdmin && <button onClick={() => remove(ref(db, `current_game/players/${p.name}`))} style={{background: 'none', border: 'none', color: '#ff7675', fontWeight: 'bold'}}>✕</button>}
        </div>
      ))}
      <button className="start-btn" onClick={() => update(ref(db, 'current_game'), { status: 'active' })} style={{width: '100%', marginTop: '10px'}}>🚀 Почати гру</button>
      <button className="finish-btn" onClick={() => setScreen('select-role')} style={{marginTop: '10px'}}>Назад</button>
    </div>
  );

  if (screen === 'game') {
    const players = Object.values(lobbyPlayers), maxR = players.reduce((m, p) => Math.max(m, p.levels ? Object.keys(p.levels).length - 1 : 0), 0);
    return (
      <div className="container" style={{maxWidth: '100%', padding: '10px'}}>
        <h2>🎯 Ціль: {targetScore}</h2>
        <div className="table-wrapper" style={{overflowX: 'auto', background: 'white', borderRadius: '12px'}}>
          <table style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead style={{background: '#2d3436', color: 'white'}}>
              <tr><th style={{padding: '12px'}}>Ім'я</th><th>LVL</th>{[...Array(maxR + 1)].map((_, i) => <th key={i}>К{i+1}</th>)}</tr>
            </thead>
            <tbody>
              {players.map(p => {
                const total = Object.values(p.levels || {}).reduce((a, b) => a + b, 1);
                return (
                  <tr key={p.name} style={{borderBottom: '1px solid #eee'}}>
                    <td style={{padding: '12px', fontWeight: 'bold'}}>{p.name}</td>
                    <td style={{textAlign: 'center', fontSize: '24px', fontWeight: 'bold'}}>{total}</td>
                    {[...Array(maxR + 1)].map((_, i) => {
                      const val = parseInt(p.levels?.[i] || 0);
                      return (
                        <td key={i} style={{textAlign: 'center', padding: '5px'}}>
                          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f8f9fa', borderRadius: '8px', padding: '5px'}}>
                            {isAdmin && <button onClick={() => update(ref(db, `current_game/players/${p.name}/levels`), {[i]: val + 1})} style={{background: '#55efc4', border: 'none', borderRadius: '4px', width: '30px'}}>+</button>}
                            <span style={{fontWeight: 'bold', margin: '3px 0'}}>{val}</span>
                            {isAdmin && <button onClick={() => update(ref(db, `current_game/players/${p.name}/levels`), {[i]: val - 1})} style={{background: '#fab1a0', border: 'none', borderRadius: '4px', width: '30px'}}>-</button>}
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
        {isAdmin && (
          <div style={{marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
            <button className="role-btn" onClick={() => update(ref(db, `current_game/players/${players[0].name}/levels`), {[maxR + 1]: 0})} style={{gridColumn: 'span 2', background: '#55efc4'}}>➕ Коло</button>
            <button className="finish-btn" onClick={() => { if(window.confirm("Завершити?")) finalReset(winners); }}>🏁 Завершити</button>
            <button className="finish-btn" onClick={() => { if(prompt("Пароль:") === '2910') set(ref(db, 'current_game/targetScore'), targetScore === 10 ? 11 : 10); }}>⚙️ Ціль</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container" style={{padding: '20px', textAlign: 'center'}}>
      <h2>Вхід адміна</h2>
      <input type="password" onChange={e => setPassword(e.target.value)} style={{width: '100%', padding: '15px', marginBottom: '10px'}} placeholder="Пароль" />
      <button className="start-btn" onClick={() => { if(password === '2910') { setIsAdmin(true); setScreen('main'); } else alert('Невірно'); }}>Увійти</button>
    </div>
  );
}

export default App;