export default function Footer() {
  return (
    <footer className="footer glass-panel" style={{ margin: '4rem auto 2rem', padding: '2rem', width: '95%', maxWidth: '1000px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div style={{ textAlign: 'left' }}>
          <h2 className="text-gradient" style={{ margin: 0, fontSize: '1.5rem' }}>ANDRYXify</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Exploration of Humanity, AI & Gaming.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <a href="https://twitch.tv/andryxify" target="_blank" rel="noreferrer" className="nav-link">Twitch</a>
          <a href="https://youtube.com/@ANDRYXify" target="_blank" rel="noreferrer" className="nav-link">YouTube</a>
          <a href="https://instagram.com/andryxify" target="_blank" rel="noreferrer" className="nav-link">Instagram</a>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '2rem', paddingTop: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        &copy; {new Date().getFullYear()} ANDRYXify. Built with &hearts; for the future.
      </div>
    </footer>
  );
}
