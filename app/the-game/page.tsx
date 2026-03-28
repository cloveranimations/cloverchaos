'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
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
const BOSS_W = 420;
const BOSS_H = 330;
const BOSS_FINAL_X = W - BOSS_W + 60;

// Minecraft-style pixel cracks — tight, dark, centered on boss chest. dmg = hits taken.
const BOSS_CRACKS = [
  // dmg 1 — tiny central fracture
  { x1: 190, y1: 212, x2: 203, y2: 200, dmg: 1 },
  { x1: 190, y1: 212, x2: 178, y2: 222, dmg: 1 },
  { x1: 190, y1: 212, x2: 198, y2: 226, dmg: 1 },
  { x1: 190, y1: 212, x2: 180, y2: 200, dmg: 1 },
  // dmg 2 — extends outward with branches
  { x1: 203, y1: 200, x2: 214, y2: 190, dmg: 2 },
  { x1: 203, y1: 200, x2: 213, y2: 204, dmg: 2 },
  { x1: 178, y1: 222, x2: 166, y2: 231, dmg: 2 },
  { x1: 198, y1: 226, x2: 207, y2: 238, dmg: 2 },
  { x1: 198, y1: 226, x2: 193, y2: 241, dmg: 2 },
  { x1: 180, y1: 200, x2: 170, y2: 192, dmg: 2 },
  // dmg 3 — more arms, slight spread
  { x1: 214, y1: 190, x2: 226, y2: 180, dmg: 3 },
  { x1: 213, y1: 204, x2: 225, y2: 211, dmg: 3 },
  { x1: 166, y1: 231, x2: 155, y2: 241, dmg: 3 },
  { x1: 166, y1: 231, x2: 160, y2: 221, dmg: 3 },
  { x1: 207, y1: 238, x2: 216, y2: 250, dmg: 3 },
  { x1: 193, y1: 241, x2: 187, y2: 255, dmg: 3 },
  { x1: 170, y1: 192, x2: 161, y2: 183, dmg: 3 },
  { x1: 190, y1: 212, x2: 194, y2: 185, dmg: 3 },
  // dmg 4 — heavy fracture network
  { x1: 226, y1: 180, x2: 240, y2: 169, dmg: 4 },
  { x1: 226, y1: 180, x2: 231, y2: 192, dmg: 4 },
  { x1: 225, y1: 211, x2: 237, y2: 220, dmg: 4 },
  { x1: 155, y1: 241, x2: 144, y2: 251, dmg: 4 },
  { x1: 216, y1: 250, x2: 225, y2: 264, dmg: 4 },
  { x1: 187, y1: 255, x2: 181, y2: 269, dmg: 4 },
  { x1: 161, y1: 183, x2: 150, y2: 174, dmg: 4 },
  { x1: 194, y1: 185, x2: 198, y2: 170, dmg: 4 },
  { x1: 194, y1: 185, x2: 186, y2: 173, dmg: 4 },
];

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
  const { data: session } = useSession();
  const sessionRef = useRef<typeof session>(null);
  const scoreSubmittedRef = useRef(false);
  const [leaderboard, setLeaderboard] = useState<{ name: string; image: string; score: number; email: string }[]>([]);
  const refreshLbRef = useRef<() => void>(() => {});

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
  const bossWarningImgRef = useRef<HTMLImageElement | null>(null);
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
    bossPhase: 'none' as 'none' | 'warning' | 'entering' | 'fighting' | 'dying' | 'dead',
    bossHealth: 5,
    bossX: W + 450,
    bossRotation: 0,
    bossLetterbox: 0,
    bossBeams: [] as { x: number; y: number; vx: number; vy: number; angle: number }[],
    bossBeamTimer: 0,
    bossEnterTimer: 0,
    bossDeathTimer: 0,
    bossFlash: 0,
    bossShakeX: 0,
    bossShakeY: 0,
    bossFragments: [] as { sx: number; sy: number; sw: number; sh: number; dw: number; dh: number; x: number; y: number; vx: number; vy: number; rot: number; rotSpd: number; alpha: number }[],
    bossFragmentsSpawned: false,
    bossHitSparks: [] as { x: number; y: number; vx: number; vy: number; alpha: number; size: number }[],
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
    s.bossEnterTimer = 0;
    s.bossDeathTimer = 0;
    s.bossFlash = 0;
    s.bossShakeX = 0;
    s.bossShakeY = 0;
    s.bossFragments = [];
    s.bossFragmentsSpawned = false;
    s.bossHitSparks = [];
    scoreSubmittedRef.current = false;
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

  useEffect(() => { sessionRef.current = session; }, [session]);

  useEffect(() => {
    const refresh = () => {
      fetch('/api/game-scores')
        .then(r => r.json())
        .then(d => setLeaderboard(Array.isArray(d) ? d : []))
        .catch(() => {});
    };
    refreshLbRef.current = refresh;
    refresh();
  }, []);

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

    const warnImg = new Image();
    warnImg.crossOrigin = 'anonymous';
    warnImg.src = 'https://i.imgur.com/5SXVpUj.png';
    bossWarningImgRef.current = warnImg;

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
        if (s.running && !s.dead) { s.score = 500; s.powerUpNextScore = 530; s.health = 3; s.invincible = 600; s.bossHealth = 5; }
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

      // Apply gameplay tilt+zoom during boss (canvas content only, not UI)
      if (s.bossRotation !== 0) {
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate(s.bossRotation * Math.PI / 180);
        ctx.translate(-W / 2, -H / 2);
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

        if (s.bossPhase === 'none') {
          s.obstacleTimer--;
          if (s.obstacleTimer <= 0) {
            const type = Math.floor(Math.random() * 3);
            const h = type === 1 ? 30 : 40 + Math.random() * 20;
            const w = type === 1 ? 24 : 28 + Math.random() * 16;
            s.obstacles.push({ x: W + 10, w, h, type });
            s.obstacleTimer = 60 + Math.random() * 60;
          }
        }

        s.obstacles = s.obstacles.filter(o => o.x + o.w > -10);
        for (const o of s.obstacles) o.x -= s.speed;

        const kaseyBaseX = W - PAT_W - 40;
        const kaseyBaseY = GROUND - PAT_H - 80;

        // Fireball (only when Kasey not stunned and no boss phase)
        if (s.kaseyStunUntil === 0 && s.bossPhase === 'none') {
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
        if (s.markActive && s.markX <= markFinalX && s.markStunUntil === 0 && s.bossPhase === 'none') {
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
          s.dialogue = null;
          // Silence before the storm — clear everything immediately
          s.obstacles = []; s.fireballs = []; s.drones = []; s.beam = null;
          if (kaseyImgRef.current) kaseyImgRef.current.style.display = 'none';
          if (markImgRef.current) markImgRef.current.style.display = 'none';
        }
        if (s.bossPhase === 'warning' && Math.floor(s.score) >= 510) {
          s.bossPhase = 'entering';
          s.bossEnterTimer = 0;
        }
        if (s.bossPhase !== 'none') {
          // Rotation + letterbox only during entering/fighting/dead (not during silence)
          const rotTarget = (s.bossPhase === 'entering' || s.bossPhase === 'fighting' || s.bossPhase === 'dying') ? -10 : 0;
          if (s.bossRotation < rotTarget) s.bossRotation = Math.min(rotTarget, s.bossRotation + 0.8);
          else if (s.bossRotation > rotTarget) s.bossRotation = Math.max(rotTarget, s.bossRotation - 0.8);
          const lbTarget = (s.bossPhase === 'entering' || s.bossPhase === 'fighting' || s.bossPhase === 'dying') ? 24 : 0;
          if (s.bossLetterbox < lbTarget) s.bossLetterbox = Math.min(lbTarget, s.bossLetterbox + 2);
          else if (s.bossLetterbox > lbTarget) s.bossLetterbox = Math.max(lbTarget, s.bossLetterbox - 2);
          // Entering — quick but heavy slide
          if (s.bossPhase === 'entering') {
            s.bossEnterTimer++;
            s.bossX = Math.max(BOSS_FINAL_X, s.bossX - 12);
            if (s.bossX <= BOSS_FINAL_X) s.bossPhase = 'fighting';
          }
          // Fighting — rapid inaccurate beams at Pat starting at score 520
          if (s.bossPhase === 'fighting' && Math.floor(s.score) >= 520) {
            s.bossBeamTimer--;
            if (s.bossBeamTimer <= 0) {
              const startX = s.bossX + 10;
              const startY = GROUND - BOSS_H * 0.55;
              // Inaccurate: scatter over head, on him, or in front
              const scatterY = (Math.random() - 0.5) * PAT_H * 2.5;
              const scatterX = (Math.random() - 0.35) * PAT_W * 3.5;
              const tx = PAT_X + PAT_W / 2 + scatterX;
              const ty = s.patY + PAT_H / 2 + scatterY;
              const dx = tx - startX, dy = ty - startY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const spd = 7;
              s.bossBeams.push({ x: startX, y: startY, vx: (dx / dist) * spd, vy: (dy / dist) * spd, angle: Math.atan2(dy, dx) });
              s.bossBeamTimer = 110 + Math.floor(Math.random() * 20);
            }
          }
          // Move boss beams + hit detection
          for (const b of s.bossBeams) { b.x += b.vx; b.y += b.vy; }
          s.bossBeams = s.bossBeams.filter(b => b.x > -80 && b.x < W + 80 && b.y > -80 && b.y < H + 80);
          for (const b of s.bossBeams) {
            if (px + pw > b.x - 28 && px < b.x + 28 && py + ph > b.y - 12 && py < b.y + 12) takeDamage(2);
          }
          // Dying — vibrate + white flash + shatter, then transition to dead
          if (s.bossPhase === 'dying') {
            s.bossDeathTimer++;
            const t = s.bossDeathTimer;
            s.bossShakeX = (Math.random() - 0.5) * 22;
            s.bossShakeY = (Math.random() - 0.5) * 12;
            if (t < 60)       s.bossFlash = (t / 60) * 0.85;
            else if (t < 80)  s.bossFlash = 0.85 + (t - 60) / 20 * 0.15;
            else if (t < 115) s.bossFlash = 1 - (t - 80) / 35;
            else { s.bossFlash = 0; s.bossShakeX = 0; s.bossShakeY = 0; s.bossPhase = 'dead'; }
            // Spawn fragments at peak flash (t>=70)
            if (t >= 70 && !s.bossFragmentsSpawned) {
              s.bossFragmentsSpawned = true;
              const bImg2 = bossImgRef.current;
              if (bImg2 && bImg2.naturalWidth) {
                const cols = 6, rows = 6;
                const nw = bImg2.naturalWidth, nh = bImg2.naturalHeight;
                const fragDstW = BOSS_W / cols, fragDstH = BOSS_H / rows;
                const cx = s.bossX + BOSS_W / 2, cy = GROUND - BOSS_H / 2;
                for (let row = 0; row < rows; row++) {
                  for (let col = 0; col < cols; col++) {
                    const fx = s.bossX + col * fragDstW + fragDstW / 2;
                    const fy = GROUND - BOSS_H + row * fragDstH + fragDstH / 2;
                    const dx = fx - cx, dy = fy - cy;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const spd = 5 + Math.random() * 9;
                    s.bossFragments.push({
                      sx: col * (nw / cols), sy: row * (nh / rows),
                      sw: nw / cols, sh: nh / rows,
                      dw: fragDstW, dh: fragDstH,
                      x: fx, y: fy,
                      vx: (dx / dist) * spd + (Math.random() - 0.5) * 5,
                      vy: (dy / dist) * spd + (Math.random() - 0.5) * 5 - 3,
                      rot: Math.random() * Math.PI * 2,
                      rotSpd: (Math.random() - 0.5) * 0.22,
                      alpha: 1,
                    });
                  }
                }
              }
            }
          }
          // Update hit sparks
          for (const sp of s.bossHitSparks) { sp.x += sp.vx; sp.y += sp.vy; sp.vy += 0.3; sp.alpha -= 0.038; }
          s.bossHitSparks = s.bossHitSparks.filter(sp => sp.alpha > 0);
          // Update fragments physics each frame
          for (const f of s.bossFragments) {
            f.x += f.vx; f.y += f.vy;
            f.vy += 0.35;
            f.rot += f.rotSpd;
            f.alpha -= 0.004;
          }
          s.bossFragments = s.bossFragments.filter(f => f.alpha > 0);
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
            if (s.bossPhase === 'none' && s.kaseyStunUntil === 0) targets.push('kasey');
            if (s.bossPhase === 'none' && s.markActive && s.markStunUntil === 0) targets.push('mark');
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
              // Hit sparks at impact point
              for (let i = 0; i < 14; i++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 5 + Math.random() * 9;
                s.bossHitSparks.push({ x: s.beam.x, y: s.beam.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 2, alpha: 1, size: 2 + Math.random() * 3.5 });
              }
              s.beam = null;
              if (s.bossHealth <= 0) { s.bossPhase = 'dying'; s.bossDeathTimer = 0; s.bossBeams = []; }
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
      if (s.bossPhase === 'entering' || s.bossPhase === 'fighting' || s.bossPhase === 'dying' || s.bossPhase === 'dead') {
        // Red cinematic dim — intensity tied to rotation progress
        const dimAlpha = Math.min(0.4, (Math.abs(s.bossRotation) / 10) * 0.4);
        ctx.save();
        ctx.globalAlpha = dimAlpha;
        ctx.fillStyle = '#1a0000';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // Boss machine (hidden once fragments spawn)
        const bImg = bossImgRef.current;
        if (bImg && bImg.complete && bImg.naturalWidth && !s.bossFragmentsSpawned) {
          ctx.drawImage(bImg, s.bossX + s.bossShakeX, GROUND - BOSS_H + s.bossShakeY, BOSS_W, BOSS_H);
        }
        // Progressive cracks — dark pixel-style overlay on boss texture
        const dmg = Math.max(0, 5 - s.bossHealth);
        if (dmg > 0 && !s.bossFragmentsSpawned) {
          ctx.save();
          ctx.lineCap = 'butt';
          // Subtle dark vignette around crack origin
          const vgx = s.bossX + 190, vgy = GROUND - BOSS_H + 212;
          const vgr = 30 + dmg * 18;
          const vg = ctx.createRadialGradient(vgx, vgy, 0, vgx, vgy, vgr);
          vg.addColorStop(0, `rgba(0,0,0,${dmg * 0.18})`);
          vg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = vg;
          ctx.fillRect(vgx - vgr, vgy - vgr, vgr * 2, vgr * 2);
          // Crack lines: dark core + faint bright edge for depth
          for (const c of BOSS_CRACKS) {
            if (c.dmg > dmg) continue;
            const bx = s.bossX, by = GROUND - BOSS_H;
            const x1 = Math.round(bx + c.x1) + 0.5, y1 = Math.round(by + c.y1) + 0.5;
            const x2 = Math.round(bx + c.x2) + 0.5, y2 = Math.round(by + c.y2) + 0.5;
            // thick black shadow crack
            ctx.strokeStyle = 'rgba(0,0,0,0.95)';
            ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            // bright pixel-crack center — visible on any background
            ctx.strokeStyle = 'rgba(220,170,60,0.9)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          }
          ctx.restore();
        }
        // Hit sparks
        for (const sp of s.bossHitSparks) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, sp.alpha);
          ctx.fillStyle = sp.alpha > 0.5 ? '#ffffff' : '#ffaa44';
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // Shatter fragments
        if (bImg && s.bossFragments.length > 0) {
          for (const f of s.bossFragments) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, f.alpha);
            ctx.translate(f.x, f.y);
            ctx.rotate(f.rot);
            ctx.drawImage(bImg, f.sx, f.sy, f.sw, f.sh, -f.dw / 2, -f.dh / 2, f.dw, f.dh);
            ctx.restore();
          }
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
        const patLeft = cx(PAT_X);
        const patTop = cy(s.patY);
        patImg.style.left = `${patLeft}px`;
        patImg.style.top = `${patTop}px`;
        patImg.style.width = `${PAT_W * scale}px`;
        patImg.style.height = `${PAT_H * scale}px`;
        patImg.style.opacity = s.invincible > 0 && Math.floor(s.invincible / 8) % 2 === 0 ? '0.3' : '1';
        if (s.bossRotation !== 0) {
          const pivotX = (cLeft + (W / 2) * scale) - patLeft;
          const pivotY = (cTop + (H / 2) * scale) - patTop;
          patImg.style.transformOrigin = `${pivotX}px ${pivotY}px`;
          patImg.style.transform = `rotate(${s.bossRotation}deg)`;
        } else {
          patImg.style.transform = '';
          patImg.style.transformOrigin = '';
        }
      }

      // Kasey levitation — hidden during boss phases
      const kaseyImg = kaseyImgRef.current;
      if (kaseyImg) {
        if (s.bossPhase !== 'none') {
          kaseyImg.style.display = 'none';
        } else {
          kaseyImg.style.display = '';
          const kaseyX = W - PAT_W - 40;
          const kaseyBaseY = GROUND - PAT_H - 80;
          const kaseyY = kaseyBaseY + Math.sin(s.frame * 0.06) * 5;
          kaseyImg.style.left = `${cx(kaseyX + s.kaseyOffX)}px`;
          kaseyImg.style.top = `${cy(kaseyY)}px`;
          kaseyImg.style.width = `${PAT_W * scale}px`;
          kaseyImg.style.height = `${PAT_H * scale}px`;
        }
      }

      // Mark overlay — hidden during boss phases
      const markImg = markImgRef.current;
      if (markImg && s.markActive && s.bossPhase !== 'none') {
        markImg.style.display = 'none';
      } else if (markImg && s.markActive) {
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

      // Restore canvas from gameplay tilt before drawing UI
      if (s.bossRotation !== 0) ctx.restore();

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
        // Submit score once on death
        if (!scoreSubmittedRef.current) {
          scoreSubmittedRef.current = true;
          const sess = sessionRef.current;
          if (sess?.user && Math.floor(s.score) > 0) {
            fetch('/api/game-scores', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ score: Math.floor(s.score) }),
            }).then(() => refreshLbRef.current()).catch(() => {});
          }
        }
      }

      if (pauseRestartBtnRef.current) {
        pauseRestartBtnRef.current.style.display = s.paused ? 'block' : 'none';
      }

      // Boss overlay updates (letterbox via wrapper padding, warning sign)
      if (wrapper) {
        const lbPadPct = (s.bossLetterbox / W * 100).toFixed(2) + '%';
        wrapper.style.paddingTop = lbPadPct;
        wrapper.style.paddingBottom = lbPadPct;
      }
      // Draw warning sign on canvas — guaranteed centered + tilted
      const warnImg = bossWarningImgRef.current;
      if (warnImg && s.bossPhase === 'entering') {
        const t = s.bossEnterTimer;
        if (t < 150) {
          let op: number;
          if      (t <  6) op = t / 6;
          else if (t < 10) op = 0.1;
          else if (t < 16) op = 1;
          else if (t < 20) op = 0.1;
          else if (t < 26) op = 1;
          else if (t < 30) op = 0.1;
          else if (t < 120) op = 1;
          else              op = (150 - t) / 30;
          const scl = t < 30 ? (1.55 + 0.06 * (1 - t / 30)) : 1.5;
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, op));
          ctx.translate(W / 2, H / 2);
          ctx.rotate(-10 * Math.PI / 180);
          ctx.drawImage(warnImg, -W / 2 * scl, -H / 2 * scl, W * scl, H * scl);
          ctx.restore();
        }
      }

      // Boss defeat white flash — drawn over everything
      if (s.bossFlash > 0) {
        ctx.save();
        ctx.globalAlpha = s.bossFlash;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
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
          <div
            ref={wrapperRef}
            className="game-wrapper"
            style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden', border: '2px solid rgba(74,222,128,0.3)', boxShadow: '0 0 40px rgba(74,222,128,0.1)', background: '#000' }}
          >
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
            {/* Letterbox bars: implemented via wrapper paddingTop/paddingBottom in the game loop */}
          </div>
          </div>{/* end bossOuterRef */}

          <div className="game-controls" style={{ marginTop: '16px', display: 'flex', gap: '24px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#475569' }}>
            <span>SPACE / ↑ — jump</span>
            <span>TAP — jump on mobile</span>
          </div>

          {/* Leaderboard */}
          <div style={{ marginTop: '40px', maxWidth: W, fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', letterSpacing: '2px', color: '#4ade80', textTransform: 'uppercase' }}>Leaderboard</span>
                <h2 style={{ fontSize: '22px', color: '#4ade80', margin: '4px 0 0' }}>Top Scores</h2>
              </div>
              {!session ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => signIn('google')} style={{ background: 'rgba(0,0,0,0.85)', border: '2px solid #4ade80', color: '#4ade80', fontFamily: 'monospace', fontSize: '11px', padding: '6px 14px', cursor: 'pointer', letterSpacing: '1px' }}>Sign in with Google</button>
                  <button onClick={() => signIn('discord')} style={{ background: 'rgba(0,0,0,0.85)', border: '2px solid #4ade80', color: '#4ade80', fontFamily: 'monospace', fontSize: '11px', padding: '6px 14px', cursor: 'pointer', letterSpacing: '1px' }}>Sign in with Discord</button>
                </div>
              ) : (
                <span style={{ fontSize: '12px', color: '#475569' }}>Signed in as <span style={{ color: '#4ade80' }}>{session.user?.name}</span></span>
              )}
            </div>
            {leaderboard.length === 0 ? (
              <p style={{ color: '#475569', fontSize: '13px' }}>No scores yet — be the first!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {leaderboard.map((entry, i) => (
                  <div key={entry.email} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: i === 0 ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${i === 0 ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '6px' }}>
                    <span style={{ width: '24px', textAlign: 'right', color: i === 0 ? '#4ade80' : '#475569', fontSize: '13px', fontWeight: 'bold' }}>#{i + 1}</span>
                    {entry.image ? (
                      <img src={entry.image} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1e3a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: '12px' }}>{entry.name[0]}</div>
                    )}
                    <span style={{ flex: 1, color: '#e2e8f0', fontSize: '13px' }}>{entry.name}</span>
                    <span style={{ color: i === 0 ? '#4ade80' : '#94a3b8', fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px' }}>{entry.score.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            {!session && (
              <p style={{ marginTop: '12px', fontSize: '12px', color: '#475569' }}>Sign in to save your score to the leaderboard.</p>
            )}
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
