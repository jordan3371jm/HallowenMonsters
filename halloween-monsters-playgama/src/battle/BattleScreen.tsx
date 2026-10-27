// Schermata di battaglia in stile Pokémon: arena con piattaforme, riquadri
// PS animati, box messaggi con testo progressivo, menu Lotta/Borsa/Mostri/Fuga,
// effetti visivi (canvas) e sonori per ogni evento del motore.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import type { Monster, Move, StatusEffect, MonsterType } from '../types';
import type { Language } from '../i18n';
import { tItem, tItemDesc, tMonster, tMove, tStatus, tType, t } from '../i18n';
import { tAbilityName } from '../abilities';
import { typeColors, getMoveEffectiveness } from '../data/monsters';
import { getMonsterIconPath } from '../data/monsterPNGIcons';
import {
  resolveTurn, captureChance, moveEffectSummary, majorStatusOf,
  type BattleConfig, type BattleEvent, type BattleState, type Outcome, type PlayerAction, type Snapshot, type TurnStats,
} from './engine';
import type { EncounterKind } from './encounters';
import { bt } from './battleText';
import FxCanvas, { type FxHandle, type FxKind } from './FxCanvas';
import { playSfx, moveSfx, preloadSfx, type SfxName } from '../audio';
import type { GameSettings } from '../settings';
import { TypeBadge, TypeIcon } from '../components/TypeIcons';
import './battle.css';

export interface BattleRewards {
  candies: number;
  coins: number;
}

export interface BattleFinish {
  outcome: Outcome;
  state: BattleState;
  doubled: boolean;
}

interface Props {
  lang: Language;
  initial: BattleState;
  cfg: BattleConfig;
  encounter: EncounterKind;
  wave: number;
  rewards: BattleRewards;
  settings: GameSettings;
  canDoubleAd: boolean;
  onWatchDoubleAd: () => Promise<boolean>;
  onTurn: (stats: TurnStats) => void;
  onFinish: (result: BattleFinish) => void;
}

type Panel = 'command' | 'fight' | 'bag' | 'team' | 'target' | 'pp' | 'busy' | 'forced' | 'learn' | 'victory' | 'defeat';
type Anim = '' | 'lunge' | 'hit' | 'faint' | 'enter' | 'dodge' | 'status' | 'capture' | 'hidden' | 'evolve';
type BagTab = 'heal' | 'catch' | 'tools';

const STATUS_FX: Record<StatusEffect, FxKind> = {
  bruciato: 'fuoco', putrefatto: 'veleno', paralizzato: 'tuono', sonnambulo: 'magic', spaventato: 'buio', maledetto: 'spettro',
};

const STATUS_STYLE: Record<StatusEffect, { bg: string; short: Record<Language, string> }> = {
  bruciato: { bg: '#e8590c', short: { en: 'BRN', it: 'SCT', fr: 'BRL', es: 'QUE', tr: 'YNK' } },
  putrefatto: { bg: '#9c36b5', short: { en: 'ROT', it: 'PUT', fr: 'PUT', es: 'PUD', tr: 'ÇÜR' } },
  paralizzato: { bg: '#f59f00', short: { en: 'PAR', it: 'PAR', fr: 'PAR', es: 'PAR', tr: 'FLÇ' } },
  sonnambulo: { bg: '#5c7cfa', short: { en: 'SLP', it: 'SNN', fr: 'SOM', es: 'DOR', tr: 'UYK' } },
  spaventato: { bg: '#495057', short: { en: 'SCR', it: 'SPV', fr: 'PEU', es: 'MIE', tr: 'KRK' } },
  maledetto: { bg: '#7048e8', short: { en: 'CRS', it: 'MAL', fr: 'MAU', es: 'MAL', tr: 'LNT' } },
};

const ITEM_TABS: Record<string, BagTab> = {
  pozione_sangue: 'heal', super_pozione: 'heal', iper_pozione: 'heal', elisir_spettrale: 'heal',
  candela_protettiva: 'heal', frammento_luna: 'heal', lacrime_banshee: 'heal',
  caramella_stregata: 'catch', zucca_vuota: 'catch', bara_antica: 'catch', amuleto_maledetto: 'catch',
  rete_becchino: 'catch', sfera_re_zucche: 'catch',
  cristallo_pp: 'tools', cristallo_pp_totale: 'tools', nettare_zucca: 'tools', pozione_non_morte: 'tools',
};
const NEEDS_TARGET = new Set(['pozione_sangue', 'super_pozione', 'iper_pozione', 'elisir_spettrale', 'candela_protettiva', 'nettare_zucca', 'cristallo_pp_totale']);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function hpColor(ratio: number) {
  return ratio > 0.5 ? 'linear-gradient(180deg,#7dff9b,#22c55e)' : ratio > 0.2 ? 'linear-gradient(180deg,#ffe066,#f59f00)' : 'linear-gradient(180deg,#ff8787,#e03131)';
}

/** Numero che scorre gradualmente verso il valore finale (PS). */
function useTween(value: number, ms = 600) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const v = Math.round(a + (value - a) * k);
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

const HP_LABEL: Record<Language, string> = { en: 'HP', it: 'PS', fr: 'PV', es: 'PS', tr: 'CP' };

function HpBar({ hp, maxHp, big, lang }: { hp: number; maxHp: number; big?: boolean; lang: Language }) {
  const shown = useTween(hp);
  const ratio = maxHp > 0 ? Math.max(0, shown) / maxHp : 0;
  return (
    <div className={`bs-hp ${big ? 'bs-hp-big' : ''}`}>
      <span className="bs-hp-label">{HP_LABEL[lang]}</span>
      <div className="bs-hp-track">
        <div className="bs-hp-fill" style={{ width: `${ratio * 100}%`, background: hpColor(ratio) }} />
      </div>
    </div>
  );
}

function StatusChip({ status, lang }: { status: StatusEffect; lang: Language }) {
  const st = STATUS_STYLE[status];
  return (
    <span className="bs-status" style={{ background: st.bg }} title={tStatus(status, lang)}>
      {st.short[lang] || st.short.en}
    </span>
  );
}

function StageChips({ m, lang }: { m: Monster; lang: Language }) {
  const s = m.stages;
  if (!s) return null;
  const labels: [keyof typeof s, string][] = [['attack', t('starter.atk', lang)], ['defense', t('starter.def', lang)], ['speed', t('starter.spd', lang)]];
  return (
    <>
      {labels.filter(([k]) => s[k] !== 0).map(([k, label]) => (
        <span key={k} className={`bs-stage ${s[k] > 0 ? 'up' : 'down'}`}>{label}{s[k] > 0 ? '▲' : '▼'}{Math.abs(s[k])}</span>
      ))}
    </>
  );
}

function InfoBox({ m, side, lang, kind, remaining }: { m: Monster; side: 'player' | 'enemy'; lang: Language; kind: EncounterKind; remaining?: { alive: boolean }[] }) {
  const hpShown = useTween(m.stats.hp);
  const major = majorStatusOf(m);
  const volatile = m.status.filter(s => s !== major);
  return (
    <div className={`bs-info bs-info-${side} ${m.isBoss ? 'bs-info-boss' : ''}`}>
      <div className="bs-info-row">
        <span className="bs-info-name">
          {m.shiny && <span className="bs-shiny" title="Shiny">✦</span>}
          {tMonster(m.id, lang)}
        </span>
        <span className="bs-info-lv">Lv.{m.level}</span>
      </div>
      <div className="bs-info-row bs-info-sub">
        <TypeIcon type={m.type} size={16} />
        {m.isBoss && <span className="bs-boss-tag">{bt('ui.boss', lang)}</span>}
        {major && <StatusChip status={major} lang={lang} />}
        {volatile.map(s => <StatusChip key={s} status={s} lang={lang} />)}
        <StageChips m={m} lang={lang} />
      </div>
      <HpBar hp={m.stats.hp} maxHp={m.stats.maxHp} big={side === 'player'} lang={lang} />
      {side === 'player' && (
        <>
          <div className="bs-info-hpnum">{Math.max(0, hpShown)} / {m.stats.maxHp}</div>
          <div className="bs-exp"><div className="bs-exp-fill" style={{ width: `${m.expToNext > 0 ? Math.min(100, (m.exp / m.expToNext) * 100) : 0}%` }} /></div>
        </>
      )}
      {side === 'enemy' && remaining && remaining.length > 1 && (
        <div className="bs-party">
          {remaining.map((r, i) => <span key={i} className={`bs-party-dot ${r.alive ? '' : 'out'}`} />)}
        </div>
      )}
      {side === 'enemy' && kind !== 'trainer' && kind !== 'gym_leader' && null}
    </div>
  );
}

function Sprite({ m, anim, flip, refEl, animations }: { m: Monster; anim: Anim; flip?: boolean; refEl: React.RefObject<HTMLDivElement>; animations: boolean }) {
  const src = getMonsterIconPath(m.id);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [m.id]);
  return (
    <div ref={refEl} className={`bs-sprite ${animations ? `bs-anim-${anim || 'idle'}` : ''} ${anim === 'hidden' || anim === 'capture' ? 'bs-sprite-hidden' : ''}`}>
      <div className={`bs-sprite-inner ${flip ? 'bs-flip' : ''} ${m.shiny ? 'bs-shiny-img' : ''}`}>
        {!animations && m.stats.hp <= 0 ? null : src && !failed
          ? <img src={src} alt="" draggable={false} onError={() => setFailed(true)} />
          : <span className="bs-sprite-emoji">{m.emoji}</span>}
      </div>
      {m.shiny && <span className="bs-shiny-sparkle" aria-hidden="true">✨</span>}
    </div>
  );
}

const ITEM_ICON: Record<string, string> = {
  caramella_stregata: '🍬', zucca_vuota: '🎃', bara_antica: '⚰️', amuleto_maledetto: '🔮', rete_becchino: '🕸️', sfera_re_zucche: '👑',
};

export default function BattleScreen(props: Props) {
  const { lang, cfg, settings, encounter, rewards } = props;
  const [battle, setBattle] = useState<BattleState>(props.initial);
  const [view, setView] = useState<Snapshot>(() => ({
    team: props.initial.team, enemies: props.initial.enemies, active: props.initial.active, enemyActive: props.initial.enemyActive,
  }));
  const [panel, setPanel] = useState<Panel>('busy');
  const [message, setMessage] = useState('');
  const [typed, setTyped] = useState('');
  const [playerAnim, setPlayerAnim] = useState<Anim>('hidden');
  const [enemyAnim, setEnemyAnim] = useState<Anim>('hidden');
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState<'' | 'white' | 'crit'>('');
  const [popups, setPopups] = useState<{ id: number; side: 'player' | 'enemy'; text: string; kind: 'dmg' | 'heal' | 'crit' | 'eff' }[]>([]);
  const [capture, setCapture] = useState<{ icon: string; stage: 'fly' | 'shake' | 'done' | 'open'; shakeN: number } | null>(null);
  const [bagTab, setBagTab] = useState<BagTab>('heal');
  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const [learnQueue, setLearnQueue] = useState<{ teamIndex: number; move: Move }[]>([]);
  const [afterLearn, setAfterLearn] = useState<Outcome | null>(null);
  const [doubled, setDoubled] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const [finishedOutcome, setFinishedOutcome] = useState<Outcome | null>(null);

  const arenaRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const enemyRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<FxHandle>(null);
  const alive = useRef(true);
  const skipRef = useRef(false);
  const popupId = useRef(0);
  const lastMoveType = useRef<{ player: MonsterType; enemy: MonsterType }>({ player: 'spettro', enemy: 'spettro' });

  const speed = settings.fastBattle ? 0.55 : 1;
  const wait = useCallback(async (ms: number) => {
    const total = ms * speed;
    const step = 40;
    for (let t = 0; t < total; t += step) {
      if (!alive.current) return;
      if (skipRef.current) { skipRef.current = false; return; }
      await sleep(step);
    }
  }, [speed]);

  useEffect(() => () => { alive.current = false; }, []);

  // Testo progressivo del box messaggi
  useEffect(() => {
    if (!message) { setTyped(''); return; }
    if (!settings.animations) { setTyped(message); return; }
    let i = 0;
    setTyped('');
    const timer = setInterval(() => {
      i += 2;
      setTyped(message.slice(0, i));
      if (i >= message.length) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [message, settings.animations]);

  const say = useCallback(async (text: string, hold = 700) => {
    if (!text) return;
    setMessage(text);
    await wait(Math.min(1400, 260 + text.length * 14) + hold - 300);
  }, [wait]);

  const sfx = useCallback((name: SfxName, opts?: { volume?: number; rate?: number; delay?: number }) => {
    playSfx(name, opts);
  }, []);

  const center = (side: 'player' | 'enemy') => {
    const arena = arenaRef.current?.getBoundingClientRect();
    const el = (side === 'player' ? playerRef : enemyRef).current?.getBoundingClientRect();
    if (!arena || !el) return { x: 0, y: 0 };
    return { x: el.left - arena.left + el.width / 2, y: el.top - arena.top + el.height / 2 };
  };

  const popup = (side: 'player' | 'enemy', text: string, kind: 'dmg' | 'heal' | 'crit' | 'eff') => {
    const id = ++popupId.current;
    setPopups(p => [...p, { id, side, text, kind }]);
    setTimeout(() => setPopups(p => p.filter(x => x.id !== id)), 1100);
  };

  const doShake = () => {
    if (!settings.shake) return;
    setShake(true);
    setTimeout(() => setShake(false), 380);
  };

  const animate = (side: 'player' | 'enemy', anim: Anim, ms = 520) => {
    const set = side === 'player' ? setPlayerAnim : setEnemyAnim;
    set(anim);
    if (anim !== 'faint' && anim !== 'hidden' && anim !== 'capture') setTimeout(() => { if (alive.current) set(''); }, ms);
  };

  // ---------------- Riproduzione degli eventi ----------------
  const playEvent = async (ev: BattleEvent) => {
    switch (ev.type) {
      case 'msg':
        setView(ev.snap);
        await say(ev.text);
        break;
      case 'move': {
        setView(ev.snap);
        lastMoveType.current[ev.side] = ev.moveType;
        animate(ev.side, 'lunge', 520);
        sfx(moveSfx(ev.moveType, ev.power));
        if (ev.power > 0) {
          const from = center(ev.side);
          const to = center(ev.side === 'player' ? 'enemy' : 'player');
          fxRef.current?.projectile(ev.moveType as FxKind, from, to, 380 * speed);
        } else {
          const c = center(ev.side);
          fxRef.current?.aura('magic', c.x, c.y);
        }
        await say(ev.text, 450);
        break;
      }
      case 'hit': {
        const target = ev.side;
        if (ev.amount > 0) {
          const c = center(target);
          const attacker = target === 'player' ? 'enemy' : 'player';
          fxRef.current?.burst(lastMoveType.current[attacker] as FxKind, c.x, c.y, ev.effectiveness > 1 || ev.crit ? 1.5 : ev.effectiveness < 1 ? 0.7 : 1);
          fxRef.current?.burst('hit', c.x, c.y, 0.6);
          sfx(ev.crit ? 'crit' : ev.effectiveness > 1 ? 'hit_super' : ev.effectiveness < 1 ? 'hit_weak' : 'hit');
          if (ev.crit) { setFlash('crit'); setTimeout(() => setFlash(''), 180); }
          if (ev.effectiveness > 1 || ev.crit) doShake();
          animate(target, 'hit', 480);
          popup(target, `-${ev.amount}`, ev.crit ? 'crit' : 'dmg');
          setView(ev.snap);
          await wait(560);
        } else {
          animate(target, 'dodge', 420);
          await wait(250);
        }
        break;
      }
      case 'miss':
        sfx('miss');
        animate(ev.side === 'player' ? 'enemy' : 'player', 'dodge', 420);
        await say(ev.text);
        break;
      case 'status': {
        setView(ev.snap);
        const c = center(ev.side);
        fxRef.current?.aura(STATUS_FX[ev.status], c.x, c.y);
        sfx('status');
        animate(ev.side, 'status', 600);
        await say(ev.text);
        break;
      }
      case 'tick': {
        const c = center(ev.side);
        fxRef.current?.burst(STATUS_FX[ev.status], c.x, c.y, 0.8);
        sfx('hit_weak');
        animate(ev.side, 'hit', 420);
        if (ev.amount > 0) popup(ev.side, `-${ev.amount}`, 'dmg');
        setView(ev.snap);
        await say(ev.text);
        break;
      }
      case 'stat': {
        setView(ev.snap);
        const c = center(ev.side);
        fxRef.current?.aura(ev.up ? 'statup' : 'statdown', c.x, c.y);
        sfx(ev.up ? 'stat_up' : 'stat_down');
        await say(ev.text);
        break;
      }
      case 'heal': {
        const c = center(ev.side);
        fxRef.current?.burst('heal', c.x, c.y, 1);
        sfx('heal');
        popup(ev.side, `+${ev.amount}`, 'heal');
        setView(ev.snap);
        await say(ev.text);
        break;
      }
      case 'faint': {
        const c = center(ev.side);
        sfx('faint');
        fxRef.current?.burst('smoke', c.x, c.y + 20, 1);
        animate(ev.side, 'faint');
        await say(ev.text, 600);
        setView(ev.snap);
        break;
      }
      case 'switch': {
        if (ev.side === 'player') {
          setPlayerAnim('hidden');
          setView(ev.snap);
          await wait(120);
          animate('player', 'enter', 600);
          sfx('ui_open');
        } else {
          setEnemyAnim('hidden');
          setView(ev.snap);
          await wait(120);
          animate('enemy', 'enter', 600);
          sfx('appear');
        }
        await say(ev.text);
        break;
      }
      case 'capture': {
        const icon = ITEM_ICON[ev.itemId] || '🍬';
        sfx('throw');
        setCapture({ icon, stage: 'fly', shakeN: 0 });
        await wait(520);
        const c = center('enemy');
        fxRef.current?.burst('magic', c.x, c.y, 1);
        setEnemyAnim('capture');
        setCapture({ icon, stage: 'shake', shakeN: 0 });
        await wait(420);
        for (let i = 0; i < ev.shakes; i++) {
          setCapture({ icon, stage: 'shake', shakeN: i + 1 });
          sfx('shake');
          await wait(520);
        }
        if (ev.success) {
          sfx('catch');
          fxRef.current?.burst('stars', c.x, c.y + 30, 1.3);
          setCapture({ icon, stage: 'done', shakeN: ev.shakes });
          await wait(500);
          if (ev.text) await say(ev.text);
          setView(ev.snap);
        } else {
          sfx('breakfree');
          setCapture({ icon, stage: 'open', shakeN: ev.shakes });
          fxRef.current?.burst('magic', c.x, c.y, 1.2);
          setEnemyAnim('enter');
          await wait(250);
          setCapture(null);
          setTimeout(() => alive.current && setEnemyAnim(''), 500);
          setView(ev.snap);
          await say(ev.text);
        }
        break;
      }
      case 'levelup': {
        setView(ev.snap);
        if (ev.teamIndex === ev.snap.active) {
          const c = center('player');
          fxRef.current?.burst('gold', c.x, c.y, 1.2);
        }
        sfx('levelup');
        await say(ev.text, 800);
        break;
      }
      case 'evolve': {
        setView(ev.snap);
        if (ev.teamIndex === ev.snap.active) {
          setPlayerAnim('evolve');
          setFlash('white');
          setTimeout(() => setFlash(''), 600);
          const c = center('player');
          fxRef.current?.burst('gold', c.x, c.y, 1.8);
          setTimeout(() => alive.current && setPlayerAnim(''), 900);
        }
        sfx('evolve');
        await say(ev.text, 900);
        break;
      }
    }
  };

  const finishBattle = useCallback((outcome: Outcome, state: BattleState, wasDoubled: boolean) => {
    props.onFinish({ outcome, state, doubled: wasDoubled });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onFinish]);

  const resolveOutcome = async (outcome: Outcome, state: BattleState) => {
    if (outcome === 'victory') {
      setFinishedOutcome('victory');
      sfx('victory');
      if (settings.effects) {
        try { confetti({ particleCount: 90, spread: 75, origin: { y: 0.45 }, colors: ['#ff8c00', '#9b5cff', '#ffd43b', '#51cf66'] }); } catch { /* ignore */ }
      }
      setTimeout(() => sfx('coin'), 500);
      setPanel('victory');
    } else if (outcome === 'defeat') {
      setFinishedOutcome('defeat');
      sfx('defeat');
      setPanel('defeat');
    } else if (outcome === 'escaped') {
      await wait(300);
      finishBattle('escaped', state, false);
    } else if (outcome === 'need_switch') {
      setMessage(bt('choose_next', lang));
      setPanel('forced');
    } else {
      setMessage('');
      setPanel('command');
    }
  };

  const runAction = async (action: PlayerAction) => {
    if (panel === 'busy') return;
    const result = resolveTurn(battle, action, cfg);
    if (!result.consumedTurn) {
      // Azione non valida: mostra il motivo e resta nel menu
      sfx('ui_error');
      const text = result.events.filter(e => 'text' in e && e.text).map(e => (e as any).text).join(' ');
      if (text) setMessage(text);
      return;
    }
    setPanel('busy');
    setPendingItem(null);
    props.onTurn(result.stats);
    for (const ev of result.events) {
      if (!alive.current) return;
      await playEvent(ev);
    }
    if (!alive.current) return;
    setBattle(result.state);
    setView({ team: result.state.team, enemies: result.state.enemies, active: result.state.active, enemyActive: result.state.enemyActive });
    if (playerAnim === 'hidden') setPlayerAnim('');
    setCapture(null);
    if (result.pendingMoves.length) {
      setLearnQueue(result.pendingMoves);
      setAfterLearn(result.outcome);
      setPanel('learn');
      return;
    }
    await resolveOutcome(result.outcome, result.state);
  };

  // Introduzione della lotta
  useEffect(() => {
    preloadSfx(['hit', 'hit_super', 'hit_weak', 'crit', 'miss', 'faint', 'status', 'heal', 'appear', 'ui_open']);
    let cancelled = false;
    (async () => {
      const first = props.initial.enemies[0];
      const second = props.initial.enemies[1];
      await sleep(150);
      if (cancelled) return;
      setEnemyAnim('enter');
      sfx('appear');
      const enemyName = tMonster(first.id, lang);
      let intro = '';
      if (encounter === 'trainer') intro = bt('trainer_challenge', lang, { m: enemyName });
      else if (encounter === 'gym_leader') intro = bt('gym_challenge', lang, { m: tMonster(props.initial.enemies[props.initial.enemies.length - 1].id, lang) });
      else if (encounter === 'legendary' || encounter === 'mythical') intro = bt('boss_appears', lang, { m: enemyName });
      else if (encounter === 'double' && second) intro = bt('wild_pair', lang, { m: enemyName, m2: tMonster(second.id, lang) });
      else intro = bt('wild_appears', lang, { m: enemyName });
      await say(intro, 500);
      if (first.shiny) await say(bt('shiny', lang), 400);
      if (battle.weather !== 'normale') await say(`${t(`weather.${battle.weather}`, lang)}: ${t(`weather.${battle.weather === 'luna_piena' ? 'spettro_boost' : battle.weather === 'nebbia' ? 'precision_down' : 'buio_spettro_boost'}`, lang)}`, 300);
      if (cancelled) return;
      setEnemyAnim('');
      setPlayerAnim('enter');
      sfx('ui_open');
      await say(bt('go', lang, { m: tMonster(props.initial.team[props.initial.active].id, lang) }), 300);
      if (cancelled) return;
      setPlayerAnim('');
      setMessage('');
      setPanel('command');
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const player = view.team[view.active];
  const enemy = view.enemies[view.enemyActive];
  const logicPlayer = battle.team[battle.active];
  const logicEnemy = battle.enemies[battle.enemyActive];

  const remaining = useMemo(() => view.enemies.map(e => ({ alive: e.stats.hp > 0 })), [view.enemies]);

  const items = battle.items.filter(i => i.quantity > 0);
  const tabItems = items.filter(i => (ITEM_TABS[i.id] || 'tools') === bagTab);

  const handleItem = (itemId: string) => {
    sfx('ui_click');
    if (ITEM_TABS[itemId] === 'catch') { runAction({ kind: 'capture', itemId }); return; }
    if (itemId === 'cristallo_pp') { setPendingItem(itemId); setPanel('pp'); return; }
    if (itemId === 'lacrime_banshee') {
      if (battle.team.filter(m => m.stats.hp <= 0).length > 1) { setPendingItem(itemId); setPanel('target'); return; }
      runAction({ kind: 'item', itemId });
      return;
    }
    if (NEEDS_TARGET.has(itemId) && battle.team.length > 1) { setPendingItem(itemId); setPanel('target'); return; }
    runAction({ kind: 'item', itemId });
  };

  const learnCurrent = learnQueue[0];
  const resolveLearn = async (replaceIndex: number | null) => {
    if (!learnCurrent) return;
    const state = clone(battle);
    const mon = state.team[learnCurrent.teamIndex];
    let text: string;
    if (replaceIndex !== null && mon) {
      const old = mon.moves[replaceIndex];
      mon.moves[replaceIndex] = clone(learnCurrent.move);
      text = bt('ui.forgot_learned', lang, { m: tMonster(mon.id, lang), old: tMove(old.id, lang), move: tMove(learnCurrent.move.id, lang) });
      sfx('ui_confirm');
    } else {
      text = bt('ui.not_learned', lang, { m: tMonster(mon?.id || '', lang), move: tMove(learnCurrent.move.id, lang) });
      sfx('ui_back');
    }
    setBattle(state);
    setView({ team: state.team, enemies: state.enemies, active: state.active, enemyActive: state.enemyActive });
    const rest = learnQueue.slice(1);
    setLearnQueue(rest);
    setPanel('busy');
    await say(text);
    if (rest.length) { setPanel('learn'); return; }
    await resolveOutcome(afterLearn || 'continue', state);
  };

  const effLabel = (move: Move) => {
    if (!logicEnemy || move.power === 0) return null;
    const eff = getMoveEffectiveness(move.type, logicEnemy.type);
    if (eff === 0) return <span className="bs-eff none">{bt('ui.eff_none', lang)}</span>;
    if (eff > 1) return <span className="bs-eff super">{bt('ui.eff_super', lang)}</span>;
    if (eff < 1) return <span className="bs-eff weak">{bt('ui.eff_weak', lang)}</span>;
    return null;
  };

  const moveDetail = (move: Move) => {
    if (move.power > 0) {
      return move.effect && move.effectChance
        ? `${tStatus(move.effect, lang)} ${move.effectChance}%`
        : '';
    }
    if (move.effect) return tStatus(move.effect, lang);
    const s = moveEffectSummary(move);
    const statShort: Record<string, string> = { attack: t('starter.atk', lang), defense: t('starter.def', lang), speed: t('starter.spd', lang) };
    if (s.healPct) return bt('ui.heals_pct', lang, { n: Math.round(s.healPct * 100) });
    if (s.selfStat) return bt('ui.raises', lang, { stat: Object.keys(s.selfStat).map(k => statShort[k]).join('+') });
    if (s.targetStat) return bt('ui.lowers', lang, { stat: Object.keys(s.targetStat).map(k => statShort[k]).join('+') });
    return '';
  };

  const commandPrompt = logicPlayer ? bt('ui.what_do', lang, { m: tMonster(logicPlayer.id, lang) }) : '';
  const menuPanel = panel === 'command' || panel === 'fight' || panel === 'bag' || panel === 'team' || panel === 'target' || panel === 'pp';
  const shownText = menuPanel && !message ? commandPrompt : typed;

  const backdrop = encounter === 'gym_leader' ? 'gym' : encounter === 'trainer' ? 'forest' : encounter === 'legendary' || encounter === 'mythical' ? 'bloodmoon' : 'graveyard';

  const onTapAdvance = () => { skipRef.current = true; };

  return (
    <div className={`bs-root ${shake ? 'bs-shake' : ''}`}>
      {/* ---------- ARENA ---------- */}
      <div ref={arenaRef} className={`bs-arena bs-bg-${backdrop} weather-${battle.weather}`} onClick={onTapAdvance}>
        <div className="bs-sky" aria-hidden="true">
          <div className="bs-moon" />
          <div className="bs-stars" />
          <svg className="bs-silhouette" viewBox="0 0 400 120" preserveAspectRatio="none">
            <path d="M0 120 L0 78 Q30 70 52 80 L60 52 L66 80 Q100 64 130 76 L136 40 L140 76 Q180 60 210 72 Q240 58 268 74 L274 46 L278 74 Q320 62 350 72 L356 56 L362 74 Q385 66 400 70 L400 120 Z" />
            <g className="bs-tombs">
              <path d="M40 104 v-16 a8 8 0 0 1 16 0 v16z" /><path d="M300 106 v-14 a7 7 0 0 1 14 0 v14z" /><path d="M330 108 h4 v-18 h4 v-4 h-4 v-4 h-4 v4 h-4 v4 h4z" />
            </g>
          </svg>
          <div className="bs-fog bs-fog-a" /><div className="bs-fog bs-fog-b" />
          <span className="bs-bat" style={{ top: '14%', left: '12%' }}>🦇</span>
          <span className="bs-bat bs-bat-2" style={{ top: '8%', left: '58%' }}>🦇</span>
        </div>

        <div className="bs-kind-chip">
          {encounter === 'gym_leader' ? `🏆 ${bt('ui.gym', lang)}` : encounter === 'trainer' ? `🧙 ${bt('ui.trainer', lang)}` : `🌙 ${bt('ui.wild', lang)}`}
          {battle.weather !== 'normale' && <span className="bs-weather">{battle.weather === 'luna_piena' ? '🌕' : battle.weather === 'nebbia' ? '🌫️' : '🎃'}</span>}
        </div>

        {enemy && <InfoBox m={enemy} side="enemy" lang={lang} kind={encounter} remaining={encounter === 'trainer' || encounter === 'gym_leader' ? remaining : undefined} />}

        <div className="bs-field bs-field-enemy">
          <div className={`bs-platform bs-platform-enemy ${enemy?.isBoss ? 'boss' : ''}`} />
          {enemy && <Sprite m={enemy} anim={enemyAnim} refEl={enemyRef} animations={settings.animations} />}
          {capture && (
            <div className={`bs-capture bs-capture-${capture.stage}`} key={`${capture.stage}-${capture.shakeN}`}>
              <span>{capture.icon}</span>
            </div>
          )}
          {popups.filter(p => p.side === 'enemy').map(p => <span key={p.id} className={`bs-pop bs-pop-${p.kind}`}>{p.text}</span>)}
        </div>

        <div className="bs-field bs-field-player">
          <div className="bs-platform bs-platform-player" />
          {player && <Sprite m={player} anim={playerAnim} flip refEl={playerRef} animations={settings.animations} />}
          {popups.filter(p => p.side === 'player').map(p => <span key={p.id} className={`bs-pop bs-pop-${p.kind}`}>{p.text}</span>)}
        </div>

        {player && <InfoBox m={player} side="player" lang={lang} kind={encounter} />}

        <FxCanvas ref={fxRef} enabled={settings.effects} />
        {flash && <div className={`bs-flash bs-flash-${flash}`} />}
      </div>

      {/* ---------- PANNELLO INFERIORE ---------- */}
      <div className="bs-panel">
        <div className="bs-textbox" onClick={onTapAdvance} role="status" aria-live="polite">
          <p>{shownText}</p>
          {panel === 'busy' && message && <span className="bs-next">▼</span>}
        </div>

        {panel === 'command' && (
          <div className="bs-commands">
            <button className="bs-cmd bs-cmd-fight" onClick={() => { sfx('ui_click'); setMessage(''); setPanel('fight'); }}>⚔️ {bt('ui.fight', lang)}</button>
            <button className="bs-cmd bs-cmd-bag" onClick={() => { sfx('ui_click'); setMessage(''); setBagTab(battle.catchable ? 'catch' : 'heal'); setPanel('bag'); }}>🎒 {bt('ui.bag', lang)}</button>
            <button className="bs-cmd bs-cmd-team" onClick={() => { sfx('ui_click'); setMessage(''); setPanel('team'); }}>🧟 {bt('ui.team', lang)}</button>
            <button className="bs-cmd bs-cmd-run" disabled={battle.kind !== 'wild'} onClick={() => { sfx('ui_click'); runAction({ kind: 'run' }); }}>🏃 {bt('ui.run', lang)}</button>
          </div>
        )}

        {panel === 'fight' && logicPlayer && (
          <div className="bs-sub">
            <div className="bs-moves">
              {logicPlayer.moves.map((move, idx) => (
                <button
                  key={`${move.id}-${idx}`}
                  className="bs-move"
                  style={{ ['--tc' as any]: typeColors[move.type] }}
                  disabled={move.pp <= 0}
                  onClick={() => { sfx('ui_click'); runAction({ kind: 'move', index: idx }); }}
                >
                  <span className="bs-move-top">
                    <span className="bs-move-name">{tMove(move.id, lang)}</span>
                    <span className={`bs-move-pp ${move.pp <= Math.ceil(move.maxPp / 4) ? 'low' : ''}`}>{move.pp}/{move.maxPp}</span>
                  </span>
                  <span className="bs-move-bottom">
                    <TypeBadge type={move.type} label={tType(move.type, lang)} small />
                    <span className="bs-move-stats">{move.power > 0 ? `${bt('ui.power', lang)} ${move.power}` : bt('ui.status_move', lang)} · {move.accuracy}%</span>
                  </span>
                  <span className="bs-move-extra">
                    {effLabel(move)}
                    {moveDetail(move) && <span className="bs-move-detail">{moveDetail(move)}</span>}
                  </span>
                </button>
              ))}
              {logicPlayer.moves.every(m => m.pp <= 0) && (
                <button className="bs-move" onClick={() => runAction({ kind: 'move', index: 0 })}>
                  <span className="bs-move-name">{bt('struggle', lang, { m: tMonster(logicPlayer.id, lang) })}</span>
                </button>
              )}
            </div>
            <button className="bs-back" onClick={() => { sfx('ui_back'); setPanel('command'); }}>← {bt('ui.back', lang)}</button>
          </div>
        )}

        {panel === 'bag' && (
          <div className="bs-sub">
            <div className="bs-tabs" role="tablist">
              {(['heal', 'catch', 'tools'] as BagTab[]).map(tab => (
                <button key={tab} role="tab" aria-selected={bagTab === tab} className={`bs-tab ${bagTab === tab ? 'on' : ''}`} disabled={tab === 'catch' && !battle.catchable} onClick={() => { sfx('ui_click'); setBagTab(tab); }}>
                  {tab === 'heal' ? '🧪' : tab === 'catch' ? '🎃' : '💎'} {bt(`ui.tab_${tab}`, lang)}
                </button>
              ))}
            </div>
            <div className="bs-items">
              {tabItems.length === 0 && <p className="bs-empty">{bt('ui.empty_bag', lang)}</p>}
              {tabItems.map(item => {
                const chance = bagTab === 'catch' && logicEnemy ? Math.round(captureChance(logicEnemy, item.id, cfg.captureBonus) * 100) : null;
                return (
                  <button key={item.id} className="bs-item" onClick={() => handleItem(item.id)}>
                    <span className="bs-item-icon">{item.emoji}</span>
                    <span className="bs-item-main">
                      <span className="bs-item-name">{tItem(item.id, lang)} <span className="bs-item-qty">×{item.quantity}</span></span>
                      <span className="bs-item-desc">{tItemDesc(item.id, lang)}</span>
                    </span>
                    {chance !== null && <span className={`bs-chance ${chance >= 60 ? 'good' : chance >= 30 ? 'mid' : 'bad'}`}>{chance}%</span>}
                  </button>
                );
              })}
            </div>
            <button className="bs-back" onClick={() => { sfx('ui_back'); setPanel('command'); }}>← {bt('ui.back', lang)}</button>
          </div>
        )}

        {(panel === 'team' || panel === 'forced' || panel === 'target') && (
          <div className="bs-sub">
            {panel === 'target' && <p className="bs-subtitle">{bt('ui.choose_target', lang)}</p>}
            <div className="bs-teamlist">
              {battle.team.map((m, idx) => {
                const fainted = m.stats.hp <= 0;
                const isActive = idx === battle.active;
                const reviving = pendingItem === 'lacrime_banshee';
                const disabled = panel === 'target'
                  ? (reviving ? !fainted : fainted)
                  : fainted || isActive;
                const ratio = m.stats.hp / Math.max(1, m.stats.maxHp);
                return (
                  <button
                    key={idx}
                    className={`bs-teammon ${isActive ? 'active' : ''} ${fainted ? 'fainted' : ''}`}
                    disabled={disabled}
                    onClick={() => {
                      sfx('ui_click');
                      if (panel === 'target' && pendingItem) runAction({ kind: 'item', itemId: pendingItem, targetIndex: idx });
                      else runAction({ kind: 'switch', index: idx });
                    }}
                  >
                    <img src={getMonsterIconPath(m.id) || ''} alt="" draggable={false} className={m.shiny ? 'bs-shiny-img' : ''} />
                    <span className="bs-teammon-main">
                      <span className="bs-teammon-name">{tMonster(m.id, lang)} <small>Lv.{m.level}</small></span>
                      <span className="bs-mini-hp"><span style={{ width: `${Math.max(0, ratio) * 100}%`, background: hpColor(ratio) }} /></span>
                      <span className="bs-teammon-sub">
                        <TypeIcon type={m.type} size={14} /> {Math.max(0, m.stats.hp)}/{m.stats.maxHp}
                        {majorStatusOf(m) && <StatusChip status={majorStatusOf(m)!} lang={lang} />}
                        {isActive && <em>{bt('ui.active', lang)}</em>}
                        {fainted && <em className="ko">{bt('ui.fainted', lang)}</em>}
                      </span>
                      <span className="bs-teammon-ability">{tAbilityName(m.ability, lang)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {panel !== 'forced' && (
              <button className="bs-back" onClick={() => { sfx('ui_back'); setPendingItem(null); setPanel(panel === 'target' ? 'bag' : 'command'); }}>← {bt('ui.back', lang)}</button>
            )}
          </div>
        )}

        {panel === 'pp' && logicPlayer && (
          <div className="bs-sub">
            <p className="bs-subtitle">{bt('ui.choose_move_pp', lang)}</p>
            <div className="bs-moves">
              {logicPlayer.moves.map((move, idx) => (
                <button key={idx} className="bs-move" style={{ ['--tc' as any]: typeColors[move.type] }} disabled={move.pp >= move.maxPp}
                  onClick={() => runAction({ kind: 'item', itemId: 'cristallo_pp', moveIndex: idx })}>
                  <span className="bs-move-top"><span className="bs-move-name">{tMove(move.id, lang)}</span><span className="bs-move-pp">{move.pp}/{move.maxPp}</span></span>
                </button>
              ))}
            </div>
            <button className="bs-back" onClick={() => { sfx('ui_back'); setPendingItem(null); setPanel('bag'); }}>← {bt('ui.back', lang)}</button>
          </div>
        )}
      </div>

      {/* ---------- NUOVA MOSSA ---------- */}
      {panel === 'learn' && learnCurrent && battle.team[learnCurrent.teamIndex] && (
        <div className="bs-modal">
          <div className="bs-modal-card">
            <h3>✨ {bt('ui.new_move_title', lang)}</h3>
            <p className="bs-modal-text">{bt('ui.forget_which', lang, { m: tMonster(battle.team[learnCurrent.teamIndex].id, lang), move: tMove(learnCurrent.move.id, lang) })}</p>
            <div className="bs-newmove" style={{ ['--tc' as any]: typeColors[learnCurrent.move.type] }}>
              <span className="bs-move-name">{tMove(learnCurrent.move.id, lang)}</span>
              <TypeBadge type={learnCurrent.move.type} label={tType(learnCurrent.move.type, lang)} small />
              <span className="bs-move-stats">{learnCurrent.move.power > 0 ? `${bt('ui.power', lang)} ${learnCurrent.move.power}` : bt('ui.status_move', lang)} · {learnCurrent.move.accuracy}% · PP {learnCurrent.move.maxPp}</span>
            </div>
            <div className="bs-moves">
              {battle.team[learnCurrent.teamIndex].moves.map((move, idx) => (
                <button key={idx} className="bs-move bs-move-forget" style={{ ['--tc' as any]: typeColors[move.type] }} onClick={() => resolveLearn(idx)}>
                  <span className="bs-move-top"><span className="bs-move-name">{tMove(move.id, lang)}</span><span className="bs-move-pp">{move.pp}/{move.maxPp}</span></span>
                  <span className="bs-move-bottom"><TypeBadge type={move.type} label={tType(move.type, lang)} small /><span className="bs-move-stats">{move.power > 0 ? `${bt('ui.power', lang)} ${move.power}` : bt('ui.status_move', lang)} · {move.accuracy}%</span></span>
                </button>
              ))}
            </div>
            <button className="bs-back" onClick={() => resolveLearn(null)}>✕ {bt('ui.dont_learn', lang)}</button>
          </div>
        </div>
      )}

      {/* ---------- VITTORIA / SCONFITTA ---------- */}
      {panel === 'victory' && (
        <div className="bs-modal">
          <div className="bs-modal-card bs-victory">
            <h2>{bt('ui.victory', lang)}</h2>
            <div className="bs-rewards">
              <div className="bs-reward"><span>🍬</span><b>+{doubled ? rewards.candies * 2 : rewards.candies}</b><small>{bt('ui.candies', lang)}</small></div>
              {rewards.coins > 0 && <div className="bs-reward"><span>🪙</span><b>+{rewards.coins}</b><small>{bt('ui.coins', lang)}</small></div>}
            </div>
            <p className="bs-rest">{bt('ui.rest_heal', lang, { n: 10 })}</p>
            {props.canDoubleAd && !doubled && rewards.candies > 0 && (
              <button
                className="bs-ad-btn"
                disabled={adBusy}
                onClick={async () => {
                  setAdBusy(true);
                  const ok = await props.onWatchDoubleAd();
                  setAdBusy(false);
                  if (ok) { setDoubled(true); sfx('coin'); setMessage(bt('ui.doubled', lang)); }
                }}
              >
                {adBusy ? '⏳' : '📺'} {bt('ui.double_ad', lang)}
              </button>
            )}
            <button className="bs-primary" disabled={adBusy} onClick={() => { sfx('ui_confirm'); finishBattle(finishedOutcome || 'victory', battle, doubled); }}>
              {bt('ui.continue', lang)} ➜
            </button>
          </div>
        </div>
      )}
      {panel === 'defeat' && (
        <div className="bs-modal">
          <div className="bs-modal-card bs-defeat">
            <h2>{bt('ui.defeat', lang)}</h2>
            <p className="bs-modal-text">{bt('defeat', lang)}</p>
            <button className="bs-primary" onClick={() => { sfx('ui_back'); finishBattle('defeat', battle, false); }}>{bt('ui.continue', lang)} ➜</button>
          </div>
        </div>
      )}
    </div>
  );
}
