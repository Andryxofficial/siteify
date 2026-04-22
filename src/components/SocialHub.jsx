import { motion } from 'framer-motion';
import { Twitch, Youtube, Instagram, Mic, ArrowUpRight } from 'lucide-react';
import TikTokIcon from './TikTokIcon';
import DiscordIcon from './DiscordIcon';
import { useLingua } from '../contexts/LinguaContext';

const LINKS_DATI = [
  { id: 'twitch',    title: 'Twitch',    descKey: 'social.twitch.desc',    icon: <Twitch     size={22} />, url: 'https://twitch.tv/andryxify',                                    color: '#9146FF' },
  { id: 'youtube',   title: 'YouTube',   descKey: 'social.youtube.desc',   icon: <Youtube    size={22} />, url: 'https://youtube.com/@ANDRYXify',                                 color: '#FF0000' },
  { id: 'instagram', title: 'Instagram', descKey: 'social.instagram.desc', icon: <Instagram  size={22} />, url: 'https://instagram.com/andryxify',                                color: '#E1306C' },
  { id: 'tiktok',    title: 'TikTok',    descKey: 'social.tiktok.desc',    icon: <TikTokIcon size={22} />, url: 'https://tiktok.com/@andryxify',                                  color: '#00F2FE' },
  { id: 'podcast',   title: 'Podcast',   descKey: 'social.podcast.desc',   icon: <Mic        size={22} />, url: 'https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9',          color: '#1DB954' },
  { id: 'discord',   title: 'Discord',   descKey: 'social.discord.desc',   icon: <DiscordIcon size={22}/>, url: 'https://discord.gg/BuckKZ4',                                     color: '#5865F2' },
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
  const { t } = useLingua();
  return (
    <motion.div
      className="links-grid"
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {LINKS_DATI.map(link => (
        <motion.a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="glass-card link-item link-item-glow"
          variants={item}
          whileHover={{ scale: 1.02, y: -3 }}
          whileTap={{ scale: 0.97 }}
          style={{
            borderColor: `${link.color}20`,
            '--card-glow': link.color,
          }}
        >
          <motion.div
            className="link-icon-wrapper"
            style={{
              color: link.color,
              background: `${link.color}18`,
              border: `1px solid ${link.color}25`,
            }}
            whileHover={{ rotate: [0, -5, 5, -3, 0], transition: { duration: 0.4 } }}
          >
            {link.icon}
          </motion.div>
          <div className="link-content">
            <span className="link-title" style={{ color: link.color }}>{link.title}</span>
            <span className="link-desc">{t(link.descKey)}</span>
          </div>
          <ArrowUpRight size={15} style={{ marginLeft: 'auto', opacity: 0.3, flexShrink: 0, color: link.color }} />
        </motion.a>
      ))}
    </motion.div>
  );
}
