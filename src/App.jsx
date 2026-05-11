import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThreeScene from './components/ThreeScene';
import CustomizerPage from './pages/CustomizerPage';
import { PRESETS, loadConfig, saveConfig, DEFAULT_CONFIG } from './store/ballConfig';

export default function App() {
  const [page,         setPage]         = useState('home');
  const [ballConfig,   setBallConfig]   = useState(() => loadConfig());
  const [presetIdx,    setPresetIdx]    = useState(0);
  const [presetLabel,  setPresetLabel]  = useState('');
  const [showLabel,    setShowLabel]    = useState(false);

  // ── Preset cycling ────────────────────────────────────────────────────────
  const applyPreset = useCallback((delta) => {
    setPresetIdx(prev => {
      const next = (prev + delta + PRESETS.length) % PRESETS.length;
      const preset = PRESETS[next];
      const newCfg = { ...ballConfig, ...preset };
      setBallConfig(newCfg);
      setPresetLabel(preset.name);
      setShowLabel(true);
      setTimeout(() => setShowLabel(false), 2000);
      return next;
    });
  }, [ballConfig]);

  // ── Customizer save ───────────────────────────────────────────────────────
  const handleSave = useCallback((cfg) => {
    saveConfig(cfg);
    setBallConfig(cfg);
    setPage('home');
  }, []);

  // ── Customizer page ───────────────────────────────────────────────────────
  if (page === 'customizer') {
    return (
      <CustomizerPage
        initialConfig={ballConfig}
        onSave={handleSave}
        onBack={() => setPage('home')}
      />
    );
  }

  // Derive accent color from ball's base color for UI theming
  const accent = ballConfig.baseColor || '#ea580c';

  // ── Home page ─────────────────────────────────────────────────────────────
  return (
    <>
      <ThreeScene config={ballConfig} />

      <main className="w-full">

        {/* ══════════════════════ TOP NAV BAR ═══════════════════════════════════ */}
        <nav style={{
          position:'fixed', top:0, left:0, right:0, zIndex:100,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'18px 32px',
          background:'linear-gradient(180deg,rgba(0,0,0,0.75) 0%,transparent 100%)',
          backdropFilter:'blur(4px)',
          pointerEvents:'auto',
        }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{
              width:36, height:36, borderRadius:'50%',
              border:'2px solid rgba(255,255,255,0.7)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M4.93 4.93 19.07 19.07M12 2v20M2 12h20"/>
              </svg>
            </div>
            <div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:'13px', lineHeight:1.15, letterSpacing:'0.12em', color:'#fff' }}>
              HOOPS<br/>STUDIO
            </div>
          </div>

          {/* Nav links */}
          <div style={{ display:'flex', gap:'36px', fontSize:'12px', letterSpacing:'0.12em', textTransform:'uppercase' }}>
            <span style={{ color: accent, cursor:'default', fontWeight:700 }}>Collection</span>
            <span style={{ color:'rgba(255,255,255,0.55)', cursor:'pointer' }} onClick={() => setPage('customizer')}>Customize</span>
            <span style={{ color:'rgba(255,255,255,0.55)', cursor:'pointer' }}>About</span>
          </div>

          {/* Right icons */}
          <div style={{ display:'flex', gap:'18px', alignItems:'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <div style={{ position:'relative', cursor:'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              <div style={{
                position:'absolute', top:'-6px', right:'-6px',
                width:'16px', height:'16px', borderRadius:'50%',
                background: accent, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'9px', fontWeight:900, color:'#fff',
              }}>1</div>
            </div>
          </div>
        </nav>

        {/* ═══════════════════════════════ HERO ═══════════════════════════════ */}
        <section id="hero" className="section-container h-screen flex flex-col items-center justify-center relative">

          {/* ── Main title — H O [BALL] P S ── */}
          <div style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            <h1
              className="font-bebas"
              style={{
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize: 'clamp(5rem, 21vw, 24rem)',
                lineHeight: 0.85,
                letterSpacing: '0.12em',    // more space between letters as requested
                fontWeight: 900,            // extra bold look
                color: 'rgba(255,255,255,0.22)',
                userSelect: 'none',
                gap: '0.14em',              // more gap for the ball slot
              }}
            >
              <span>H</span>
              <span>O</span>
              {/* Ball replaces the second O — slightly smaller than before for a premium fit */}
              <div
                id="ball-placeholder"
                style={{ width:'0.8em', height:'0.8em', visibility:'hidden', flexShrink:0 }}
              />
              <span>P</span>
              <span>S</span>
            </h1>
          </div>

          {/* ── Bottom info bar (like STEALTH reference) ── */}
          <div style={{
            position:'absolute', bottom:'32px', left:0, right:0,
            display:'flex', alignItems:'flex-end', justifyContent:'space-between',
            padding:'0 5%',
            pointerEvents:'auto',
            zIndex:20,
          }}>
            {/* Left: ball name + size */}
            <div>
              <AnimatePresence mode="wait">
                {showLabel ? (
                  <motion.div
                    key={presetLabel + '-label'}
                    initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
                    transition={{ duration:0.3 }}
                    style={{ fontFamily:"'Bebas Neue',cursive", fontSize:'clamp(1.6rem,3.5vw,3rem)', color: accent, lineHeight:1 }}
                  >
                    {presetLabel}
                  </motion.div>
                ) : (
                  <motion.div key="ball-name" initial={{ opacity:0 }} animate={{ opacity:1 }}>
                    <div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:'clamp(1.8rem,4vw,3.5rem)', color: accent, lineHeight:1 }}>
                      HOOPS PRO
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div style={{ fontSize:'11px', letterSpacing:'0.15em', color:'rgba(255,255,255,0.35)', textTransform:'uppercase', marginTop:'4px' }}>
                Size: 29.5″ · Official
              </div>
            </div>

            {/* Center: Customize CTA */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'6px' }}>
              <motion.button
                whileHover={{ scale:1.05, boxShadow:`0 0 28px ${accent}aa` }}
                whileTap={{ scale:0.97 }}
                onClick={() => setPage('customizer')}
                style={{
                  padding:'0.7rem 2.5rem',
                  background: accent,
                  color:'#fff', fontWeight:900, fontSize:'12px',
                  letterSpacing:'0.18em', textTransform:'uppercase',
                  borderRadius:'3px', border:'none', cursor:'pointer',
                  boxShadow:`0 0 16px ${accent}55`,
                }}
              >
                Customize Ball
              </motion.button>
              <div style={{ fontSize:'9px', letterSpacing:'0.2em', color:'rgba(255,255,255,0.25)', textTransform:'uppercase' }}>
                Click &amp; drag ball to rotate
              </div>
            </div>

            {/* Right: < > preset navigation */}
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <PresetArrow dir="left"  onClick={() => applyPreset(-1)} accent={accent} />
              <PresetArrow dir="right" onClick={() => applyPreset(+1)} accent={accent} />
            </div>
          </div>

          {/* Scroll cue — center bottom */}
          <div style={{
            position:'absolute', bottom:'120px', left:'50%', transform:'translateX(-50%)',
            display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
            opacity:0.35, pointerEvents:'none',
          }}>
            <span style={{ fontSize:'8px', letterSpacing:'0.35em', textTransform:'uppercase', color:'#fff' }}>Scroll</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
            </svg>
          </div>
        </section>


        {/* ═════════════════════════ CROSSOVER ════════════════════════════════ */}
        <section id="move-left" className="section-container h-[150vh] relative pointer-events-none">
          <div className="sticky top-0 h-screen flex items-center px-8 md:px-24">
            <h2 className="font-bebas w-full text-right" style={{
              fontSize:'clamp(4rem,10vw,10rem)',
              transform:'translateY(4rem)',
              color:'transparent',
              WebkitTextStroke:'2px rgba(255,255,255,0.85)',
              textShadow:'0 0 40px rgba(255,255,255,0.15)',
              letterSpacing:'0.05em', lineHeight:1,
            }}>CROSSOVER</h2>
          </div>
        </section>

        {/* ══════════════════════════ FAST BREAK ══════════════════════════════ */}
        <section id="move-right" className="section-container h-[150vh] relative pointer-events-none">
          <div className="sticky top-0 h-screen flex items-center px-8 md:px-24">
            <h2 className="font-bebas w-full text-left" style={{
              fontSize:'clamp(4rem,10vw,10rem)',
              transform:'translateY(-2.5rem)',
              color:'transparent',
              WebkitTextStroke:'2px rgba(255,255,255,0.85)',
              textShadow:'0 0 40px rgba(255,255,255,0.15)',
              letterSpacing:'0.05em', lineHeight:1,
            }}>FAST BREAK</h2>
          </div>
        </section>

        {/* ══════════════════════════ THE ZONE ════════════════════════════════ */}
        <section id="center-rings" className="section-container h-[200vh] relative pointer-events-none">
          <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden">

            {/* ── Technical HUD overlay (reference image) ── */}

            {/* Top centre — MICRO-TEXTURE label */}
            <div style={{
              position:'absolute', top:'18%', left:'50%',
              transform:'translateX(-50%)',
              textAlign:'center',
            }}>
              <div style={{ width:'1px', height:'30px', background:'rgba(255,255,255,0.2)', margin:'0 auto 8px' }}/>
              <div style={{ fontSize:'9px', letterSpacing:'0.28em', color:'rgba(255,255,255,0.45)', textTransform:'uppercase' }}>
                Micro-Texture
              </div>
            </div>

            {/* Bottom centre — CHANNEL DEPTH label */}
            <div style={{
              position:'absolute', bottom:'18%', left:'50%',
              transform:'translateX(-50%)',
              textAlign:'center',
            }}>
              <div style={{ fontSize:'9px', letterSpacing:'0.28em', color:'rgba(255,255,255,0.45)', textTransform:'uppercase', marginBottom:'8px' }}>
                Channel Depth
              </div>
              <div style={{ width:'1px', height:'30px', background:'rgba(255,255,255,0.2)', margin:'0 auto' }}/>
            </div>

            {/* Left — 1.2mm Pebble Height */}
            <div style={{
              position:'absolute', left:'5%', top:'50%',
              transform:'translateY(-50%)',
              color:'#fff',
            }}>
              <div style={{ fontSize:'9px', letterSpacing:'0.22em', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', marginBottom:'10px' }}>
                Micro-Texture
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ width:'3px', height:'46px', background:'rgba(255,255,255,0.8)', borderRadius:'2px' }}/>
                <div>
                  <div style={{
                    fontFamily:"'Bebas Neue',cursive",
                    fontSize:'clamp(1.8rem,3vw,2.8rem)',
                    lineHeight:1, letterSpacing:'0.04em',
                    textShadow:'0 0 20px rgba(255,255,255,0.3)',
                  }}>1.2mm</div>
                  <div style={{ fontSize:'9px', letterSpacing:'0.2em', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', marginTop:'3px' }}>
                    Pebble Height
                  </div>
                </div>
              </div>
            </div>

            {/* Left bottom — ELEVATION */}
            <div style={{
              position:'absolute', left:'5%', bottom:'32%',
              fontSize:'9px', letterSpacing:'0.14em',
              color:'rgba(255,255,255,0.35)', textTransform:'uppercase',
            }}>
              Elevation: 12.8°
            </div>

            {/* Right top — AZIMUTH */}
            <div style={{
              position:'absolute', right:'5%', top:'35%',
              fontSize:'9px', letterSpacing:'0.14em',
              color:'rgba(255,255,255,0.35)', textTransform:'uppercase',
              textAlign:'right',
            }}>
              Azimuth: 45.2°
            </div>

            {/* Right — High-Tack Coating Spec */}
            <div style={{
              position:'absolute', right:'5%', bottom:'30%',
              textAlign:'right', color:'#fff',
            }}>
              <div style={{
                fontFamily:"Georgia,'Times New Roman',serif",
                fontStyle:'italic', fontWeight:700,
                fontSize:'clamp(1.2rem,2vw,1.6rem)',
                lineHeight:1.1, letterSpacing:'0.02em',
              }}>High-Tack</div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', justifyContent:'flex-end', marginTop:'6px' }}>
                <div style={{ fontSize:'9px', letterSpacing:'0.2em', color:'rgba(255,255,255,0.4)', textTransform:'uppercase' }}>
                  Coating Spec
                </div>
                <div style={{ width:'3px', height:'28px', background:'rgba(255,255,255,0.7)', borderRadius:'2px' }}/>
              </div>
            </div>

            {/* Top-right dot indicator */}
            <div style={{
              position:'absolute', top:'5%', right:'5%',
              width:'12px', height:'12px', borderRadius:'50%',
              background:'rgba(180,180,180,0.7)',
              boxShadow:'0 0 8px rgba(255,255,255,0.3)',
            }}/>

          </div>
        </section>


        {/* ════════════════ THE CHAMPION / LEGACY ════════════════════════════ */}
        <section id="finale" className="section-container h-[200vh] relative pointer-events-none">
          <div className="sticky top-0 h-screen flex flex-col items-start justify-start pt-16 px-8 md:px-16 overflow-hidden">

            {/* Top subtitle */}
            <div style={{ width:'100%', textAlign:'center', marginBottom:'8px' }}>
              <span style={{ fontSize:'10px', letterSpacing:'0.35em', color:'rgba(255,255,255,0.4)', textTransform:'uppercase' }}>
                Limited Edition
              </span>
            </div>

            {/* Main title */}
            <div id="finale-card" style={{ width:'100%', textAlign:'center', transform:'translateY(2.5rem)', opacity:0 }}>
              <h2 className="font-bebas" style={{
                fontSize:'clamp(3rem,9vw,9rem)', color:'#ffffff',
                lineHeight:0.95, letterSpacing:'0.04em',
                textShadow:`0 0 40px ${accent}60, 0 0 80px ${accent}30`,
              }}>The Champion</h2>
            </div>

            {/* Side cards — appear at bottom flanking the ball/podium */}
            <div style={{
              position:'absolute', bottom:'8%', left:0, right:0,
              display:'flex', justifyContent:'space-between', alignItems:'flex-end',
              padding:'0 6% 0 6%',
              pointerEvents:'auto',
            }}>
              {/* Left card */}
              <div style={{ maxWidth:'220px' }}>
                <div style={{ fontSize:'10px', letterSpacing:'0.2em', color: accent, textTransform:'uppercase', marginBottom:'8px', fontWeight:700 }}>
                  Rank 01
                </div>
                <div style={{ fontSize:'clamp(1.2rem,2vw,1.5rem)', fontWeight:800, color:'#fff', marginBottom:'8px', letterSpacing:'-0.02em' }}>
                  Elite Tier
                </div>
                <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.5)', lineHeight:1.6 }}>
                  Constructed for the highest<br/>level of competition.
                </div>
              </div>

              {/* Right card */}
              <div style={{ maxWidth:'220px', textAlign:'right' }}>
                <div style={{ fontSize:'10px', letterSpacing:'0.2em', color: accent, textTransform:'uppercase', marginBottom:'8px', fontWeight:700 }}>
                  Certified
                </div>
                <div style={{ fontSize:'clamp(1.2rem,2vw,1.5rem)', fontWeight:800, color:'#fff', marginBottom:'8px', letterSpacing:'-0.02em' }}>
                  Gold Standard
                </div>
                <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.5)', lineHeight:1.6 }}>
                  Meets all regulation weight<br/>and size requirements.
                </div>
              </div>
            </div>

            {/* CTA buttons */}
            <div style={{
              position:'absolute', bottom:'4%', left:'50%', transform:'translateX(-50%)',
              display:'flex', gap:'12px',
            }}>
              <motion.button
                whileHover={{ scale:1.07, boxShadow:`0 0 36px ${accent}cc` }}
                whileTap={{ scale:0.95 }}
                style={{
                  padding:'0.75rem 2rem',
                  background: accent,
                  color:'#fff', fontWeight:700, fontSize:'0.9rem',
                  letterSpacing:'0.08em', borderRadius:'9999px',
                  border:'none', cursor:'pointer',
                  boxShadow:`0 0 20px ${accent}60`,
                }}
              >
                Enter Court
              </motion.button>

              <motion.button
                whileHover={{ scale:1.07 }}
                whileTap={{ scale:0.95 }}
                onClick={() => setPage('customizer')}
                style={{
                  padding:'0.75rem 2rem',
                  background:'transparent',
                  color:'#fff', fontWeight:700, fontSize:'0.9rem',
                  letterSpacing:'0.08em', borderRadius:'9999px',
                  border:'1px solid rgba(255,255,255,0.25)', cursor:'pointer',
                }}
              >
                Customize Ball
              </motion.button>
            </div>

          </div>
        </section>

      </main>
    </>
  );
}

// ── Preset arrow button ─────────────────────────────────────────────────────
// accent prop drives border and icon color to match current ball color
function PresetArrow({ dir, onClick, accent = '#ea580c' }) {
  return (
    <motion.button
      whileHover={{ scale:1.15, backgroundColor:`${accent}22` }}
      whileTap={{ scale:0.9 }}
      onClick={onClick}
      style={{
        width:44, height:44, borderRadius:'50%',
        background:'rgba(0,0,0,0.4)',
        border:`1px solid ${accent}66`,
        color: accent, cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'center',
        transition:'all 0.25s',
        flexShrink:0,
      }}
      aria-label={dir === 'left' ? 'Previous preset' : 'Next preset'}
    >
      {dir === 'left'
        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      }
    </motion.button>
  );
}

