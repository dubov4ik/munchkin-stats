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
    // 1. Завантаження списку гравців
    onValue(ref(db, 'player_list'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPlayerList(data);
      } else {
        const initialPlayers = ["Єгор", "Женя", "Влад", "Влада", "Таня", "Аня", "Артем", "Боря", "Ліза", "Наташа", "Максим"];
        set(ref(db, 'player_list'), initialPlayers);
      }
    });

    // 2. Архів з актуальними даними (Єгор: 49 матчів)
    const checkArchive = (existingHistory) => {
      const archiveEntry = existingHistory.find(g => g.id === 'archive_excel_data');
      const latestArchive = {
        date: "Архів (Excel)",
        participants: "Єгор, Женя, Влад, Влада, Таня, Аня, Артем, Боря, Ліза, Наташа, Максим",
        winner: [
          ...Array(17).fill("Женя"), ...Array(8).fill("Влад"), ...Array(8).fill("Влада"),
          ...Array(4).fill("Таня"), ...Array(7).fill("Єгор"), ...Array(3).fill("Аня"),
          ...Array(5).fill("Артем"), ...Array(1).fill("Ліза")
        ].join(', '),
        isArchive: true,
        matchesCount: {
          "Єгор": 49, "Таня": 46, "Женя": 46, "Влада": 40, "Влад": 34, 
          "Аня": 25, "Артем": 10, "Боря": 6, "Наташа": 2, "Максим": 2, "Ліза": 1
        }
      };

      if (!archiveEntry || archiveEntry.matchesCount?.Єгор !== 49) {
        set(ref(db, 'games_history/archive_excel_data'), latestArchive);
      }
    };

    onValue(ref(db, 'games_history'), (snapshot) => {
      const data = snapshot.val();
      const entries = data ? Object.entries(data).map(([id, value]) => ({ id, ...value })) : [];
      setHistory(entries);
      checkArchive(entries);
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

  const addNewPlayer = () => {
    const newName = prompt("Введіть ім'я нового гравця:");
    if (newName && newName.trim() !== "") {
      const trimmed = newName.trim();
      if (playerList.includes(trimmed)) return alert("Вже є!");
      set(ref(db, 'player_list'), [...playerList, trimmed]);
    }
  };

  const calculateStats = () => {
    const statsMap = {};
    playerList.forEach(name => { statsMap[name] = { name, matches: 0, wins: 0 }; });

    history.forEach(game => {
      if (game.isArchive) {
        Object.entries(game.matchesCount || {}).forEach(([name, count]) => { if (statsMap[name]) statsMap[name].matches += count; });
        game.winner.split(', ').forEach(w => { const name = w.trim(); if (statsMap[name]) statsMap[name].wins += 1; });
      } else {
        const parts = game.participants.split(', ');
        const winsArr = game.winner.split(', ');
        parts.forEach(p => { if (statsMap[p]) { statsMap[p].matches += 1; if (winsArr.includes(p)) statsMap[p].wins += 1; } });
      }
    });

    return Object.values(statsMap)
      .map(p => ({ ...p, rate: p.matches > 0 ? Math.round((p.wins / p.matches) * 100) : 0 }))
      .sort((a, b) => b.wins - a.wins || b.rate - a.rate);
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

  // --- RENDERING ---

  if (screen === 'main') return (
    <div className="container">
      <h1>🏆 Munchkin Stats</h1>
      <div className="podium-container">
        <div className="podium-item"><div>🎮 МАТЧІ</div><div className="podium-name">{podium.matches.names}</div><div className="podium-value">{podium.matches.value}</div></div>
        <div className="podium-item gold"><div>👑 ПЕРЕМОГИ</div><div className="podium-name">{podium.wins.names}</div><div className="podium-value">{podium.wins.value}</div></div>
        <div className="podium-item"><div>📈 ВІНРЕЙТ</div><div className="podium-name">{podium.rate.names}</div><div className="podium-value">{podium.rate.value}</div></div>
      </div>

      <div className="stats-card">
        <h3>📊 Таблиця</h3>
        <table>
          <thead><tr><th>Гравець</th><th>Ігор</th><th>🏆</th><th>%</th></tr></thead>
          <tbody>
            {currentStats.map((p, i) => (
              <tr key={i} style={{opacity: p.matches === 0 ? 0.3 : 1}}>
                <td>{p.name}</td><td>{p.matches}</td><td>{p.wins}</td><td>{p.rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="stats-card" style={{marginTop: '20px'}}>
        <h3>📜 Історія</h3>
        <div className="history-list">
          {[...history].reverse().slice(0, 10).map((g) => (
            <div key={g.id} className="history-item">
              <div style={{flex: 1}}>
                {g.isArchive ? <strong>{g.date}</strong> : <span>{g.date} — <strong>{g.winner}</strong> 🏆</span>}
                <br/><small>{g.participants}</small>
              </div>
              <button className="del-btn" onClick={() => { if(prompt("Пароль:")==="1234") remove(ref(db, `games_history/${g.id}`)) }}>🗑️</button>
            </div>
          ))}
        </div>
      </div>
      <button className="start-btn" onClick={() => setScreen('select-role')} style={{marginTop: '20px'}}>Нова гра</button>
    </div>
  );

  if (screen === 'select-role') return (
    <div className="container">
      <h2>Хто грає?</h2>
      
      {/* 1. Кнопка Єгора завжди зверху */}
      <button className="role-btn admin" style={{marginBottom: '10px', border: '2px solid #ffd700'}} onClick={() => {
        if (!isAdmin) setScreen('admin-auth');
        else { update(ref(db, `current_game/players/Єгор`), { name: "Єгор", levels: { 0: 0 } }); setScreen('lobby'); }
      }}>👑 Єгор</button>

      {/* 2. Кнопка додавання під Єгором (якщо залогінений) */}
      {isAdmin && (
        <button className="start-btn" onClick={addNewPlayer} style={{marginBottom: '15px', background: '#00cec9', fontSize: '14px'}}>
          ➕ Додати нового гравця
        </button>
      )}

      {/* 3. Решта гравців */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
        {playerList.filter(n => n !== "Єгор").map(n => (
          <button key={n} className="role-btn" onClick={() => {
            update(ref(db, `current_game/players/${n}`), { name: n, levels: { 0: 0 } });
            setScreen('lobby');
          }}>{n}</button>
        ))}
      </div>
      
      <button className="finish-btn" onClick={() => setScreen('main')} style={{marginTop: '20px'}}>Назад</button>
    </div>
  );

  if (screen === 'admin-auth') return (
    <div className="container">
      <h2>Вхід адміна</h2>
      <input type="password" onChange={e => setPassword(e.target.value)} className="password-input" placeholder="Пароль" autoFocus />
      <button className="start-btn" onClick={() => {
        if(password === '1234') { 
          setIsAdmin(true); 
          update(ref(db, `current_game/players/Єгор`), { name: "Єгор", levels: { 0: 0 } }); 
          setScreen('lobby'); 
        } else alert('Невірно');
      }}>Увійти</button>
    </div>
  );

  if (screen === 'lobby') return (
    <div className="container">
      <h2>🏠 Лобі гри</h2>
      <p style={{fontSize: '14px', color: '#636e72', marginBottom: '20px'}}>
        {isAdmin ? "Ви можете видалити зайвих гравців перед стартом" : "Чекайте, поки адмін почне гру..."}
      </p>
      
      <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px'}}>
        {Object.values(lobbyPlayers).map(p => (
          <div key={p.name} className="role-btn" style={{
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: '#f1f2f6',
            cursor: 'default'
          }}>
            <span>✅ {p.name}</span>
            
            {/* Хрестик для видалення — бачить тільки адмін */}
            {isAdmin && (
              <button 
                onClick={() => remove(ref(db, `current_game/players/${p.name}`))}
                style={{
                  background: '#ff7675',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '25px',
                  height: '25px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontWeight: 'bold'
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {isAdmin && (
        <button 
          className="start-btn" 
          onClick={() => update(ref(db, 'current_game'), { status: 'active' })}
          disabled={Object.keys(lobbyPlayers).length === 0}
        >
          🚀 Почати гру ({Object.keys(lobbyPlayers).length})
        </button>
      )}
      
      <button className="finish-btn" onClick={() => setScreen('select-role')} style={{marginTop: '10px'}}>
        ⬅️ Назад до вибору
      </button>
    </div>
  );

  if (screen === 'game') {
    const players = Object.values(lobbyPlayers);
    const maxR = players.reduce((m, p) => Math.max(m, p.levels ? Object.keys(p.levels).length - 1 : 0), 0);
    
    return (
      <div className="container" style={{maxWidth: '100%', padding: '10px'}}>
        {winners.length > 0 && (
          <div className="winner-overlay">
            <div className="winner-card" style={{textAlign: 'center', padding: '30px'}}>
              <h2 style={{fontSize: '40px', marginBottom: '10px'}}>🎉 ПЕРЕМОГА! 🎉</h2>
              <div style={{fontSize: '24px', fontWeight: 'bold', color: '#2d3436', marginBottom: '20px'}}>
                {winners.join(', ')}
              </div>
              
              {isAdmin ? (
                // Тільки адмін бачить кнопку збереження в базу
                <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                  <p style={{color: '#636e72', fontSize: '14px'}}>Ви як адмін можете завершити гру для всіх:</p>
                  <button className="start-btn" onClick={() => finalReset(winners)}>
                    Зберегти в історію та вийти 🏆
                  </button>
                  <button className="finish-btn" onClick={() => setWinners([])} style={{background: '#b2bec3'}}>
                    Продовжити грати (назад)
                  </button>
                </div>
              ) : (
                // Звичайні гравці просто закривають вікно
                <div>
                  <p style={{color: '#636e72', fontSize: '14px', marginBottom: '15px'}}>Чекайте, поки Єгор збереже результат...</p>
                  <button className="start-btn" onClick={() => setWinners([])} style={{background: '#00cec9'}}>
                    Зрозуміло 👍
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
           <h2 style={{margin: 0}}>🎯 Ціль: {targetScore}</h2>
           {isAdmin && <span style={{fontSize: '12px', background: '#ffeaa7', padding: '2px 8px', borderRadius: '10px'}}>Admin Mode</span>}
        </div>

        {/* Контейнер з горизонтальним скролом для таблиці */}
        <div className="table-wrapper" style={{overflowX: 'auto', background: 'white', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)'}}>
          <table className="game-table" style={{width: '100%', borderCollapse: 'collapse', minWidth: '400px'}}>
            <thead>
              <tr style={{background: '#2d3436', color: 'white'}}>
                <th style={{padding: '12px', textAlign: 'left', position: 'sticky', left: 0, background: '#2d3436', zIndex: 10}}>Ім'я</th>
                <th style={{padding: '12px'}}>LVL</th>
                {[...Array(maxR + 1)].map((_, i) => <th key={i} style={{padding: '12px'}}>К{i+1}</th>)}
              </tr>
            </thead>
            <tbody>
              {players.map((p, idx) => {
                const total = Object.values(p.levels || {}).reduce((a, b) => a + b, 1);
                const isLeader = total >= targetScore - 1 && total < targetScore;
                
                return (
                  <tr key={p.name} style={{borderBottom: '1px solid #dfe6e9', background: idx % 2 === 0 ? '#fff' : '#f9f9f9'}}>
                    <td style={{
                      padding: '12px', 
                      fontWeight: 'bold', 
                      position: 'sticky', 
                      left: 0, 
                      background: idx % 2 === 0 ? '#fff' : '#f9f9f9',
                      boxShadow: '2px 0 5px rgba(0,0,0,0.05)',
                      zIndex: 5
                    }}>{p.name}</td>
                    
                    <td style={{
                      padding: '12px', 
                      textAlign: 'center',
                      fontSize: '18px',
                      fontWeight: '800',
                      color: total >= targetScore ? '#d63031' : (isLeader ? '#e17055' : '#2d3436'),
                      background: total >= targetScore ? '#ff7675' : (isLeader ? '#ffeaa7' : 'transparent')
                    }}>{total}</td>

                    {[...Array(maxR + 1)].map((_, i) => (
                      <td key={i} style={{padding: '5px', textAlign: 'center'}}>
                        <input 
                          type="number" 
                          disabled={!isAdmin} 
                          value={p.levels?.[i] || 0} 
                          onChange={e => update(ref(db, `current_game/players/${p.name}/levels`), {[i]: parseInt(e.target.value) || 0})} 
                          className="level-input"
                          style={{
                            width: '40px',
                            padding: '8px 4px',
                            border: isAdmin ? '1px solid #b2bec3' : 'none',
                            background: isAdmin ? 'white' : 'transparent',
                            textAlign: 'center',
                            borderRadius: '6px',
                            fontSize: '16px'
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {isAdmin && (
          <div className="admin-actions" style={{marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
            <button className="role-btn" onClick={() => update(ref(db, `current_game/players/${players[0].name}/levels`), {[maxR + 1]: 0})} style={{gridColumn: 'span 2', background: '#55efc4'}}>➕ Додати коло для всіх</button>
            <button className="special-btn" onClick={() => {if(prompt("Пароль:")==="1234") update(ref(db, 'current_game'), {targetScore: targetScore === 10 ? 11 : 10})}}>⚙️ Ціль: {targetScore === 10 ? 11 : 10}</button>
            <button className="finish-btn" onClick={() => {
              const actW = players.filter(p => Object.values(p.levels || {}).reduce((a,b)=>a+b, 1) >= targetScore).map(p => p.name);
              if (actW.length > 0) { if (window.confirm(`Зберегти результат?`)) finalReset(actW); }
              else { if (window.confirm("Завершити без збереження?")) finalReset(); }
            }}>🏁 Завершити</button>
          </div>
        )}
      </div>
    );
  }
  return null;
}

export default App;