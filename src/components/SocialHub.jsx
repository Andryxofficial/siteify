import { motion } from 'framer-motion';
import { Twitch, Youtube, Instagram, Mic, ArrowUpRight } from 'lucide-react';
import TikTokIcon from './TikTokIcon';

const links = [
  {
    id: 'twitch',
    title: 'Twitch',
    desc: 'Live streaming, gaming & chatting',
    icon: <Twitch size={22} />,
    url: 'https://twitch.tv/andryxify',
    color: '#9146FF',
  },
  {
    id: 'youtube',
    title: 'YouTube',
    desc: 'Video, highlights e approfondimenti',
    icon: <Youtube size={22} />,
    url: 'https://youtube.com/@ANDRYXify',
    color: '#FF0000',
  },
  {
    id: 'instagram',
    title: 'Instagram',
    desc: 'Dietro le quinte e aggiornamenti',
    icon: <Instagram size={22} />,
    url: 'https://instagram.com/andryxify',
    color: '#E1306C',
  },
  {
    id: 'tiktok',
    title: 'TikTok',
    desc: 'Clip divertenti e pillole di IA',
    icon: <TikTokIcon size={22} />,
    url: 'https://tiktok.com/@andryxify',
    color: '#00F2FE',
  },
  {
    id: 'podcast',
    title: 'Podcast',
    desc: 'Umanità o IA? — Ascolta ora',
    icon: <Mic size={22} />,
    url: 'https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9',
    color: '#1DB954',
  },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 24 } },
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
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          style={{
            borderColor: `${link.color}20`,
          }}
        >
          <div
            className="link-icon-wrapper"
            style={{
              color: link.color,
              background: `${link.color}18`,
              border: `1px solid ${link.color}25`,
            }}
          >
            {link.icon}
          </div>
          <div className="link-content">
            <span className="link-title" style={{ color: link.color }}>{link.title}</span>
            <span className="link-desc">{link.desc}</span>
          </div>
          <ArrowUpRight size={15} style={{ marginLeft: 'auto', opacity: 0.3, flexShrink: 0, color: link.color }} />
        </motion.a>
      ))}
    </motion.div>
  );
}
