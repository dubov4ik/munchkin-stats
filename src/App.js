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

  // ОСНОВНИЙ ЕКРАН
  if (screen === 'main') return (
    <div className="container" style={{background: '#f8f9fd', minHeight: '100vh', padding: '20px 15px'}}>
      <h1 style={{fontSize: '28px', color: '#2d3436', marginBottom: '25px', letterSpacing: '-0.5px'}}>🏆 Munchkin <span style={{color: '#6c5ce7'}}>Stats</span></h1>
      
      <div className="podium-container" style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '25px'}}>
        <div className="podium-item" style={{background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: 'white', borderRadius: '18px', padding: '15px 5px', boxShadow: '0 8px 20px rgba(108, 92, 231, 0.2)'}}>
          <div style={{fontSize: '10px', opacity: 0.9, fontWeight: 'bold'}}>МАТЧІ</div>
          <div style={{fontSize: '14px', fontWeight: '900', margin: '5px 0'}}>{podium.matches.names}</div>
          <div style={{fontSize: '18px', fontWeight: '900'}}>{podium.matches.value}</div>
        </div>
        <div className="podium-item gold" style={{background: 'linear-gradient(135deg, #fdcb6e, #f1c40f)', color: '#2d3436', borderRadius: '18px', padding: '15px 5px', boxShadow: '0 8px 20px rgba(253, 203, 110, 0.3)', transform: 'scale(1.05)'}}>
          <div style={{fontSize: '10px', opacity: 0.8, fontWeight: 'bold'}}>👑 ПЕРЕМОГИ</div>
          <div style={{fontSize: '15px', fontWeight: '900', margin: '5px 0'}}>{podium.wins.names}</div>
          <div style={{fontSize: '20px', fontWeight: '900'}}>{podium.wins.value}</div>
        </div>
        <div className="podium-item" style={{background: 'linear-gradient(135deg, #00cec9, #81ecec)', color: 'white', borderRadius: '18px', padding: '15px 5px', boxShadow: '0 8px 20px rgba(0, 206, 201, 0.2)'}}>
          <div style={{fontSize: '10px', opacity: 0.9, fontWeight: 'bold'}}>ВІНРЕЙТ</div>
          <div style={{fontSize: '14px', fontWeight: '900', margin: '5px 0'}}>{podium.rate.names}</div>
          <div style={{fontSize: '18px', fontWeight: '900'}}>{podium.rate.value}</div>
        </div>
      </div>

      <div className="stats-card" style={{background: 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.02)'}}>
        <h3 style={{textAlign: 'left', marginBottom: '15px', fontSize: '18px'}}>📊 Загальний рейтинг</h3>
        <table style={{width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px'}}>
          <thead><tr style={{color: '#b2bec3', fontSize: '12px', textTransform: 'uppercase'}}>
            <th style={{textAlign: 'left', padding: '0 10px'}}>Гравець</th><th>М</th><th>🏆</th><th>%</th>
          </tr></thead>
          <tbody>
            {currentStats.map((p, i) => (
              <tr key={i} style={{background: p.matches === 0 ? 'transparent' : '#fcfcfd', opacity: p.matches === 0 ? 0.4 : 1}}>
                <td style={{padding: '12px 10px', borderRadius: '12px 0 0 12px', fontWeight: 'bold', color: '#2d3436'}}>{p.name}</td>
                <td style={{textAlign: 'center', fontWeight: '600'}}>{p.matches}</td>
                <td style={{textAlign: 'center', fontWeight: '900', color: '#6c5ce7'}}>{p.wins}</td>
                <td style={{textAlign: 'center', borderRadius: '0 12px 12px 0', fontWeight: '600'}}>{p.rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{marginTop: '35px'}}>
        <h3 style={{textAlign: 'left', marginLeft: '10px', marginBottom: '15px', fontSize: '18px'}}>📜 Остання активність</h3>
        {[...history].reverse().slice(0, 5).map((g) => (
          <div key={g.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'white', padding: '15px', margin: '10px 0', borderRadius: '18px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)', borderLeft: '5px solid #6c5ce7'
          }}>
            <div style={{textAlign: 'left'}}>
              <div style={{fontSize: '14px', fontWeight: 'bold', color: '#2d3436'}}>
                {g.winner} <span style={{color: '#6c5ce7'}}>🏆</span>
              </div>
              <div style={{fontSize: '11px', color: '#a29bfe', fontWeight: '600'}}>{g.date}</div>
            </div>
            <div onClick={() => { if(prompt("Пароль:")==="1234") remove(ref(db, `games_history/${g.id}`)) }} style={{opacity: 0.2, fontSize: '18px'}}>🗑️</div>
          </div>
        ))}
      </div>

      <button className="start-btn" onClick={() => setScreen('select-role')} style={{
        marginTop: '30px', width: '100%', padding: '18px', borderRadius: '20px', 
        background: '#2d3436', color: 'white', fontSize: '18px', fontWeight: 'bold', border: 'none',
        boxShadow: '0 10px 25px rgba(45, 52, 54, 0.2)'
      }}>Почати нову пригоду</button>
    </div>
  );

  // ЕКРАН ВИБОРУ ГРАВЦІВ (ЛОББІ)
  if (screen === 'select-role') return (
    <div className="container" style={{padding: '25px 20px'}}>
      <h2 style={{fontSize: '24px', marginBottom: '30px'}}>Хто йде в бій?</h2>
      <button className="role-btn admin" style={{
        marginBottom: '15px', background: '#fdcb6e', border: 'none', color: '#2d3436',
        padding: '20px', borderRadius: '18px', fontSize: '18px', fontWeight: '900', width: '100%'
      }} onClick={() => {
        if (!isAdmin) setScreen('admin-auth');
        else { update(ref(db, `current_game/players/Єгор`), { name: "Єгор", levels: { 0: 0 } }); setScreen('lobby'); }
      }}>👑 Єгор (Адмін)</button>
      
      {isAdmin && <button onClick={addNewPlayer} style={{
        marginBottom: '20px', width: '100%', padding: '12px', borderRadius: '12px',
        background: 'transparent', border: '2px dashed #b2bec3', color: '#636e72', fontWeight: 'bold'
      }}>+ Додати нового гравця</button>}

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
        {playerList.filter(n => n !== "Єгор").map(n => (
          <div key={n} style={{position: 'relative'}}>
            <button onClick={() => { update(ref(db, `current_game/players/${n}`), { name: n, levels: { 0: 0 } }); setScreen('lobby'); }} style={{
              width: '100%', padding: '15px', borderRadius: '15px', background: 'white',
              border: '1px solid #eee', fontSize: '16px', fontWeight: '600', color: '#2d3436', boxShadow: '0 4px 10px rgba(0,0,0,0.02)'
            }}>{n}</button>
            {isAdmin && <button onClick={(e) => { e.stopPropagation(); deleteFromList(n); }} style={{
              position: 'absolute', top: '-6px', right: '-6px', background: '#ff7675', 
              color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', fontSize: '10px'
            }}>✕</button>}
          </div>
        ))}
      </div>
      <button className="finish-btn" onClick={() => setScreen('main')} style={{marginTop: '30px', color: '#b2bec3', border: 'none', background: 'none', fontWeight: 'bold'}}>Повернутись</button>
    </div>
  );

  // ЕКРАН ГРИ (ТАБЛИЦЯ)
  if (screen === 'game') {
    const players = Object.values(lobbyPlayers), maxR = players.reduce((m, p) => Math.max(m, p.levels ? Object.keys(p.levels).length - 1 : 0), 0);
    return (
      <div className="container" style={{maxWidth: '100%', padding: '15px 10px', background: '#f8f9fd'}}>
        {winners.length > 0 && (
          <div className="winner-overlay" style={{background: 'rgba(45, 52, 54, 0.95)', zIndex: 1000}}>
            <div className="winner-card" style={{background: 'white', padding: '40px 20px', borderRadius: '30px', textAlign: 'center'}}>
              <div style={{fontSize: '60px', marginBottom: '10px'}}>🎉</div>
              <h2 style={{fontSize: '24px', color: '#2d3436'}}>У нас є переможець!</h2>
              <div style={{fontSize: '32px', fontWeight: '900', color: '#6c5ce7', margin: '20px 0'}}>{winners.join(', ')}</div>
              {isAdmin ? (
                <button className="start-btn" onClick={() => finalReset(winners)} style={{width: '100%', borderRadius: '15px'}}>Записати в історію 🏆</button>
              ) : <p style={{color: '#b2bec3'}}>Очікуємо підтвердження адміна...</p>}
            </div>
          </div>
        )}

        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '0 5px'}}>
          <h2 style={{fontSize: '20px', margin: 0}}>🎯 Ціль: <span style={{color: '#6c5ce7'}}>{targetScore}</span></h2>
          {isAdmin && <div style={{padding: '5px 12px', background: '#dfe6e9', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold'}}>ADMIN MODE</div>}
        </div>

        <div className="table-wrapper" style={{background: 'white', borderRadius: '24px', boxShadow: '0 15px 40px rgba(0,0,0,0.08)', overflow: 'hidden'}}>
          <table style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{background: '#2d3436', color: 'white'}}>
                <th style={{padding: '18px 12px', textAlign: 'left', fontSize: '14px', position: 'sticky', left: 0, background: '#2d3436', zIndex: 10}}>Гравець</th>
                <th style={{padding: '18px 12px', fontSize: '14px'}}>LVL</th>
                {[...Array(maxR + 1)].map((_, i) => <th key={i} style={{fontSize: '12px', opacity: 0.7}}>К{i+1}</th>)}
              </tr>
            </thead>
            <tbody>
              {players.map((p, idx) => {
                const total = Object.values(p.levels || {}).reduce((a, b) => a + b, 1);
                const isLeading = total >= targetScore - 1;
                return (
                  <tr key={p.name} style={{borderBottom: '1px solid #f1f2f6', background: isLeading ? '#fff9eb' : 'white'}}>
                    <td style={{
                      padding: '15px 12px', fontWeight: '900', fontSize: '20px', color: '#2d3436',
                      position: 'sticky', left: 0, background: isLeading ? '#fff9eb' : 'white', zIndex: 5
                    }}>{p.name}</td>
                    <td style={{
                      textAlign: 'center', fontSize: '42px', fontWeight: '900', 
                      color: total >= targetScore ? '#eb4d4b' : (isLeading ? '#f0932b' : '#2d3436'),
                      padding: '10px'
                    }}>{total}</td>
                    {[...Array(maxR + 1)].map((_, i) => {
                      const val = parseInt(p.levels?.[i] || 0);
                      return (
                        <td key={i} style={{padding: '5px'}}>
                          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: '#f8f9fd', padding: '6px', borderRadius: '12px'}}>
                            {isAdmin && <button onClick={() => update(ref(db, `current_game/players/${p.name}/levels`), {[i]: val + 1})} style={{background: '#55efc4', border: 'none', borderRadius: '6px', width: '35px', height: '30px', fontWeight: 'bold', fontSize: '18px'}}>+</button>}
                            <span style={{fontSize: '16px', fontWeight: '800'}}>{val}</span>
                            {isAdmin && <button onClick={() => update(ref(db, `current_game/players/${p.name}/levels`), {[i]: Math.max(0, val - 1)})} style={{background: '#fab1a0', border: 'none', borderRadius: '6px', width: '35px', height: '30px', fontWeight: 'bold', fontSize: '18px'}}>-</button>}
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
          <div style={{marginTop: '25px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
            <button onClick={() => update(ref(db, `current_game/players/${players[0].name}/levels`), {[maxR + 1]: 0})} style={{
              gridColumn: 'span 2', padding: '18px', borderRadius: '18px', background: '#6c5ce7', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '16px'
            }}>Нове коло (раунд)</button>
            <button onClick={() => {if(prompt("Пароль:")==="1234") update(ref(db, 'current_game'), {targetScore: targetScore === 10 ? 11 : 10})}} style={{
              padding: '15px', borderRadius: '15px', background: 'white', border: '1px solid #ddd', fontWeight: 'bold'
            }}>Ціль: {targetScore === 10 ? 11 : 10}</button>
            <button onClick={() => { if (window.confirm("Завершити гру?")) finalReset(); }} style={{
              padding: '15px', borderRadius: '15px', background: '#ff7675', color: 'white', border: 'none', fontWeight: 'bold'
            }}>Завершити</button>
          </div>
        )}
      </div>
    );
  }

  // ЕКРАН ПАРОЛЯ
  if (screen === 'admin-auth') return (
    <div className="container" style={{padding: '50px 20px', textAlign: 'center'}}>
      <div style={{fontSize: '50px', marginBottom: '20px'}}>🔐</div>
      <h2>Доступ для Єгора</h2>
      <input type="password" onChange={e => setPassword(e.target.value)} style={{
        width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #eee', margin: '20px 0', fontSize: '20px', textAlign: 'center'
      }} placeholder="Введіть пароль" autoFocus />
      <button className="start-btn" onClick={() => { if(password === '1234') { setIsAdmin(true); update(ref(db, `current_game/players/Єгор`), { name: "Єгор", levels: { 0: 0 } }); setScreen('lobby'); } else alert('Невірно'); }} style={{width: '100%'}}>Підтвердити</button>
    </div>
  );

  if (screen === 'lobby') return (
    <div className="container" style={{padding: '25px'}}>
      <h2>🏠 Лобі пригоди</h2>
      <div style={{margin: '25px 0'}}>
        {Object.values(lobbyPlayers).map(p => (
          <div key={p.name} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            background: 'white', padding: '18px', borderRadius: '15px', marginBottom: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)'
          }}>
            <span style={{fontWeight: 'bold', fontSize: '18px'}}>🛡️ {p.name}</span>
            {isAdmin && <button onClick={() => remove(ref(db, `current_game/players/${p.name}`))} style={{background: '#ff7675', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px'}}>✕</button>}
          </div>
        ))}
      </div>
      {isAdmin && <button className="start-btn" onClick={() => update(ref(db, 'current_game'), { status: 'active' })} style={{width: '100%'}}>В БІЙ! ⚔️</button>}
      <button className="finish-btn" onClick={() => setScreen('select-role')} style={{width: '100%', marginTop: '10px'}}>Додати ще гравців</button>
    </div>
  );

  return null;
}

export default App;