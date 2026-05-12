import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomizerScene from '../components/CustomizerScene';
import {
  BASE_COLORS, LINE_COLORS,
  SEAM_VISIBILITY, LIGHTING_CONFIGS,
} from '../store/ballConfig';

const SEAM_PATTERNS = ['classic', 'cross', 'street', 'tech'];
const LIGHTINGS = ['studio', 'city', 'dawn'];
const PATTERN_LABELS = { classic: 'Classic', cross: 'Cross', street: 'Street', tech: 'Tech' };
const LIGHT_LABELS = { studio: 'Studio', city: 'City', dawn: 'Dawn' };

// Background gradient per lighting env
const PREVIEW_BG = {
  studio: 'radial-gradient(ellipse at 60% 40%, #1a2a3a 0%, #060c14 100%)',
  city: 'radial-gradient(ellipse at 60% 40%, #1c2233 0%, #080a12 100%)',
  dawn: 'radial-gradient(ellipse at 60% 40%, #2a1008 0%, #080302 100%)',
};

export default function CustomizerPage({ initialConfig, onSave, onBack }) {
  const [cfg, setCfg] = useState({ ...initialConfig });

  const set = (key, val) => setCfg(c => ({ ...c, [key]: val }));

  return (
    <div style={{
      display: 'flex', width: '100vw', height: '100vh', fontFamily: "'Inter',sans-serif", overflow: 'hidden',
      background: cfg.baseColor,
      padding: '16px', // Thick border padding matching Home Screen
      boxSizing: 'border-box',
      transition: 'background 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      <div style={{
        display: 'flex', width: '100%', height: '100%',
        borderRadius: '24px', // Matches Home Screen card rounding
        overflow: 'hidden',
        position: 'relative',
        background: '#0a0a0a',
      }}>

      {/* ═══════════════════════════ LEFT PANEL ═══════════════════════════════ */}
      <div style={{
        width: '340px', minWidth: '320px', height: '100%',
        background: '#111111', color: '#fff',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}>
        {/* Header */}
        <div style={{ padding: '28px 28px 0' }}>
          <button onClick={onBack} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)',
            cursor: 'pointer', fontSize: '12px', letterSpacing: '0.12em',
            textTransform: 'uppercase', padding: 0, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            Back to Home
          </button>

          <h1 style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '42px', lineHeight: 1, letterSpacing: '0.04em', marginBottom: '6px' }}>
            Design Your<br />Legacy
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginBottom: '32px' }}>
            Create a ball that matches your game.
          </p>
        </div>

        {/* Scrollable options */}
        <div style={{ flex: 1, padding: '0 28px', overflowY: 'auto' }}>

          {/* ─ Base Color ─ */}
          <Section label="Base Color">
            <ColorGrid
              colors={BASE_COLORS}
              value={cfg.baseColor}
              onChange={v => set('baseColor', v)}
            />
          </Section>

          {/* ─ Line Color ─ */}
          <Section label="Line Color">
            <ColorGrid
              colors={LINE_COLORS}
              value={cfg.lineColor}
              onChange={v => set('lineColor', v)}
              size={36}
            />
          </Section>

          {/* ─ Seam Pattern ─ */}
          <Section label="Seam Pattern">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {SEAM_PATTERNS.map(p => (
                <PatternBtn
                  key={p}
                  label={PATTERN_LABELS[p]}
                  active={cfg.seamPattern === p}
                  onClick={() => set('seamPattern', p)}
                />
              ))}
            </div>
          </Section>

          {/* ─ Lighting ─ */}
          <Section label="Lighting Environment">
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '8px' }}>
              {LIGHTINGS.map(l => (
                <button key={l} onClick={() => set('lighting', l)} style={{
                  flex: 1, background: 'none', border: 'none', color: cfg.lighting === l ? '#fff' : 'rgba(255,255,255,0.4)',
                  fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
                  padding: '10px 4px', cursor: 'pointer', position: 'relative',
                  borderBottom: cfg.lighting === l ? '2px solid #ea580c' : '2px solid transparent',
                  transition: 'all 0.2s',
                }}>
                  {LIGHT_LABELS[l]}
                </button>
              ))}
            </div>
            <LightingPreview env={cfg.lighting} />
          </Section>

        </div>

        {/* Save Button */}
        <div style={{ padding: '24px 28px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 0 28px rgba(234,88,12,0.6)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSave(cfg)}
            style={{
              width: '100%', padding: '16px',
              background: 'linear-gradient(135deg,#ea580c 0%,#c2410c 100%)',
              color: '#fff', fontWeight: 700, fontSize: '14px', letterSpacing: '0.15em',
              textTransform: 'uppercase', border: 'none', borderRadius: '8px',
              cursor: 'pointer', boxShadow: '0 0 20px rgba(234,88,12,0.3)',
            }}
          >
            Save & Apply to Court
          </motion.button>
        </div>
      </div>

      {/* ═══════════════════════════ RIGHT PREVIEW ════════════════════════════ */}
      <div style={{
        flex: 1,
        position: 'relative',
        background: `radial-gradient(circle at 50% 50%, ${cfg.baseColor}1a 0%, #04060a 100%)`,
        transition: 'background 0.8s ease',
      }}>
        {/* Watermark */}
        <div style={{
          position: 'absolute', top: '32px', right: '36px', zIndex: 10,
          fontFamily: "'Bebas Neue',cursive", textAlign: 'right', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 'clamp(3rem,7vw,6rem)', color: 'rgba(255,255,255,0.06)', lineHeight: 0.9, letterSpacing: '0.08em' }}>
            CUSTOM
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.15)', letterSpacing: '0.3em', marginTop: '4px' }}>
            LAB EDITION
          </div>
        </div>

        {/* Live info badge */}
        <motion.div
          key={cfg.seamPattern + cfg.lighting}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'absolute', bottom: '32px', left: '32px', zIndex: 10,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px', padding: '12px 20px',
          }}
        >
          <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '22px', letterSpacing: '0.08em' }}>
            {PATTERN_LABELS[cfg.seamPattern]} · {LIGHT_LABELS[cfg.lighting]}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginTop: '2px' }}>
            CURRENT CONFIG
          </div>
        </motion.div>

        {/* Color chips */}
        <div style={{
          position: 'absolute', bottom: '32px', right: '32px', zIndex: 10,
          display: 'flex', gap: '8px', alignItems: 'center',
        }}>
          <ColorChip color={cfg.baseColor} label="Base" />
          <ColorChip color={cfg.lineColor} label="Line" />
        </div>

        {/* 3D Preview Canvas */}
        <CustomizerScene config={cfg} />
      </div>

      </div>

      {/* Dynamic Color-Linked Border Frame Overlay for Customizer */}
      <div style={{
        position: 'fixed',
        top: '16px', left: '16px', right: '16px', bottom: '16px',
        borderRadius: '24px', // Matches the canvas window rounding
        boxShadow: `0 0 0 16px ${cfg.baseColor}`, // Fills out to screen boundaries with active base color
        pointerEvents: 'none',
        zIndex: 99990, // Under UI panels, over canvas
        transition: 'box-shadow 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
      }} />

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ label, children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{
        fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.35)', marginBottom: '12px'
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ColorGrid({ colors, value, onChange, size = 42 }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
      {colors.map(c => (
        <motion.button
          key={c}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(c)}
          style={{
            width: size, height: size,
            borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
            boxShadow: value === c
              ? `0 0 0 2px #111, 0 0 0 4px #ea580c, 0 0 16px ${c}80`
              : '0 0 0 2px rgba(255,255,255,0.1)',
            transition: 'box-shadow 0.2s',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

function PatternBtn({ label, active, onClick }) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        padding: '12px', background: active ? '#fff' : 'transparent',
        color: active ? '#000' : 'rgba(255,255,255,0.7)',
        border: `1px solid ${active ? '#fff' : 'rgba(255,255,255,0.2)'}`,
        borderRadius: '6px', fontWeight: 700, fontSize: '12px',
        letterSpacing: '0.12em', textTransform: 'uppercase',
        cursor: 'pointer', transition: 'all 0.2s',
      }}
    >
      {label}
    </motion.button>
  );
}

// Visual icon for each lighting preset
function LightingPreview({ env }) {
  const icons = {
    studio: '💡', city: '🌆', dawn: '🌅',
  };
  const descs = {
    studio: 'Strong white studio light · dramatic top-left specular',
    city: 'Cool daylight · crisp even highlights',
    dawn: 'Warm golden sunrise · rich orange-red highlights',
  };
  return (
    <motion.div
      key={env}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{
        padding: '14px', background: 'rgba(255,255,255,0.04)',
        borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '14px',
      }}
    >
      <span style={{ fontSize: '28px' }}>{icons[env]}</span>
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
        {descs[env]}
      </span>
    </motion.div>
  );
}

function ColorChip({ color, label }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: color, border: '2px solid rgba(255,255,255,0.2)',
        margin: '0 auto 4px',
      }} />
      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}
