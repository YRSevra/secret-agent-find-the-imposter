import { AvatarItem } from '../types/game';

export const AVATARS: AvatarItem[] = [
  {
    id: 'falcon',
    name: 'Operative Falcon',
    codename: 'AGENT FALCON',
    symbol: '🦅',
    badgeColor: '#00FF88',
  },
  {
    id: 'ghost',
    name: 'Phantom Ghost',
    codename: 'PHANTOM-9',
    symbol: '👤',
    badgeColor: '#38BDF8',
  },
  {
    id: 'viper',
    name: 'Tactical Viper',
    codename: 'VIPER RECON',
    symbol: '🐍',
    badgeColor: '#F59E0B',
  },
  {
    id: 'cipher',
    name: 'Crypto Cipher',
    codename: 'CIPHER 01',
    symbol: '💻',
    badgeColor: '#A855F7',
  },
  {
    id: 'shadow',
    name: 'Shadow Operative',
    codename: 'SHADOW FOX',
    symbol: '🕶️',
    badgeColor: '#94A3B8',
  },
  {
    id: 'raven',
    name: 'Night Raven',
    codename: 'RAVEN BLACK',
    symbol: '🪶',
    badgeColor: '#6366F1',
  },
  {
    id: 'specter',
    name: 'Signal Specter',
    codename: 'SPECTER SIGINT',
    symbol: '📡',
    badgeColor: '#EC4899',
  },
  {
    id: 'titan',
    name: 'Aegis Titan',
    codename: 'TITAN GUARD',
    symbol: '🛡️',
    badgeColor: '#10B981',
  },
  {
    id: 'fox',
    name: 'Sly Infiltrator',
    codename: 'FOX STEALTH',
    symbol: '🦊',
    badgeColor: '#F97316',
  },
  {
    id: 'mirage',
    name: 'Mirage Decoy',
    codename: 'MIRAGE X',
    symbol: '🎭',
    badgeColor: '#06B6D4',
  },
  {
    id: 'apex',
    name: 'Apex Striker',
    codename: 'APEX COMMAND',
    symbol: '🎯',
    badgeColor: '#EF4444',
  },
  {
    id: 'valkyrie',
    name: 'Valkyrie Handler',
    codename: 'VALKYRIE LEAD',
    symbol: '⚡',
    badgeColor: '#EAB308',
  },
];

export const DEFAULT_AVATAR_ID = 'falcon';

export const getAvatarById = (id: string): AvatarItem => {
  return AVATARS.find((a) => a.id === id) || AVATARS[0];
};
