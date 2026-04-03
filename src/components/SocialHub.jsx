import { motion } from 'framer-motion';
import { Twitch, Youtube, Instagram, Music } from 'lucide-react';

const links = [
  {
    id: 'twitch',
    title: 'Twitch',
    desc: 'Live streaming, gaming & chatting',
    icon: <Twitch size={24} />,
    url: 'https://twitch.tv/andryxify',
    color: '#9146FF'
  },
  {
    id: 'youtube',
    title: 'YouTube',
    desc: 'Video, highlights e approfondimenti',
    icon: <Youtube size={24} />,
    url: 'https://youtube.com/@ANDRYXify',
    color: '#FF0000'
  },
  {
    id: 'instagram',
    title: 'Instagram',
    desc: 'Dietro le quinte e aggiornamenti',
    icon: <Instagram size={24} />,
    url: 'https://instagram.com/andryxify',
    color: '#E1306C'
  },
  {
    id: 'tiktok',
    title: 'TikTok',
    desc: 'Clip divertenti e pillole di IA',
    icon: <Music size={24} />,
    url: 'https://tiktok.com/@andryxify',
    color: '#00F2FE'
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  }
};

export default function SocialHub() {
  return (
    <motion.div 
      className="links-grid"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {links.map((link) => (
        <motion.a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="glass-card link-item"
          variants={itemVariants}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="link-icon-wrapper" style={{ color: link.color }}>
            {link.icon}
          </div>
          <div className="link-content">
            <span className="link-title">{link.title}</span>
            <span className="link-desc">{link.desc}</span>
          </div>
        </motion.a>
      ))}
    </motion.div>
  );
}
