'use client';

import { useEffect, useRef } from 'react';
import Navigation from '@/app/Navigation';
import AnimatedBackground from '@/app/AnimatedBackground';

const W = 1000;
const H = 400;
const GROUND = H - 60;
const GRAVITY = 0.6;
const JUMP = -13;
const OBSTACLE_SPEED_START = 5;
const PAT_W = 48;
const PAT_H = 48;
const PAT_X = 60;
const OBS_Y_OFFSET = 12;
const BOSS_W = 380;
const BOSS_H = 380;
const BOSS_FINAL_X = W - BOSS_W;

const BG_SRCS = [
  'https://i.imgur.com/wyARKng.png',
  'https://i.imgur.com/TF9aiOa.png',
  'https://i.imgur.com/39Ktzp3.png',
  'https://i.imgur.com/ExY0JlF.png',
];
const BG_THRESHOLDS = [0, 100, 200, 300];
const FADE_DURATION = 60; // frames to crossfade

type Obstacle = { x: number; w: number; h: number; type: number };


export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const patImgRef = useRef<HTMLImageElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const bgImgsRef = useRef<HTMLImageElement[]>([]);
  const obsOverlaysRef = useRef<(HTMLImageElement | null)[]>([]);
  const kaseyImgRef = useRef<HTMLImageElement>(null);
  const markImgRef = useRef<HTMLImageElement>(null);
  const fireballImgRef = useRef<HTMLImageElement | null>(null);
  const droneImgRef = useRef<HTMLImageElement | null>(null);
  const healthIconRef = useRef<HTMLImageElement | null>(null);
  const powerUpImgRef = useRef<HTMLImageElement | null>(null);
  const beamImgRef = useRef<HTMLImageElement | null>(null);
  const musicBufferRef = useRef<AudioBuffer | null>(null);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const crusherRef = useRef<ScriptProcessorNode | null>(null);
  const musicPlayingRef = useRef(false);
  const kaseyDialogIconRef = useRef<HTMLImageElement | null>(null);
  const markDialogIconRef = useRef<HTMLImageElement | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const poweringDownRef = useRef(false);
  const stopMusicFnRef = useRef<(() => void) | null>(null);
  const pauseRestartBtnRef = useRef<HTMLButtonElement>(null);
  const fullscreenBtnRef = useRef<HTMLButtonElement>(null);
  const bossImgRef = useRef<HTMLImageElement | null>(null);
  const bossLaserImgRef = useRef<HTMLImageElement | null>(null);
  const bossWarningRef = useRef<HTMLDivElement | null>(null);
  const letterboxTopRef = useRef<HTMLDivElement | null>(null);
  const letterboxBotRef = useRef<HTMLDivElement | null>(null);
  const bossOuterRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({
    running: false,
    dead: false,
    score: 0,
    hiScore: 0,
    patY: GROUND - PAT_H,
    patVY: 0,
    jumping: false,
    frame: 0,
    obstacles: [] as Obstacle[],
    obstacleTimer: 0,
    fireballs: [] as { x: number; y: number }[],
    fireballTimer: 90,
    markActive: false,
    markX: W + PAT_W + 10,
    droneTimer: 120,
    drones: [] as { x: number; y: number }[],
    killMsg: '',
    health: 3,
    invincible: 0,
    powerUps: [] as { x: number; y: number }[],
    powerUpNextScore: 60,
    patGlow: 0,
    beam: null as { x: number; y: number; vx: number; vy: number; angle: number; target: string } | null,
    kaseyStunUntil: 0,
    markStunUntil: 0,
    kaseyOffX: 0,
    markOffX: 0,
    kaseyHitFlash: 0,
    markHitFlash: 0,
    speed: OBSTACLE_SPEED_START,
    bgX: 0,
    bgIndex: 0,
    fadeFrame: 0,
    fading: false,
    paused: false,
    dialogue: null as null | {
      speaker: string;
      lines: string[];
      lineIdx: number;
      charIdx: number;
      phase: 'slidein' | 'typing' | 'wait' | 'slideout';
      slideY: number;
      waitTimer: number;
    },
    dialogueTriggers: [
      { score: 20,  done: false, speaker: 'Kasey', lines: ["Hey stranger! You've got a lot of nerve to be here.."] },
      { score: 120, done: false, speaker: 'Kasey', lines: ["Still here? The Theaneb doesn't forgive.", "Neither do I."] },
      { score: 250, done: false, speaker: 'Kasey', lines: ["You should have quit while you were ahead."] },
      { score: 310, done: false, speaker: 'Kasey', lines: ["Dad, get on with it."] },
      { score: 420, done: false, speaker: 'Mark', lines: ["Like Clockwork.."] },
    ] as { score: number; done: boolean; speaker: string; lines: string[] }[],
    bossTriggered: false,
    bossPhase: 'none' as 'none' | 'warning' | 'entering' | 'fighting' | 'dead',
    bossHealth: 5,
    bossX: W + 450,
    bossRotation: 0,
    bossLetterbox: 0,
    bossBeams: [] as { x: number; y: number; vx: number; vy: number; angle: number }[],
    bossBeamTimer: 0,
  });
  const rafRef = useRef<number>(0);

  function togglePause() {
    const s = stateRef.current;
    if (!s.running || s.dead) return;
    s.paused = !s.paused;
    const ac = audioCtxRef.current;
    if (ac) { if (s.paused) ac.suspend(); else ac.resume(); }
  }

  function toggleFullscreen() {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function jump() {
    const s = stateRef.current;
    if (s.dead) { restart(); return; }
    if (!s.running) s.running = true;
    if (!s.jumping) { s.patVY = JUMP; s.jumping = true; }
  }

  function restart() {
    const s = stateRef.current;
    s.running = true;
    s.dead = false;
    s.score = 0;
    s.patY = GROUND - PAT_H;
    s.patVY = 0;
    s.jumping = false;
    s.obstacles = [];
    s.obstacleTimer = 0;
    s.fireballs = [];
    s.fireballTimer = 90;
    s.markActive = false;
    s.markX = W + PAT_W + 10;
    s.droneTimer = 120;
    s.drones = [];
    s.health = 3;
    s.invincible = 0;
    s.powerUps = [];
    s.powerUpNextScore = 60;
    s.patGlow = 0;
    s.beam = null;
    s.kaseyStunUntil = 0;
    s.markStunUntil = 0;
    s.kaseyOffX = 0;
    s.markOffX = 0;
    s.kaseyHitFlash = 0;
    s.markHitFlash = 0;
    s.dialogue = null;
    s.dialogueTriggers.forEach(t => { t.done = false; });
    s.bossTriggered = false;
    s.bossPhase = 'none';
    s.bossHealth = 5;
    s.bossX = W + 450;
    s.bossRotation = 0;
    s.bossLetterbox = 0;
    s.bossBeams = [];
    s.bossBeamTimer = 0;
    s.speed = OBSTACLE_SPEED_START;
    s.frame = 0;
    s.bgX = 0;
    s.bgIndex = 0;
    s.fadeFrame = 0;
    s.fading = false;
    s.paused = false;
    // Cancel any power-down ramp and reset gain before restarting music
    poweringDownRef.current = false;
    const ac = audioCtxRef.current;
    const gn = gainNodeRef.current;
    if (ac && gn) {
      gn.gain.cancelScheduledValues(ac.currentTime);
      gn.gain.setValueAtTime(0.75, ac.currentTime);
    }
    if (stopMusicFnRef.current) stopMusicFnRef.current();
    if (ac && ac.state === 'suspended') ac.resume();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const patImg = patImgRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !patImg || !wrapper) return;
    const ctx = canvas.getContext('2d')!;

    // Load fireball image
    const fbImg = new Image();
    fbImg.crossOrigin = 'anonymous';
    fbImg.src = 'https://i.imgur.com/6YfhYc7.png';
    fireballImgRef.current = fbImg;

    // Load drone image
    const drImg = new Image();
    drImg.crossOrigin = 'anonymous';
    drImg.src = 'https://i.imgur.com/YNqT4px.png';
    droneImgRef.current = drImg;

    // Load health icon
    const hIcon = new Image();
    hIcon.crossOrigin = 'anonymous';
    hIcon.src = 'https://i.imgur.com/YDgdfiQ.png';
    healthIconRef.current = hIcon;

    // Load power-up and beam images
    const puImg = new Image();
    puImg.crossOrigin = 'anonymous';
    puImg.src = 'https://i.imgur.com/zPxjMuw.png';
    powerUpImgRef.current = puImg;

    const bmImg = new Image();
    bmImg.crossOrigin = 'anonymous';
    bmImg.src = 'https://i.imgur.com/O4mHbAP.png';
    beamImgRef.current = bmImg;

    // Load boss images
    const bossImg = new Image();
    bossImg.crossOrigin = 'anonymous';
    bossImg.src = 'https://i.imgur.com/u0pSn8i.png';
    bossImgRef.current = bossImg;

    const laserImg = new Image();
    laserImg.crossOrigin = 'anonymous';
    laserImg.src = 'https://i.imgur.com/jfgc6Ei.png';
    bossLaserImgRef.current = laserImg;

    // Load dialogue portraits
    const kdIcon = new Image();
    kdIcon.crossOrigin = 'anonymous';
    kdIcon.src = 'https://i.imgur.com/e9359Wi.png';
    kaseyDialogIconRef.current = kdIcon;

    const mdIcon = new Image();
    mdIcon.crossOrigin = 'anonymous';
    mdIcon.src = 'https://i.imgur.com/3BZHgvO.png';
    markDialogIconRef.current = mdIcon;

    // Setup Web Audio with 16-bit bitcrusher effect
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.75;
    gainNode.connect(audioCtx.destination);
    gainNodeRef.current = gainNode;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3500;
    filter.connect(gainNode);

    const bitDepth = 3;
    const normFreq = 0.08;
    const step = Math.pow(0.5, bitDepth);
    let phase = 0, lastL = 0, lastR = 0;
    const crusher = audioCtx.createScriptProcessor(2048, 2, 2);
    crusher.onaudioprocess = (e) => {
      const inL = e.inputBuffer.getChannelData(0);
      const inR = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : inL;
      const outL = e.outputBuffer.getChannelData(0);
      const outR = e.outputBuffer.getChannelData(1);
      for (let i = 0; i < inL.length; i++) {
        phase += normFreq;
        if (phase >= 1.0) {
          phase -= 1.0;
          lastL = step * Math.floor(inL[i] / step + 0.5);
          lastR = step * Math.floor(inR[i] / step + 0.5);
        }
        outL[i] = lastL;
        outR[i] = lastR;
      }
    };
    crusher.connect(filter);
    crusherRef.current = crusher;

    fetch('/game-music.mp3')
      .then(r => r.arrayBuffer())
      .then(buf => audioCtx.decodeAudioData(buf))
      .then(decoded => { musicBufferRef.current = decoded; })
      .catch(() => {});

    function playMusic() {
      if (!musicBufferRef.current || musicPlayingRef.current) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const src = audioCtx.createBufferSource();
      src.buffer = musicBufferRef.current;
      src.loop = true;
      src.connect(crusher);
      src.start();
      musicSourceRef.current = src;
      musicPlayingRef.current = true;
    }

    function stopMusic() {
      if (musicSourceRef.current) {
        try { musicSourceRef.current.stop(); } catch (_) {}
        musicSourceRef.current = null;
      }
      musicPlayingRef.current = false;
    }
    stopMusicFnRef.current = stopMusic;

    function powerDownMusic() {
      const src = musicSourceRef.current;
      if (!src || poweringDownRef.current) return;
      poweringDownRef.current = true;
      const duration = 2.5;
      const now = audioCtx.currentTime;
      src.playbackRate.cancelScheduledValues(now);
      src.playbackRate.setValueAtTime(1.0, now);
      src.playbackRate.linearRampToValueAtTime(0.0001, now + duration);
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(0, now + duration);
      setTimeout(() => {
        stopMusic();
        gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.75, audioCtx.currentTime);
        poweringDownRef.current = false;
      }, duration * 1000 + 100);
    }

    // Load background images
    bgImgsRef.current = BG_SRCS.map(src => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;
      return img;
    });


    const KILL_MSGS = [
      "Pat should've known better.",
      "Pat didn't make it. shocking.",
      "Pat tripped. again.",
      "Kasey is NOT sorry.",
      "Mark watched. Mark laughed.",
      "Pat: 'I got this.' Pat did not got this.",
      "This is why Matthew gave up.",
      "bro really thought he could do it",
      "Pat's Montreal citizenship: revoked.",
      "Valentina saw that and walked away.",
      "The Theaneb has claimed another victim.",
      "Pat fell. the clover did nothing.",
      "Pat: gone. Score: embarrassing.",
      "even the background looked away",
      "ngl that was rough to watch",
      "the drone had one job. it delivered.",
      "Pat was NOT built for this.",
      "Matthew would've dodged that.",
      "skill issue (respectfully)",
      "the clover chaos curse is real",
      "Kasey didn't even flinch.",
      "Pat looked both ways and still lost.",
      "Mark deployed the drone personally for this.",
      "that one hurt to watch ngl",
      "Pat's run: cut short. dreams: shattered.",
      "the obstacles won this time",
      "some things just aren't meant to be",
      "Pat fumbled the run.",
      "even Montreal is disappointed rn",
      "bro got cooked by a drone 💀",
      "Valentina saw that and felt nothing.",
      "the fireball was personal",
      "Pat really said 'hold my clover' and then this",
      "L + ratio + tripped",
      "not even close. not even a little.",
    ];

    function handleKey(e: KeyboardEvent) {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
      if (e.code === 'KeyP') { e.preventDefault(); togglePause(); }
      if (e.code === 'Digit5') {
        const s = stateRef.current;
        if (s.running && !s.dead) { s.score = 450; s.powerUpNextScore = 480; }
      }
    }
    function onFullscreenChange() {
      if (fullscreenBtnRef.current) {
        fullscreenBtnRef.current.textContent = document.fullscreenElement ? 'Exit Full' : 'Full';
      }
    }
    window.addEventListener('keydown', handleKey);
    canvas.addEventListener('click', jump);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    function drawBg(img: HTMLImageElement, alpha: number) {
      if (!img.complete || !img.naturalWidth) return;
      const s = stateRef.current;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, s.bgX, 0, W, H);
      ctx.drawImage(img, s.bgX + W, 0, W, H);
      ctx.globalAlpha = 1;
    }

    function loop() {
      const s = stateRef.current;
      const bgs = bgImgsRef.current;

      // Check for bg transition
      const score = Math.floor(s.score);
      const newIndex = [...BG_THRESHOLDS].reduce((acc, t, i) => score >= t ? i : acc, 0);
      if (newIndex !== s.bgIndex && !s.fading) {
        s.fading = true;
        s.fadeFrame = 0;
        s.bgIndex = newIndex;
      }
      if (s.fading) {
        s.fadeFrame++;
        if (s.fadeFrame >= FADE_DURATION) s.fading = false;
      }

      const fadeAlpha = s.fading ? s.fadeFrame / FADE_DURATION : 1;
      const prevIndex = (s.bgIndex - 1 + BG_SRCS.length) % BG_SRCS.length;

      // Music control
      if (s.running && !s.dead && !s.paused && !musicPlayingRef.current) playMusic();
      if (s.dead && musicPlayingRef.current && !poweringDownRef.current) powerDownMusic();

      // Scroll update
      if (s.running && !s.dead && !s.paused) {
        s.bgX -= s.speed * 0.4;
        if (s.bgX <= -W) s.bgX += W;
      }

      // Draw scrolling backgrounds — crossfade between scenes at milestones
      if (s.fading) {
        drawBg(bgs[prevIndex], 1);
        drawBg(bgs[s.bgIndex], fadeAlpha);
      } else {
        drawBg(bgs[s.bgIndex], 1);
      }

      if (s.running && !s.dead && !s.paused) {
        s.frame++;
        s.score += 0.1;
        s.speed = OBSTACLE_SPEED_START + s.score * 0.015;

        s.patVY += GRAVITY;
        s.patY += s.patVY;
        if (s.patY >= GROUND - PAT_H) {
          s.patY = GROUND - PAT_H;
          s.patVY = 0;
          s.jumping = false;
        }

        s.obstacleTimer--;
        if (s.obstacleTimer <= 0) {
          const type = Math.floor(Math.random() * 3);
          const h = type === 1 ? 30 : 40 + Math.random() * 20;
          const w = type === 1 ? 24 : 28 + Math.random() * 16;
          s.obstacles.push({ x: W + 10, w, h, type });
          s.obstacleTimer = 60 + Math.random() * 60;
        }

        s.obstacles = s.obstacles.filter(o => o.x + o.w > -10);
        for (const o of s.obstacles) o.x -= s.speed;

        const kaseyBaseX = W - PAT_W - 40;
        const kaseyBaseY = GROUND - PAT_H - 80;

        // Fireball (only when Kasey not stunned)
        if (s.kaseyStunUntil === 0) {
          s.fireballTimer--;
          if (s.fireballTimer <= 0) {
            s.fireballs.push({ x: kaseyBaseX + s.kaseyOffX, y: kaseyBaseY + PAT_H * 0.6 });
            s.fireballTimer = 90 + Math.random() * 60;
          }
        }
        s.fireballs = s.fireballs.filter(f => f.x + 20 > 0);
        for (const f of s.fireballs) f.x -= s.speed * 1.3;

        if (s.invincible > 0) s.invincible--;

        function takeDamage(dmg = 1) {
          if (s.invincible > 0) return;
          s.health -= dmg;
          s.invincible = 80;
          if (s.health <= 0) {
            s.dead = true;
            s.hiScore = Math.max(s.hiScore, Math.floor(s.score));
            s.killMsg = KILL_MSGS[Math.floor(Math.random() * KILL_MSGS.length)];
          }
        }

        const px = PAT_X + 8, py = s.patY + 6, pw = PAT_W - 16, ph = PAT_H - 10;
        for (const o of s.obstacles) {
          if (px + pw > o.x + 10 && px < o.x + o.w - 10 && py + ph > GROUND - o.h + OBS_Y_OFFSET + 10) takeDamage();
        }
        for (const f of s.fireballs) {
          if (px + pw > f.x + 4 && px < f.x + 20 && py < f.y + 20 && py + ph > f.y + 4) takeDamage();
        }

        // Mark slides in at score 300
        const markFinalX = W - PAT_W - 20;
        if (Math.floor(s.score) >= 300 && !s.markActive) {
          s.markActive = true;
          s.markX = W + PAT_W + 10;
        }
        if (s.markActive && s.markX > markFinalX) {
          s.markX = Math.max(markFinalX, s.markX - 5);
        }
        if (s.markActive && s.markX <= markFinalX && s.markStunUntil === 0) {
          s.droneTimer--;
          if (s.droneTimer <= 0) {
            s.drones.push({ x: s.markX + s.markOffX, y: GROUND - PAT_H * 0.8 });
            s.droneTimer = 80 + Math.random() * 60;
          }
        }
        s.drones = s.drones.filter(d => d.x + 48 > 0);
        for (const d of s.drones) d.x -= s.speed * 1.2;
        for (const d of s.drones) {
          if (px + pw > d.x + 6 && px < d.x + 42 && py < d.y + 34 && py + ph > d.y + 6) takeDamage();
        }

        // Boss — score-based phase transitions
        if (Math.floor(s.score) >= 500 && !s.bossTriggered) {
          s.bossTriggered = true;
          s.bossPhase = 'warning';
          s.dialogue = null; // clear any dialogue
        }
        if (s.bossPhase === 'warning' && Math.floor(s.score) >= 510) {
          s.bossPhase = 'entering';
        }
        if (s.bossPhase !== 'none') {
          // Animate rotation (0 → -10 deg when active, back to 0 when dead)
          const rotTarget = s.bossPhase === 'dead' ? 0 : -10;
          if (s.bossRotation < rotTarget) s.bossRotation = Math.min(rotTarget, s.bossRotation + 0.5);
          else if (s.bossRotation > rotTarget) s.bossRotation = Math.max(rotTarget, s.bossRotation - 0.5);
          // Animate cinematic letterbox
          const lbTarget = s.bossPhase === 'dead' ? 0 : 32;
          if (s.bossLetterbox < lbTarget) s.bossLetterbox = Math.min(lbTarget, s.bossLetterbox + 1.5);
          else if (s.bossLetterbox > lbTarget) s.bossLetterbox = Math.max(lbTarget, s.bossLetterbox - 1.5);
          // Entering — slide boss in heavily and slowly
          if (s.bossPhase === 'entering') {
            s.bossX = Math.max(BOSS_FINAL_X, s.bossX - 1.5);
            if (s.bossX <= BOSS_FINAL_X) s.bossPhase = 'fighting';
          }
          // Fighting — fire angled white beams at Pat starting at score 520
          if (s.bossPhase === 'fighting' && Math.floor(s.score) >= 520) {
            s.bossBeamTimer--;
            if (s.bossBeamTimer <= 0) {
              const startX = s.bossX + 10;
              const startY = GROUND - BOSS_H * 0.55;
              const tx = PAT_X + PAT_W / 2;
              const ty = s.patY + PAT_H / 2;
              const dx = tx - startX, dy = ty - startY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const spd = 7;
              s.bossBeams.push({ x: startX, y: startY, vx: (dx / dist) * spd, vy: (dy / dist) * spd, angle: Math.atan2(dy, dx) });
              s.bossBeamTimer = 110 + Math.floor(Math.random() * 80);
            }
          }
          // Move boss beams + hit detection
          for (const b of s.bossBeams) { b.x += b.vx; b.y += b.vy; }
          s.bossBeams = s.bossBeams.filter(b => b.x > -80 && b.x < W + 80 && b.y > -80 && b.y < H + 80);
          for (const b of s.bossBeams) {
            if (px + pw > b.x - 28 && px < b.x + 28 && py + ph > b.y - 12 && py < b.y + 12) takeDamage(2);
          }
          // Dead — slide boss back out right
          if (s.bossPhase === 'dead') {
            s.bossX += 4;
            s.bossBeams = [];
            if (s.bossX > W + 500) s.bossPhase = 'none';
          }
        }

        // Power-up spawn — every 30 during boss fight, else every 60
        const puInterval = s.bossPhase === 'fighting' ? 30 : 60;
        if (Math.floor(s.score) >= s.powerUpNextScore) {
          s.powerUps.push({ x: W + 20, y: GROUND - 48 });
          s.powerUpNextScore += puInterval;
        }
        for (const p of s.powerUps) p.x -= s.speed;
        s.powerUps = s.powerUps.filter(p => p.x + 48 > 0);

        // Pat picks up power-up
        for (let i = s.powerUps.length - 1; i >= 0; i--) {
          const p = s.powerUps[i];
          if (PAT_X + PAT_W > p.x + 4 && PAT_X < p.x + 44 && s.patY + PAT_H > p.y + 4) {
            s.powerUps.splice(i, 1);
            s.health = 3;
            s.invincible = 120;
            s.patGlow = 40;
            // Fire beam at random available target
            const targets: string[] = [];
            if (s.kaseyStunUntil === 0) targets.push('kasey');
            if (s.markActive && s.markStunUntil === 0) targets.push('mark');
            if (s.bossPhase === 'fighting') targets.push('boss');
            if (targets.length > 0) {
              const target = targets[Math.floor(Math.random() * targets.length)];
              const patCX = PAT_X + PAT_W / 2;
              const patCY = s.patY + PAT_H / 2;
              let angle = 0;
              if (target === 'kasey') {
                const tx = kaseyBaseX + PAT_W / 2;
                const ty = kaseyBaseY + PAT_H / 2;
                angle = Math.atan2(ty - patCY, tx - patCX);
              } else if (target === 'boss') {
                const tx = s.bossX + BOSS_W / 2;
                const ty = GROUND - BOSS_H / 2;
                angle = Math.atan2(ty - patCY, tx - patCX);
              }
              // mark is at ground level → angle = 0 (horizontal)
              const spd = 10;
              s.beam = { x: patCX, y: patCY, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, angle, target };
            }
          }
        }

        // Beam movement + hit detection
        if (s.beam) {
          s.beam.x += s.beam.vx;
          s.beam.y += s.beam.vy;
          const kaseyVisX = kaseyBaseX + s.kaseyOffX;
          const kaseyVisY = kaseyBaseY;
          if (s.beam.target === 'kasey' && s.beam.x > kaseyVisX && s.beam.x < kaseyVisX + PAT_W && s.beam.y > kaseyVisY && s.beam.y < kaseyVisY + PAT_H) {
            s.kaseyStunUntil = s.score + 60;
            s.kaseyHitFlash = 30;
            s.fireballs = [];
            s.beam = null;
          }
          const markVisX = s.markX + s.markOffX;
          if (s.beam && s.beam.target === 'mark' && s.markActive && s.beam.x > markVisX && s.beam.x < markVisX + PAT_W && s.beam.y > GROUND - PAT_H && s.beam.y < GROUND) {
            s.markStunUntil = s.score + 60;
            s.markHitFlash = 30;
            s.drones = [];
            s.beam = null;
          }
          if (s.beam && s.beam.target === 'boss' && s.bossPhase === 'fighting') {
            if (s.beam.x > s.bossX && s.beam.x < s.bossX + BOSS_W && s.beam.y > GROUND - BOSS_H && s.beam.y < GROUND) {
              s.bossHealth--;
              s.beam = null;
              if (s.bossHealth <= 0) { s.bossPhase = 'dead'; s.bossBeams = []; }
            }
          }
          if (s.beam && (s.beam.x > W + 60 || s.beam.y < -60 || s.beam.y > H + 60)) s.beam = null;
        }

        // Kasey retreat / return
        if (s.kaseyStunUntil > 0) {
          if (s.score < s.kaseyStunUntil) {
            s.kaseyOffX = Math.min(s.kaseyOffX + 7, W + PAT_W);
          } else {
            s.kaseyOffX = Math.max(0, s.kaseyOffX - 7);
            if (s.kaseyOffX === 0) s.kaseyStunUntil = 0;
          }
        }
        // Mark retreat / return
        if (s.markStunUntil > 0) {
          if (s.score < s.markStunUntil) {
            s.markOffX = Math.min(s.markOffX + 7, W + PAT_W);
          } else {
            s.markOffX = Math.max(0, s.markOffX - 7);
            if (s.markOffX === 0) s.markStunUntil = 0;
          }
        }

        if (s.patGlow > 0) s.patGlow--;
        if (s.kaseyHitFlash > 0) s.kaseyHitFlash--;
        if (s.markHitFlash > 0) s.markHitFlash--;

        // Dialogue triggers — suppressed during boss phases
        if (!s.dialogue && s.bossPhase === 'none') {
          for (const t of s.dialogueTriggers) {
            if (!t.done && Math.floor(s.score) >= t.score) {
              t.done = true;
              s.dialogue = { speaker: t.speaker, lines: t.lines, lineIdx: 0, charIdx: 0, phase: 'slidein', slideY: 90, waitTimer: 0 };
              break;
            }
          }
        }

        // Dialogue state machine
        if (s.dialogue) {
          const d = s.dialogue;
          if (d.phase === 'slidein') {
            d.slideY = Math.max(0, d.slideY - 8);
            if (d.slideY === 0) d.phase = 'typing';
          } else if (d.phase === 'typing') {
            if (s.frame % 2 === 0) d.charIdx++;
            const line = d.lines[d.lineIdx] ?? '';
            if (d.charIdx >= line.length) {
              d.charIdx = line.length;
              if (d.lineIdx < d.lines.length - 1) {
                // short pause then next line
                d.waitTimer++;
                if (d.waitTimer >= 40) { d.lineIdx++; d.charIdx = 0; d.waitTimer = 0; }
              } else {
                d.phase = 'wait';
                d.waitTimer = 200;
              }
            }
          } else if (d.phase === 'wait') {
            d.waitTimer--;
            if (d.waitTimer <= 0) d.phase = 'slideout';
          } else if (d.phase === 'slideout') {
            d.slideY = Math.min(90, d.slideY + 8);
            if (d.slideY >= 90) s.dialogue = null;
          }
        }
      }

      // Draw fireballs
      const fbImg = fireballImgRef.current;
      if (fbImg && fbImg.complete && fbImg.naturalWidth) {
        for (const f of s.fireballs) ctx.drawImage(fbImg, f.x, f.y, 22, 22);
      }

      // Draw drones
      const drImg = droneImgRef.current;
      if (drImg && drImg.complete && drImg.naturalWidth) {
        for (const d of s.drones) ctx.drawImage(drImg, d.x, d.y, 48, 40);
      }

      // Draw power-ups
      const puImg = powerUpImgRef.current;
      if (puImg && puImg.complete && puImg.naturalWidth) {
        for (const p of s.powerUps) ctx.drawImage(puImg, p.x, p.y, 48, 48);
      }

      // Draw beam (rotated toward target)
      if (s.beam) {
        const bmImg = beamImgRef.current;
        if (bmImg && bmImg.complete && bmImg.naturalWidth) {
          ctx.save();
          ctx.translate(s.beam.x, s.beam.y);
          ctx.rotate(s.beam.angle);
          ctx.drawImage(bmImg, -40, -20, 80, 40);
          ctx.restore();
        }
      }

      // Pat green glow
      if (s.patGlow > 0) {
        ctx.save();
        ctx.globalAlpha = (s.patGlow / 40) * 0.6;
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(PAT_X + PAT_W / 2, s.patY + PAT_H / 2, PAT_W * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Kasey red hit flash
      if (s.kaseyHitFlash > 0) {
        ctx.save();
        ctx.globalAlpha = (s.kaseyHitFlash / 30) * 0.6;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect((W - PAT_W - 40) + s.kaseyOffX, GROUND - PAT_H - 80, PAT_W, PAT_H);
        ctx.restore();
      }

      // Mark red hit flash
      if (s.markHitFlash > 0 && s.markActive) {
        ctx.save();
        ctx.globalAlpha = (s.markHitFlash / 30) * 0.6;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(s.markX + s.markOffX, GROUND - PAT_H, PAT_W, PAT_H);
        ctx.restore();
      }

      // ── Boss drawing ──────────────────────────────────────────────────────
      if (s.bossPhase !== 'none') {
        // Red cinematic dim — intensity tied to rotation progress
        const dimAlpha = Math.min(0.4, (Math.abs(s.bossRotation) / 10) * 0.4);
        ctx.save();
        ctx.globalAlpha = dimAlpha;
        ctx.fillStyle = '#1a0000';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // Boss machine
        const bImg = bossImgRef.current;
        if (bImg && bImg.complete && bImg.naturalWidth && s.bossPhase !== 'warning') {
          ctx.drawImage(bImg, s.bossX, GROUND - BOSS_H, BOSS_W, BOSS_H);
        }

        // Boss white angled beams (like Kasey fireballs but white)
        for (const b of s.bossBeams) {
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.rotate(b.angle);
          // outer glow
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = '#99ccff';
          ctx.fillRect(-54, -15, 108, 30);
          // main beam
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = '#ddeeff';
          ctx.fillRect(-50, -8, 100, 16);
          // bright white core
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-50, -4, 100, 8);
          ctx.restore();
        }

        // Boss health bar (bottom-center of canvas)
        if (s.bossPhase === 'entering' || s.bossPhase === 'fighting') {
          const bBarW = 300, bBarH = 14;
          const bBarX = (W - bBarW) / 2, bBarY = H - 38;
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(bBarX - 6, bBarY - 22, bBarW + 12, bBarH + 30);
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('THE STARGAZER', W / 2, bBarY - 6);
          ctx.textAlign = 'left';
          ctx.fillStyle = '#3b0d0d';
          ctx.fillRect(bBarX, bBarY, bBarW, bBarH);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(bBarX, bBarY, bBarW * (s.bossHealth / 5), bBarH);
          ctx.strokeStyle = '#ff6666';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bBarX, bBarY, bBarW, bBarH);
        }
      }

      // Shared scale + canvas offset (accounts for black bars in fullscreen)
      const canvasRect = canvas!.getBoundingClientRect();
      const wrapperRect = wrapper!.getBoundingClientRect();
      const scale = canvasRect.width / W;
      const cLeft = canvasRect.left - wrapperRect.left;
      const cTop = canvasRect.top - wrapperRect.top;
      function cx(x: number) { return cLeft + x * scale; }
      function cy(y: number) { return cTop + y * scale; }

      // Position obstacle GIF overlays
      {
        const overlays = obsOverlaysRef.current;
        s.obstacles.forEach((o, i) => {
          const el = overlays[i];
          if (!el) return;
          el.style.display = 'block';
          el.style.left = `${cx(o.x)}px`;
          el.style.top = `${cy(GROUND - o.h + OBS_Y_OFFSET)}px`;
          el.style.width = `${o.w * scale}px`;
          el.style.height = `${o.h * scale}px`;
        });
        for (let i = s.obstacles.length; i < overlays.length; i++) {
          const el = overlays[i];
          if (el) el.style.display = 'none';
        }
      }

      // Move Pat GIF overlay
      if (patImg) {
        patImg.style.left = `${cx(PAT_X)}px`;
        patImg.style.top = `${cy(s.patY)}px`;
        patImg.style.width = `${PAT_W * scale}px`;
        patImg.style.height = `${PAT_H * scale}px`;
        patImg.style.opacity = s.invincible > 0 && Math.floor(s.invincible / 8) % 2 === 0 ? '0.3' : '1';
      }

      // Kasey levitation
      const kaseyImg = kaseyImgRef.current;
      if (kaseyImg) {
        const kaseyX = W - PAT_W - 40;
        const kaseyBaseY = GROUND - PAT_H - 80;
        const kaseyY = kaseyBaseY + Math.sin(s.frame * 0.06) * 5;
        kaseyImg.style.left = `${cx(kaseyX + s.kaseyOffX)}px`;
        kaseyImg.style.top = `${cy(kaseyY)}px`;
        kaseyImg.style.width = `${PAT_W * scale}px`;
        kaseyImg.style.height = `${PAT_H * scale}px`;
      }

      // Mark overlay
      const markImg = markImgRef.current;
      if (markImg && s.markActive) {
        markImg.style.display = 'block';
        markImg.style.left = `${cx(s.markX + s.markOffX)}px`;
        markImg.style.top = `${cy(GROUND - PAT_H)}px`;
        markImg.style.width = `${PAT_W * scale}px`;
        markImg.style.height = `${PAT_H * scale}px`;
      } else if (markImg && !s.markActive) {
        markImg.style.display = 'none';
      }

      // Dialogue box — compact, slides down from top
      if (s.dialogue) {
        const d = s.dialogue;
        const BOX_H = 72;
        const BANNER_H = 18;
        const ICON_SIZE = 48;
        const bw = 560;
        const bx = (W - bw) / 2;
        const by = 6 - d.slideY; // slides from above canvas down to y=6

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(bx + 3, by + 3, bw, BOX_H);
        // Main background
        ctx.fillStyle = 'rgba(3, 8, 3, 0.97)';
        ctx.fillRect(bx, by, bw, BOX_H);
        // Green name banner at top
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(bx, by, bw, BANNER_H);
        // "KASEY:" label in banner
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${d.speaker}:`, bx + 8, by + 13);
        // Border
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, by, bw, BOX_H);

        // Portrait icon clipped to square
        const kdIcon = d.speaker === 'Mark' ? markDialogIconRef.current : kaseyDialogIconRef.current;
        const iconX = bx + 8;
        const iconY = by + BANNER_H + (BOX_H - BANNER_H - ICON_SIZE) / 2;
        if (kdIcon && kdIcon.complete && kdIcon.naturalWidth) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(iconX, iconY, ICON_SIZE, ICON_SIZE);
          ctx.clip();
          ctx.drawImage(kdIcon, iconX, iconY, ICON_SIZE, ICON_SIZE);
          ctx.restore();
          ctx.strokeStyle = 'rgba(74,222,128,0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(iconX, iconY, ICON_SIZE, ICON_SIZE);
        }

        // Typed dialogue lines
        const textX = iconX + ICON_SIZE + 10;
        const textAreaH = BOX_H - BANNER_H;
        const lineH = 17;
        const totalTextH = d.lines.length * lineH;
        const textStartY = by + BANNER_H + (textAreaH - totalTextH) / 2 + 12;
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '12px monospace';
        for (let li = 0; li <= d.lineIdx; li++) {
          const line = d.lines[li] ?? '';
          const displayed = li < d.lineIdx ? line : line.substring(0, d.charIdx);
          ctx.fillText(displayed, textX, textStartY + li * lineH);
        }

        // Blinking cursor while typing
        if (d.phase === 'typing' && Math.floor(s.frame / 15) % 2 === 0) {
          const current = (d.lines[d.lineIdx] ?? '').substring(0, d.charIdx);
          const tw = ctx.measureText(current).width;
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(textX + tw + 2, textStartY + d.lineIdx * lineH - 10, 2, 11);
        }

        ctx.textAlign = 'left';
      }

      // Health bar (top left)
      const iconSize = 28;
      const barW = 90;
      const barH = 12;
      const hx = 10, hy = 10;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(hx - 4, hy - 4, iconSize + barW + 20, iconSize + 8);
      const hIcon = healthIconRef.current;
      if (hIcon && hIcon.complete && hIcon.naturalWidth) {
        ctx.drawImage(hIcon, hx, hy, iconSize, iconSize);
      }
      const bx = hx + iconSize + 8;
      const by = hy + (iconSize - barH) / 2;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(bx, by, barW, barH);
      const healthFrac = Math.max(0, s.health) / 3;
      ctx.fillStyle = healthFrac > 0.6 ? '#4ade80' : healthFrac > 0.3 ? '#fbbf24' : '#ef4444';
      ctx.fillRect(bx, by, barW * healthFrac, barH);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, barW, barH);

      // Score + bg name
      const bgNames = ['Montreal', 'The Theaneb', 'The City', 'The Bunker'];
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(W - 170, 8, 162, 50);
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`SCORE ${Math.floor(s.score).toString().padStart(5, '0')}`, W - 160, 26);
      ctx.fillText(`HI    ${s.hiScore.toString().padStart(5, '0')}`, W - 160, 44);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '11px monospace';
      ctx.fillText(bgNames[s.bgIndex], 12, H - 10);

      if (!s.running && !s.dead) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CLOVER CHAOS', W / 2, H / 2 - 30);
        ctx.font = '15px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Press SPACE or tap to start', W / 2, H / 2 + 10);
        ctx.textAlign = 'left';
      }

      if (s.dead) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PAT TRIPPED', W / 2, H / 2 - 40);
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'italic 15px monospace';
        ctx.fillText(s.killMsg, W / 2, H / 2 - 10);
        ctx.fillStyle = '#4ade80';
        ctx.font = '16px monospace';
        ctx.fillText(`Score: ${Math.floor(s.score)}   Best: ${s.hiScore}`, W / 2, H / 2 + 20);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px monospace';
        ctx.fillText('Press SPACE or tap to retry', W / 2, H / 2 + 50);
        ctx.textAlign = 'left';
      }

      if (pauseRestartBtnRef.current) {
        pauseRestartBtnRef.current.style.display = s.paused ? 'block' : 'none';
      }

      // Boss overlay updates (wrapper rotation, letterbox, warning sign)
      if (wrapper) {
        wrapper.style.transform = s.bossPhase !== 'none' ? `rotate(${s.bossRotation}deg)` : '';
        wrapper.style.transition = 'transform 0.3s ease';
      }
      const lbPct = (s.bossLetterbox / H * 100).toFixed(2) + '%';
      if (letterboxTopRef.current) letterboxTopRef.current.style.height = lbPct;
      if (letterboxBotRef.current) letterboxBotRef.current.style.height = lbPct;
      if (bossWarningRef.current) {
        bossWarningRef.current.style.display = s.bossPhase === 'warning' ? 'block' : 'none';
      }

      if (s.paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', W / 2, H / 2 - 10);
        ctx.font = '14px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Press P or click II to resume', W / 2, H / 2 + 24);
        ctx.textAlign = 'left';
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', handleKey);
      canvas.removeEventListener('click', jump);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      stopMusic();
      audioCtx.close();
    };
  }, []);

  return (
    <main>
      <AnimatedBackground />
      <Navigation />

      <section className="game-section" style={{ padding: '140px 20px 100px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="game-title-block" style={{ marginBottom: '32px' }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '2px', color: '#4ade80', marginBottom: '12px', textTransform: 'uppercase' }}>Mini Game</span>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 56px)', fontFamily: 'Cubano, var(--font-display)', color: '#4ade80', marginBottom: '8px' }}>Clover Chaos Mini Game</h1>
            <p style={{ color: '#64748b', fontSize: '14px', fontFamily: 'var(--font-mono)' }}>Pat must do what he should&apos;ve done since the very beginning. Vanquish.</p>
          </div>

          <div ref={bossOuterRef} style={{ position: 'relative', width: '100%', maxWidth: W }}>
            {/* Warning sign — stays upright outside the rotating wrapper */}
            <div
              ref={bossWarningRef}
              style={{
                display: 'none', position: 'absolute', inset: 0, zIndex: 30,
                backgroundImage: 'url(https://i.imgur.com/5SXVpUj.png)',
                backgroundSize: 'cover', backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center', pointerEvents: 'none',
              }}
            />
          <div
            ref={wrapperRef}
            className="game-wrapper"
            style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden', border: '2px solid rgba(74,222,128,0.3)', boxShadow: '0 0 40px rgba(74,222,128,0.1)' }}
          >
            {/* Cinematic letterbox bars — inside wrapper so they tilt with the game */}
            <div ref={letterboxTopRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '0%', background: '#000', zIndex: 20, pointerEvents: 'none' }} />
            <div ref={letterboxBotRef} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '0%', background: '#000', zIndex: 20, pointerEvents: 'none' }} />
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              style={{ display: 'block', width: '100%', imageRendering: 'pixelated', cursor: 'pointer' }}
            />
            <img
              ref={patImgRef}
              src="https://i.imgur.com/DwSXcd6.gif"
              alt="Pat"
              style={{ position: 'absolute', imageRendering: 'pixelated', pointerEvents: 'none' }}
            />
            <img
              ref={kaseyImgRef}
              src="https://i.imgur.com/oyw5tMc.gif"
              alt="Kasey"
              style={{ position: 'absolute', imageRendering: 'pixelated', pointerEvents: 'none' }}
            />
            <img
              ref={markImgRef}
              src="https://i.imgur.com/apmHfXF.gif"
              alt="Mark"
              style={{ position: 'absolute', imageRendering: 'pixelated', pointerEvents: 'none', display: 'none' }}
            />
            <div style={{ position: 'absolute', top: '12%', left: '1%', zIndex: 10, display: 'flex', gap: '4px' }}>
              <button
                onClick={(e) => { e.stopPropagation(); togglePause(); }}
                style={{
                  background: 'rgba(0,0,0,0.85)', border: '2px solid #4ade80',
                  color: '#4ade80', fontFamily: 'monospace', fontSize: '11px',
                  padding: '4px 10px', borderRadius: 0, cursor: 'pointer',
                  letterSpacing: '2px', textTransform: 'uppercase',
                  boxShadow: '2px 2px 0px #1a6b3a',
                }}
              >
                II
              </button>
              <button
                ref={fullscreenBtnRef}
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                style={{
                  background: 'rgba(0,0,0,0.85)', border: '2px solid #4ade80',
                  color: '#4ade80', fontFamily: 'monospace', fontSize: '11px',
                  padding: '4px 10px', borderRadius: 0, cursor: 'pointer',
                  letterSpacing: '2px', textTransform: 'uppercase',
                  boxShadow: '2px 2px 0px #1a6b3a',
                }}
              >
                Full
              </button>
            </div>
            <button
              ref={pauseRestartBtnRef}
              onClick={(e) => { e.stopPropagation(); restart(); }}
              style={{
                position: 'absolute', top: '50%', left: '50%', zIndex: 11,
                transform: 'translate(-50%, 32px)',
                display: 'none',
                background: 'rgba(0,0,0,0.92)', border: '2px solid #4ade80',
                color: '#4ade80', fontFamily: 'monospace', fontSize: '13px',
                padding: '8px 28px', borderRadius: 0, cursor: 'pointer',
                letterSpacing: '3px', textTransform: 'uppercase',
                boxShadow: '3px 3px 0px #1a6b3a',
              }}
            >
              Restart
            </button>
            {[0,1,2,3,4].map(i => (
              <img
                key={i}
                ref={el => { obsOverlaysRef.current[i] = el; }}
                src="https://i.imgur.com/QjgJmZv.gif"
                alt=""
                style={{ position: 'absolute', imageRendering: 'pixelated', pointerEvents: 'none', display: 'none' }}
              />
            ))}
          </div>
          </div>{/* end bossOuterRef */}

          <div className="game-controls" style={{ marginTop: '16px', display: 'flex', gap: '24px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#475569' }}>
            <span>SPACE / ↑ — jump</span>
            <span>TAP — jump on mobile</span>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 900px) and (orientation: landscape) {
          .game-section { padding: 52px 10px 8px !important; }
          .game-title-block { display: none !important; }
          .game-controls { display: none !important; }
        }
        .game-wrapper:fullscreen,
        .game-wrapper:-webkit-full-screen {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: #000 !important;
          width: 100vw !important;
          height: 100vh !important;
          max-width: none !important;
          border-radius: 0 !important;
          border: none !important;
          overflow: visible !important;
        }
        .game-wrapper:fullscreen canvas,
        .game-wrapper:-webkit-full-screen canvas {
          width: min(100vw, calc(100vh * 1000 / 400)) !important;
          height: auto !important;
          max-width: 100vw !important;
          max-height: 100vh !important;
          image-rendering: pixelated;
        }
      `}</style>
    </main>
  );
}
