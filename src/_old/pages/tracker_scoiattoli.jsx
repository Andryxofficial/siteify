import React, { useEffect, useRef, useState } from 'react';
import './SquirrelRadar.css';

const SQUIRREL_COUNT = 12;

const fakeMessages = [
  "Avvistato scoiattolo anomalo munito di noce tattica.",
  "Intercettata comunicazione squittio: 'Abbiamo agganciato il bersaglio Gaia'.",
  "Movimenti furtivi multipli rilevati in zona cespugli settore Sud.",
  "Sensori sismici di superficie rilevano scavatori classe Roditore.",
  "ATTENZIONE: Sciame di roditori entra in formazione a cuneo d'attacco.",
  "Telecamere a infrarossi confermano code iper-vaporose in rotte di collisione.",
  "Rilevato picco radiazioni da ghiande modificate.",
  "Unità di ricognizione ha perso il segnale nel perimetro del giardino.",
  "ATTENZIONE: Squadra Delta Scoiattoli tenta l'aggiramento sul lato sinistro."
];

export default function SquirrelRadar() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const terminalEndRef = useRef(null);
  
  const [logs, setLogs] = useState([]);
  
  // Usiamo useRef per i valori mutabili dell'animazione per evitare re-render a 60fps
  const animationRef = useRef();
  const squirrelsRef = useRef([]);
  const angleRef = useRef(0);
  const dimsRef = useRef({ width: 0, height: 0, cx: 0, cy: 0, radius: 0 });

  const getTimestamp = () => {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];
    const ms = Math.floor(now.getMilliseconds() / 10).toString().padStart(2, '0');
    return `[${time}.${ms}]`;
  };

  // Funzione per aggiungere un log (usando prev state per non avere chiusure stantie)
  const addLog = (message, type = 'normal') => {
    setLogs(prev => {
      const newLog = { id: Date.now() + Math.random(), time: getTimestamp(), message, type };
      const nextLogs = [...prev, newLog];
      return nextLogs.slice(-50); // Mantiene solo gli ultimi 50 log
    });
  };

  const spawnSquirrel = (spawnOutside = false) => {
    const { cx, cy, radius } = dimsRef.current;
    if (!radius) return;

    let r = spawnOutside ? radius * (0.8 + Math.random() * 0.2) : radius * 1.1;
    const a = Math.random() * Math.PI * 2;
    
    squirrelsRef.current.push({
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r,
      dist: r,
      angle: a,
      speed: 0.15 + Math.random() * 0.4,
      id: Math.floor(Math.random() * 9999).toString().padStart(4, '0'),
      alerted: false
    });
  };

  const resize = () => {
    if (!containerRef.current || !canvasRef.current) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    
    const size = Math.min(container.clientWidth, container.clientHeight) * 0.95;
    canvas.width = size;
    canvas.height = size;
    
    dimsRef.current = {
      width: size,
      height: size,
      cx: size / 2,
      cy: size / 2,
      radius: (size / 2) * 0.92
    };
  };

  const drawRadar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height, cx, cy, radius } = dimsRef.current;
    
    // Sfondo e griglia
    ctx.fillStyle = 'rgba(0, 5, 0, 0.12)';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * (i/4), 0, Math.PI * 2);
      ctx.stroke();
    }
    
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.stroke();
    
    // Raggio di scansione
    const sweepLength = 0.4;
    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angleRef.current, angleRef.current - sweepLength, true);
    ctx.lineTo(cx, cy);
    ctx.fill();
    
    ctx.strokeStyle = '#2f2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angleRef.current) * radius, cy + Math.sin(angleRef.current) * radius);
    ctx.stroke();
    
    angleRef.current += 0.025;
    if (angleRef.current > Math.PI * 2) angleRef.current = 0;
    
    // Processa gli scoiattoli
    squirrelsRef.current.forEach((sq, idx) => {
      sq.dist -= sq.speed;
      if (sq.dist <= 15) {
        addLog(`[INTRUSIONE] L'unità scoiattolo SQ-${sq.id} ha raggiunto la posizione di Gaia! Difese attivate.`, 'alert');
        squirrelsRef.current.splice(idx, 1);
        setTimeout(() => spawnSquirrel(), Math.random() * 2000);
        return;
      }
      
      sq.x = cx + Math.cos(sq.angle) * sq.dist;
      sq.y = cy + Math.sin(sq.angle) * sq.dist;
      
      let diff = angleRef.current - sq.angle;
      while (diff < 0) diff += Math.PI * 2;
      while (diff >= Math.PI * 2) diff -= Math.PI * 2;
      
      let alpha = 0;
      let dotSize = 3;

      if (diff < sweepLength) {
        alpha = 1 - (diff / sweepLength);
        dotSize = 5;
        if (!sq.alerted && diff < 0.1) {
          sq.alerted = true;
          if (Math.random() > 0.8) {
            addLog(`Nuovo contatto SQ-${sq.id}. Distanza: ${Math.floor(sq.dist * 10)}m. Velocità d'avvicinamento confermata.`, 'info');
          }
        }
      } else {
        alpha = 0.3;
        sq.alerted = false;
      }
      
      if (alpha > 0) {
        ctx.fillStyle = `rgba(255, 30, 30, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sq.x, sq.y, dotSize, 0, Math.PI * 2);
        ctx.fill();
        
        if (alpha > 0.6) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = "red";
          ctx.fill();
          ctx.shadowBlur = 0;
          
          ctx.fillStyle = `rgba(255, 100, 100, ${alpha})`;
          ctx.font = '10px monospace';
          ctx.fillText(`SQ-${sq.id}`, sq.x + 8, sq.y + 4);
        }
      }
    });
    
    animationRef.current = requestAnimationFrame(drawRadar);
  };

  // Effetto per il Boot e l'avvio del Radar
  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    
    let logsTimeoutIds = [];
    
    addLog("Avvio Sistema Operativo S.H.I.E.L.D. v3.44...", "info");
    logsTimeoutIds.push(setTimeout(() => addLog("Inizializzazione matrice radar anti-roditore...", "info"), 800));
    logsTimeoutIds.push(setTimeout(() => addLog("Calibrazione sensori infrarossi e ottici...", "info"), 1600));
    logsTimeoutIds.push(setTimeout(() => addLog("Ricerca posizione terminale bersaglio primario: GAIA", "info"), 2400));
    
    logsTimeoutIds.push(setTimeout(() => {
      addLog("Radar ONLINE. Scansione perimetrale attiva.", "alert");
      for (let i = 0; i < SQUIRREL_COUNT; i++) spawnSquirrel(true);
      drawRadar();
      
      const generateRandomLogs = () => {
        if (Math.random() > 0.4) {
          const msg = fakeMessages[Math.floor(Math.random() * fakeMessages.length)];
          const isAlert = msg.includes("ATTENZIONE") || msg.includes("anomalo");
          addLog(msg, isAlert ? 'alert' : 'normal');
        }
        logsTimeoutIds.push(setTimeout(generateRandomLogs, 3000 + Math.random() * 5000));
      };
      generateRandomLogs();
    }, 3500));

    // Cleanup alla distruzione del componente
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
      logsTimeoutIds.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effetto per l'autoscroll del terminale
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className="radar-body">
      <div className="scanlines"></div>
      <div className="crt-flicker"></div>
      
      <header className="radar-header">
        <h1>ALLARME SCOIATTOLI</h1>
        <div className="subtitle">SISTEMA DI TRACCIAMENTO TATTICO | OBIETTIVO: GAIA</div>
      </header>
      
      <div id="radar-container" ref={containerRef}>
        <canvas id="radar" ref={canvasRef}></canvas>
        <div className="center-target">
          <div className="dot"></div>
          <div className="ping-ring"></div>
          <div className="label">GAIA</div>
        </div>
      </div>
      
      <div id="logs-panel">
        <div className="log-header">
          <span>INTERCETTAZIONI RADAR M.A.D.</span>
          <span style={{ color: 'var(--danger)' }}>LIVELLO MINACCIA: ESTREMO</span>
        </div>
        <div id="terminal">
          {logs.map((log) => (
            <div key={log.id} className={`log-entry ${log.type}`}>
              <span className="time">{log.time}</span>
              {log.message}
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
