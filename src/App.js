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

  const addNewPlayer = () => {
    const newName = prompt("Введіть ім'я нового гравця:");
    if (newName && newName.trim() !== "") {
      const trimmed = newName.trim();
      if (playerList.includes(trimmed)) return alert("Вже є!");
      set(ref(db, 'player_list'), [...playerList, trimmed]);
    }
  };

  const deleteFromList = (nameToDelete) => {
    if (prompt("Пароль для видалення:") === "1234") {
      set(ref(db, 'player_list'), playerList.filter(n => n !== nameToDelete));
    }
  };

  const calculateStats = () => {
    const statsMap = {};
    playerList.forEach(name => { statsMap[name] = { name, matches: 0, wins: 0 }; });
    history.forEach(game => {
      if (game.isArchive) {
        Object.entries(game.matchesCount || {}).forEach(([name, count]) => { if (statsMap[name]) statsMap[name].matches += count; });
        game.winner.split(', ').forEach(w => { const n = w.trim(); if (statsMap[n]) statsMap[n].wins += 1; });
      } else {
        const parts = game.participants.split(', '), winsArr = game.winner.split(', ');
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

  if (screen === 'main') return (
    <div className="container" style={{background: '#f8f9fd', minHeight: '100vh', padding: '20px 15px'}}>
      <h1 style={{fontSize: '26px', color: '#2d3436', marginBottom: '25px', fontWeight: '800'}}>🏆 Munchkin Stats</h1>
      
      <div className="podium-container" style={{display: 'grid', gridTemplateColumns: '1fr 1.1fr 1fr', gap: '8px', marginBottom: '25px'}}>
        <div className="podium-item" style={{background: 'white', borderRadius: '16px', padding: '12px 5px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: '1px solid #eee'}}>
          <div style={{fontSize: '10px', color: '#636e72', fontWeight: 'bold'}}>🎮 МАТЧІ</div>
          <div style={{fontSize: '14px', fontWeight: '900', color: '#2d3436', margin: '4px 0'}}>{podium.matches.names}</div>
          <div style={{fontSize: '16px', fontWeight: '900', color: '#ff7675'}}>{podium.matches.value}</div>
        </div>
        <div className="podium-item gold" style={{background: 'white', borderRadius: '16px', padding: '12px 5px', boxShadow: '0 4px 15px rgba(253, 203, 110, 0.2)', border: '2px solid #fdcb6e'}}>
          <div style={{fontSize: '10px', color: '#636e72', fontWeight: 'bold'}}>👑 ПЕРЕМОГИ</div>
          <div style={{fontSize: '15px', fontWeight: '900', color: '#2d3436', margin: '4px 0'}}>{podium.wins.names}</div>
          <div style={{fontSize: '18px', fontWeight: '900', color: '#ff7675'}}>{podium.wins.value}</div>
        </div>
        <div className="podium-item" style={{background: 'white', borderRadius: '16px', padding: '12px 5px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: '1px solid #eee'}}>
          <div style={{fontSize: '10px', color: '#636e72', fontWeight: 'bold'}}>📈 ВІНРЕЙТ</div>
          <div style={{fontSize: '14px', fontWeight: '900', color: '#2d3436', margin: '4px 0'}}>{podium.rate.names}</div>
          <div style={{fontSize: '16px', fontWeight: '900', color: '#ff7675'}}>{podium.rate.value}</div>
        </div>
      </div>

      <div className="stats-card" style={{background: 'white', borderRadius: '20px', padding: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.03)'}}>
        <h3 style={{textAlign: 'left', marginBottom: '12px', fontSize: '16px'}}>📊 Рейтинг</h3>
        <table style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead><tr style={{color: '#b2bec3', fontSize: '11px', borderBottom: '1px solid #f1f2f6'}}>
            <th style={{textAlign: 'left', padding: '10px'}}>ГРАВЕЦЬ</th>
            <th style={{textAlign: 'center'}}>М</th>
            <th style={{textAlign: 'center'}}>🏆</th>
            <th style={{textAlign: 'center'}}>%</th>
          </tr></thead>
          <tbody>
            {currentStats.map((p, i) => (
              <tr key={i} style={{borderBottom: '1px solid #f8f9fd', opacity: p.matches === 0 ? 0.3 : 1}}>
                <td style={{padding: '12px 10px', fontWeight: '700', color: '#2d3436'}}>{p.name}</td>
                <td style={{textAlign: 'center'}}>{p.matches}</td>
                <td style={{textAlign: 'center', fontWeight: '800', color: '#6c5ce7'}}>{p.wins}</td>
                <td style={{textAlign: 'center'}}>{p.rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{marginTop: '30px'}}>
        <h3 style={{textAlign: 'left', marginLeft: '5px', marginBottom: '10px', fontSize: '16px', color: '#2d3436'}}>📜 Остання активність</h3>
        <div style={{background: 'white', borderRadius: '20px', padding: '5px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)'}}>
          {[...history].reverse().slice(0, 8).map((g) => (
            <div key={g.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 15px', borderBottom: '1px solid #f1f2f6'
            }}>
              <div style={{textAlign: 'left', flex: 1}}>
                <div style={{fontSize: '14px', fontWeight: 'bold', color: '#2d3436'}}>
                   {g.isArchive ? <span style={{color: '#27ae60'}}>Архів (Excel)</span> : `${g.date} — ${g.winner} 🏆`}
                </div>
                <div style={{fontSize: '11px', color: '#b2bec3', marginTop: '2px'}}>{g.participants}</div>
              </div>
              <div onClick={() => { if(prompt("Пароль:")==="1234") remove(ref(db, `games_history/${g.id}`)) }} 
                   style={{cursor: 'pointer', padding: '5px', fontSize: '16px', opacity: 0.2}}>🗑️</div>
            </div>
          ))}
        </div>
      </div>

      <button className="start-btn" onClick={() => setScreen('select-role')} style={{
        marginTop: '25px', width: '100%', padding: '16px', borderRadius: '16px', 
        background: '#2d3436', color: 'white', fontSize: '16px', fontWeight: 'bold', border: 'none'
      }}>Нова гра</button>
    </div>
  );

  if (screen === 'select-role') return (
    <div className="container" style={{padding: '20px'}}>
      <h2>Хто грає?</h2>
      <button className="role-btn admin" style={{marginBottom: '10px', border: '2px solid #ffd700'}} onClick={() => {
        if (!isAdmin) setScreen('admin-auth');
        else { update(ref(db, `current_game/players/Єгор`), { name: "Єгор", levels: { 0: 0 } }); setScreen('lobby'); }
      }}>👑 Єгор</button>
      {isAdmin && <button className="start-btn" onClick={addNewPlayer} style={{marginBottom: '15px', background: '#00cec9', fontSize: '14px'}}>➕ Додати гравця</button>}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
        {playerList.filter(n => n !== "Єгор").map(n => (
          <div key={n} style={{position: 'relative'}}>
            <button className="role-btn" onClick={() => { update(ref(db, `current_game/players/${n}`), { name: n, levels: { 0: 0 } }); setScreen('lobby'); }} style={{width: '100%'}}>{n}</button>
            {isAdmin && <button onClick={(e) => { e.stopPropagation(); deleteFromList(n); }} style={{position: 'absolute', top: '-5px', right: '-5px', background: '#ff7675', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', zIndex: 10}}>✕</button>}
          </div>
        ))}
      </div>
      <button className="finish-btn" onClick={() => setScreen('main')} style={{marginTop: '20px'}}>Назад</button>
    </div>
  );

  if (screen === 'game') {
    const players = Object.values(lobbyPlayers), maxR = players.reduce((m, p) => Math.max(m, p.levels ? Object.keys(p.levels).length - 1 : 0), 0);
    return (
      <div className="container" style={{maxWidth: '100%', padding: '10px'}}>
        {winners.length > 0 && (
          <div className="winner-overlay"><div className="winner-card" style={{textAlign: 'center', padding: '30px'}}>
              <h2 style={{fontSize: '40px'}}>🎉 ПЕРЕМОГА! 🎉</h2>
              <div style={{fontSize: '24px', fontWeight: 'bold', marginBottom: '20px'}}>{winners.join(', ')}</div>
              {isAdmin ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                  <button className="start-btn" onClick={() => finalReset(winners)}>Зберегти 🏆</button>
                  <button className="finish-btn" onClick={() => setWinners([])}>Назад</button>
                </div>
              ) : <button className="start-btn" onClick={() => setWinners([])}>Зрозуміло 👍</button>}
          </div></div>
        )}
        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}><h2>🎯 Ціль: {targetScore}</h2>{isAdmin && <span style={{fontSize: '12px', background: '#ffeaa7', padding: '2px 8px', borderRadius: '10px'}}>Admin</span>}</div>
        <div className="table-wrapper" style={{overflowX: 'auto', background: 'white', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)'}}>
          <table className="game-table" style={{width: '100%', borderCollapse: 'collapse', minWidth: '400px'}}>
            <thead><tr style={{background: '#2d3436', color: 'white'}}><th style={{padding: '12px', textAlign: 'left', position: 'sticky', left: 0, background: '#2d3436', zIndex: 10, fontSize: '18px'}}>Ім'я</th><th style={{padding: '12px', fontSize: '18px'}}>LVL</th>{[...Array(maxR + 1)].map((_, i) => <th key={i} style={{padding: '12px'}}>К{i+1}</th>)}</tr></thead>
            <tbody>
              {players.map((p, idx) => {
                const total = Object.values(p.levels || {}).reduce((a, b) => a + b, 1);
                return (
                  <tr key={p.name} style={{borderBottom: '1px solid #dfe6e9', background: idx % 2 === 0 ? '#fff' : '#f9f9f9'}}>
                    <td style={{padding: '12px', fontWeight: 'bold', fontSize: '20px', position: 'sticky', left: 0, background: idx % 2 === 0 ? '#fff' : '#f9f9f9', boxShadow: '2px 0 5px rgba(0,0,0,0.05)', zIndex: 5}}>{p.name}</td>
                    <td style={{padding: '12px', textAlign: 'center', fontSize: '35px', fontWeight: '900', color: '#2d3436', background: total >= targetScore ? '#ff7675' : (total >= targetScore - 1 ? '#ffeaa7' : 'transparent')}}>{total}</td>
                    {[...Array(maxR + 1)].map((_, i) => {
                      const val = parseInt(p.levels?.[i] || 0);
                      return (
                        <td key={i} style={{padding: '4px', textAlign: 'center'}}>
                          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: '#f8f9fa', borderRadius: '8px', padding: '4px'}}>
                            {isAdmin && <button onClick={() => update(ref(db, `current_game/players/${p.name}/levels`), {[i]: val + 1})} style={{background: '#55efc4', border: 'none', borderRadius: '4px', width: '32px', height: '28px', fontSize: '18px', fontWeight: 'bold'}}>+</button>}
                            <span style={{fontSize: '16px', fontWeight: '700', minWidth: '20px'}}>{val}</span>
                            {isAdmin && <button onClick={() => update(ref(db, `current_game/players/${p.name}/levels`), {[i]: Math.max(0, val - 1)})} style={{background: '#fab1a0', border: 'none', borderRadius: '4px', width: '32px', height: '28px', fontSize: '18px', fontWeight: 'bold'}}>-</button>}
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
          <div className="admin-actions" style={{marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
            <button className="role-btn" onClick={() => update(ref(db, `current_game/players/${players[0].name}/levels`), {[maxR + 1]: 0})} style={{gridColumn: 'span 2', background: '#55efc4'}}>➕ Коло</button>
            <button className="special-btn" onClick={() => {if(prompt("Пароль:")==="1234") update(ref(db, 'current_game'), {targetScore: targetScore === 10 ? 11 : 10})}}>⚙️ Ціль: {targetScore === 10 ? 11 : 10}</button>
            <button className="finish-btn" onClick={() => { const actW = players.filter(p => Object.values(p.levels || {}).reduce((a,b)=>a+b, 1) >= targetScore).map(p => p.name); if (actW.length > 0) { if (window.confirm(`Зберегти результат?`)) finalReset(actW); } else { if (window.confirm("Завершити без збереження?")) finalReset(); } }}>🏁 Завершити</button>
          </div>
        )}
      </div>
    );
  }

  if (screen === 'admin-auth') return (
    <div className="container">
      <h2>Вхід адміна</h2>
      <input type="password" onChange={e => setPassword(e.target.value)} className="password-input" placeholder="Пароль" autoFocus />
      <button className="start-btn" onClick={() => { if(password === '1234') { setIsAdmin(true); update(ref(db, `current_game/players/Єгор`), { name: "Єгор", levels: { 0: 0 } }); setScreen('lobby'); } else alert('Невірно'); }}>Увійти</button>
    </div>
  );

  if (screen === 'lobby') return (
    <div className="container">
      <h2>🏠 Лобі гри</h2>
      <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px'}}>
        {Object.values(lobbyPlayers).map(p => (
          <div key={p.name} className="role-btn" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f1f2f6', cursor: 'default'}}>
            <span>✅ {p.name}</span>
            {isAdmin && <button onClick={() => remove(ref(db, `current_game/players/${p.name}`))} style={{background: '#ff7675', color: 'white', border: 'none', borderRadius: '50%', width: '25px', height: '25px', cursor: 'pointer', fontWeight: 'bold'}}>✕</button>}
          </div>
        ))}
      </div>
      {isAdmin && <button className="start-btn" onClick={() => update(ref(db, 'current_game'), { status: 'active' })} disabled={Object.keys(lobbyPlayers).length === 0}>🚀 Почати гру</button>}
      <button className="finish-btn" onClick={() => setScreen('select-role')}>Назад</button>
    </div>
  );

  return null;
}

export default App;