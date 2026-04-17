import { motion } from 'framer-motion';
import { Twitch, Youtube, Instagram, Mic } from 'lucide-react';
import TikTokIcon from './TikTokIcon';

const links = [
  {
    id: 'twitch',
    title: 'Twitch',
    desc: 'Live streaming, gaming & chatting',
    icon: <Twitch size={22} />,
    url: 'https://twitch.tv/andryxify',
    color: '#9146FF',
    gradient: 'linear-gradient(135deg,rgba(145,70,255,.25),rgba(145,70,255,.08))',
  },
  {
    id: 'youtube',
    title: 'YouTube',
    desc: 'Video, highlights e approfondimenti',
    icon: <Youtube size={22} />,
    url: 'https://youtube.com/@ANDRYXify',
    color: '#FF0000',
    gradient: 'linear-gradient(135deg,rgba(255,0,0,.22),rgba(255,0,0,.07))',
  },
  {
    id: 'instagram',
    title: 'Instagram',
    desc: 'Dietro le quinte e aggiornamenti',
    icon: <Instagram size={22} />,
    url: 'https://instagram.com/andryxify',
    color: '#E1306C',
    gradient: 'linear-gradient(135deg,rgba(225,48,108,.22),rgba(225,48,108,.07))',
  },
  {
    id: 'tiktok',
    title: 'TikTok',
    desc: 'Clip divertenti e pillole di IA',
    icon: <TikTokIcon size={22} />,
    url: 'https://tiktok.com/@andryxify',
    color: '#00F2FE',
    gradient: 'linear-gradient(135deg,rgba(0,242,254,.2),rgba(0,242,254,.06))',
  },
  {
    id: 'podcast',
    title: 'Podcast',
    desc: 'Umanità o IA? — Ascolta ora',
    icon: <Mic size={22} />,
    url: 'https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9',
    color: '#1DB954',
    gradient: 'linear-gradient(135deg,rgba(29,185,84,.22),rgba(29,185,84,.07))',
  },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
};

export default function SocialHub() {
  return (
    <motion.div
      className="links-grid"
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {links.map(link => (
        <motion.a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="glass-card link-item"
          variants={item}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          style={{ background: link.gradient, borderColor: `${link.color}18` }}
        >
          <div
            className="link-icon-wrapper"
            style={{
              color: link.color,
              background: `${link.color}18`,
              border: `1px solid ${link.color}30`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,.10)`,
            }}
          >
            {link.icon}
          </div>
          <div className="link-content">
            <span className="link-title" style={{ color: link.color }}>{link.title}</span>
            <span className="link-desc">{link.desc}</span>
          </div>
          <svg style={{ marginLeft: 'auto', opacity: 0.4, flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M7 7h10v10"/></svg>
        </motion.a>
      ))}
    </motion.div>
  );
}
