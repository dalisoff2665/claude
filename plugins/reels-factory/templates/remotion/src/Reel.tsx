import React from "react";
import {
  AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate,
  spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";

/* ── дизайн-токены ─────────────────────────────────────────────── */
const CUTOUT = {
  bg: "#C6D9E3",
  card: "#A1AD9B",
  panel: "#181818",
  ink: "#0B0B0C",
  cardTop: 66.2,   // % высоты — верх карточки под человеком
  overlap: 16.6,   // % — насколько голова выходит выше карточки
  cardRadius: 64,
};

const SCENE = {
  sceneBg: "#101114",
  badgeBg: "#131217",
  accent: "#3FE8C2",
  textOn: "#FFFFFF",
  dot: 22,
  dotInk: "rgba(255,255,255,0.05)",
  // карточка спикера — снята с референса, не менять без причины
  cardWidth: 45,      // % ширины кадра
  cardBottom: 1.6,    // % отступ снизу
  cardRadius: 42,
};

const SPLIT = {
  panelTop: "#303E4D",
  panelBottom: "#253143",
  accent: "#FF7445",
  green: "#1D6036",
  blue: "#0F468E",
  textOn: "#FFFFFF",
  textOff: "#8C929B",
  grid: 40,
  gridInk: "rgba(255,255,255,0.035)",
};

const T = {
  slideBg: "#F2F2F4",
  ink: "#0B0B0C",
  accent: "#2B6CFF",
  muted: "#6B6B73",
  chipBg: "rgba(255,255,255,0.92)",
  radius: 28,
  font: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, Menlo, monospace",
};

type Item = any;
type Edl = {
  meta: { width: number; height: number; fps: number; duration: number };
  timeline: Item[];
  captions: { s: number; e: number; text: string; highlight?: string[] }[];
  audio: { music?: { url: string; gain_db?: number }; sfx?: { at: number; url: string; gain_db?: number }[] };
  aroll?: string;
};

const db = (v = 0) => Math.pow(10, v / 20);
const sec = (t: number, fps: number) => Math.round(t * fps);

/* ── A-roll: говорящая голова, база под всем ───────────────────── */
const ARoll: React.FC<{ src: string }> = ({ src }) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <OffthreadVideo src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  </AbsoluteFill>
);

/* ── мокап окна: скриншот НИКОГДА не голый ─────────────────────── */
const Mockup: React.FC<{ src: string; kind?: string }> = ({ src, kind = "window" }) => {
  if (kind === "none") return null;
  const isTerm = kind === "terminal";
  return (
    <div style={{
      width: "84%", borderRadius: 20, overflow: "hidden",
      background: isTerm ? "#15161A" : "#fff",
      boxShadow: "0 24px 60px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.06)",
    }}>
      <div style={{
        height: 34, display: "flex", alignItems: "center", gap: 7, paddingLeft: 14,
        background: isTerm ? "#1D1E24" : "#EDEDF0",
      }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <div key={c} style={{ width: 11, height: 11, borderRadius: 6, background: c }} />
        ))}
        <span style={{ marginLeft: 10, fontSize: 15, fontFamily: T.font, color: isTerm ? "#8A8B92" : T.muted }}>
          Запись экрана
        </span>
      </div>
      <Img src={src} style={{ width: "100%", display: "block" }} />
    </div>
  );
};

/* ── слайд: eyebrow + заголовок + мокап + подпись ──────────────── */
const Slide: React.FC<{ item: Item }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // пресет yapping: сырой скриншот на весь кадр, без рамки и текста
  if (item.mockup_kind === "none" && item.mockup) {
    return (
      <AbsoluteFill style={{ background: "#fff" }}>
        <Img src={item.mockup} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    );
  }

  const rise = spring({ frame, fps, config: { damping: 200, mass: 0.5 } });
  const y = interpolate(rise, [0, 1], [26, 0]);

  return (
    <AbsoluteFill style={{
      background: T.slideBg, fontFamily: T.font,
      padding: "150px 70px", alignItems: "center",
      opacity: interpolate(frame, [0, 4], [0, 1], { extrapolateRight: "clamp" }),
    }}>
      {item.bg && (
        <AbsoluteFill style={{ zIndex: -1 }}>
          <OffthreadVideo
            src={item.bg}
            muted
            loop
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }}
          />
        </AbsoluteFill>
      )}
      <div style={{ width: "100%", transform: `translateY(${y}px)` }}>
        {item.eyebrow && (
          <div style={{
            fontSize: 24, fontWeight: 600, letterSpacing: 1.6,
            color: T.accent, textTransform: "uppercase", marginBottom: 22,
          }}>{item.eyebrow}</div>
        )}
        <div style={{
          fontSize: 74, lineHeight: 1.06, fontWeight: 600,
          color: T.ink, letterSpacing: -1.8, marginBottom: 64, whiteSpace: "pre-line",
        }}>{item.title}</div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
        {item.mockup && (
          <div style={{
            width: "100%", display: "flex", justifyContent: "center",
            transform: `translateY(${y * 1.6}px)`,
          }}>
            <Mockup src={item.mockup} kind={item.mockup_kind} />
          </div>
        )}
      </div>

      {item.caption && (
        <div style={{ fontSize: 32, color: T.ink, textAlign: "center", marginTop: 40, lineHeight: 1.3 }}>
          {item.caption}
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ── чип: всплывающая пилюля с лого ────────────────────────────── */
const Chip: React.FC<{ item: Item }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 180, mass: 0.6 } });
  const align = { left: "flex-start", center: "center", right: "flex-end" }[
    (item.position as "left" | "center" | "right") || "center"
  ];

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: align, paddingLeft: 70, paddingRight: 70 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 18,
        background: T.chipBg, borderRadius: 999, padding: "22px 38px",
        boxShadow: "0 12px 34px rgba(0,0,0,0.16)",
        backdropFilter: "blur(14px)",
        transform: `scale(${interpolate(pop, [0, 1], [0.82, 1])})`,
        opacity: pop,
      }}>
        {item.logo_url && <Img src={item.logo_url} style={{ width: 46, height: 46, objectFit: "contain" }} />}
        <span style={{
          fontSize: 38, fontWeight: 500, color: T.ink,
          fontFamily: item.mono ? T.mono : T.font,
        }}>{item.label}</span>
      </div>
    </AbsoluteFill>
  );
};

/* ── B-roll полноэкранный / PiP в углу ─────────────────────────── */
const BRoll: React.FC<{ item: Item }> = ({ item }) => (
  <AbsoluteFill style={{ background: T.slideBg }}>
    <OffthreadVideo
      src={item.src.startsWith("http") ? item.src : staticFile(item.src)}
      startFrom={sec(item.src_in || 0, 30)}
      playbackRate={item.speed || 1}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  </AbsoluteFill>
);

const Pip: React.FC<{ item: Item }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 16, mass: 0.5 } });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: 60, paddingBottom: 420 }}>
      <div style={{
        width: 330, borderRadius: 22, overflow: "hidden",
        boxShadow: "0 18px 44px rgba(0,0,0,0.3)",
        transform: `scale(${interpolate(pop, [0, 1], [0.8, 1])})`, opacity: pop,
      }}>
        <OffthreadVideo
          src={item.src.startsWith("http") ? item.src : staticFile(item.src)}
          startFrom={sec(item.src_in || 0, 30)}
          style={{ width: "100%", display: "block" }}
        />
      </div>
    </AbsoluteFill>
  );
};

/* ── словный субтитр: одно слово крупно, центр-верх (пресет yapping) ── */
const WordCaption: React.FC<{ cap: Edl["captions"][0] }> = ({ cap }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 18, stiffness: 220, mass: 0.4 } });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 300 }}>
      <div style={{
        fontFamily: T.font, fontSize: 96, fontWeight: 700, color: "#fff",
        letterSpacing: -2, textAlign: "center", maxWidth: "90%",
        textShadow: "0 4px 24px rgba(0,0,0,0.6)",
        transform: `scale(${interpolate(pop, [0, 1], [0.94, 1])})`,
      }}>{cap.text}</div>
    </AbsoluteFill>
  );
};

/* ── ретро-плашка счётчика: FIRST / SECOND / … (пресет yapping) ──── */
const Plate: React.FC<{ item: Item }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 15, mass: 0.5 } });
  return (
    <AbsoluteFill style={{
      background: "#fff", justifyContent: "center", alignItems: "center", gap: 46,
    }}>
      <div style={{
        border: "5px solid #0B0B0C", borderRadius: 10, padding: "20px 56px",
        background: "#0B0B0C", transform: `scale(${interpolate(pop, [0, 1], [0.9, 1])})`,
      }}>
        <span style={{
          fontFamily: T.font, fontSize: 64, fontWeight: 800, color: "#fff",
          letterSpacing: 3, textTransform: "uppercase",
        }}>{item.label}</span>
      </div>
      {item.logo_url && (
        <div style={{
          background: "#fff", borderRadius: 26, padding: 34,
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)", border: "1px solid #E6E6EA",
        }}>
          <Img src={item.logo_url} style={{ width: 110, height: 110, objectFit: "contain" }} />
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ── субтитры: акцент на 1–2 словах ────────────────────────────── */
const Caption: React.FC<{ cap: Edl["captions"][0] }> = ({ cap }) => {
  const hl = (cap.highlight || []).map((h) => h.toLowerCase().replace(/[.,!?—]/g, ""));
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 300 }}>
      <div style={{
        maxWidth: "88%", textAlign: "center", fontFamily: T.font,
        fontSize: 58, fontWeight: 700, lineHeight: 1.16, letterSpacing: -0.5,
        textShadow: "0 3px 18px rgba(0,0,0,0.55)",
      }}>
        {cap.text.split(" ").map((w, i) => {
          const on = hl.includes(w.toLowerCase().replace(/[.,!?—]/g, ""));
          return (
            <span key={i} style={{ color: on ? "#9DC0FF" : "#fff", marginRight: 14 }}>{w}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ── графическая панель: верхняя половина кадра (пресет split) ──── */
const Panel: React.FC<{ item: Item; theme: any }> = ({ item, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 200, mass: 0.5 } });
  const y = interpolate(rise, [0, 1], [18, 0]);
  const fade = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: "clamp" });

  const kind = item.panel_kind || "plain";
  const bg =
    kind === "color"
      ? (item.color === "blue" ? theme.blue : theme.green)
      : `linear-gradient(180deg, ${theme.panelTop} 0%, ${theme.panelBottom} 100%)`;

  return (
    <AbsoluteFill style={{ height: "50%", background: bg, overflow: "hidden", opacity: fade }}>
      {/* сетка-миллиметровка: фактура, которую почти не видно */}
      {kind !== "color" && (
        <AbsoluteFill style={{
          backgroundImage:
            `linear-gradient(${theme.gridInk} 1px, transparent 1px),` +
            `linear-gradient(90deg, ${theme.gridInk} 1px, transparent 1px)`,
          backgroundSize: `${theme.grid}px ${theme.grid}px`,
        }} />
      )}

      {item.eyebrow && (
        <div style={{
          position: "absolute", top: 54, left: 54,
          border: "1.5px solid rgba(255,255,255,0.28)", borderRadius: 999,
          padding: "9px 20px", fontFamily: T.font, fontSize: 21, fontWeight: 600,
          letterSpacing: 2.2, color: "rgba(255,255,255,0.86)", textTransform: "uppercase",
        }}>{item.eyebrow}</div>
      )}

      <AbsoluteFill style={{
        justifyContent: "center", alignItems: "center",
        padding: "120px 60px 180px", transform: `translateY(${y}px)`,
      }}>
        {kind === "color" && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: T.font, fontSize: 200, fontWeight: 800,
              color: "#fff", lineHeight: 1, letterSpacing: -6,
            }}>{item.big}</div>
            {item.unit && (
              <div style={{
                fontFamily: T.font, fontSize: 30, fontWeight: 600,
                color: "rgba(255,255,255,0.75)", marginTop: 12, letterSpacing: 1,
              }}>{item.unit}</div>
            )}
          </div>
        )}

        {kind === "mockup" && item.mockup && (
          <div style={{
            width: "78%", borderRadius: 14, overflow: "hidden",
            boxShadow: "0 22px 50px rgba(0,0,0,0.38)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}>
            <Img src={item.mockup} style={{ width: "100%", display: "block" }} />
          </div>
        )}

        {kind === "plain" && item.title && (
          <div style={{
            fontFamily: T.font, fontSize: 62, fontWeight: 700, color: "#fff",
            textAlign: "center", lineHeight: 1.12, letterSpacing: -1.4, whiteSpace: "pre-line",
          }}>{item.title}</div>
        )}

        {item.chip_word && (
          <div style={{
            marginTop: 26, background: theme.accent, borderRadius: 14,
            padding: "12px 30px", fontFamily: T.font, fontSize: 52,
            fontWeight: 700, color: "#fff", letterSpacing: -0.5,
          }}>{item.chip_word}</div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ── субтитры split: произнесённое белым, остаток серым ────────── */
const ProgressiveCaption: React.FC<{ cap: any; theme: any }> = ({ cap, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = cap.s + frame / fps;
  const words: any[] = cap.words || cap.text.split(" ").map((w: string) => ({ w, s: cap.s }));

  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: "40.5%" }}>
      <div style={{
        maxWidth: "86%", textAlign: "center", fontFamily: T.font,
        fontSize: 46, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.4,
      }}>
        {words.map((w, i) => (
          <span key={i} style={{
            color: (w.s ?? cap.s) <= t ? theme.textOn : theme.textOff,
            marginRight: 11,
          }}>{w.w ?? w}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* ── фон сцены: точечная сетка + ambient за объектами (пресет scene) ── */
const SceneBg: React.FC<{ item: Item; theme: any }> = ({ item, theme }) => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  const kind = item.scene_kind || "dark";
  const bg =
    kind === "light" ? "#F4F4F6" :
    kind === "color" ? (item.color || "#FA792B") :
    theme.sceneBg;
  const dark = kind === "dark";

  return (
    <AbsoluteFill style={{ background: bg, opacity: fade }}>
      {dark && (
        <>
          <AbsoluteFill style={{
            backgroundImage: `radial-gradient(${theme.dotInk} 1.2px, transparent 1.2px)`,
            backgroundSize: `${theme.dot}px ${theme.dot}px`,
          }} />
          {/* ambient за сценой — не свечение объектов, а подсветка фона */}
          <AbsoluteFill style={{
            background:
              "radial-gradient(700px 500px at 88% 4%, rgba(250,121,43,0.10), transparent 70%)," +
              "radial-gradient(760px 620px at 96% 42%, rgba(63,232,194,0.09), transparent 72%)",
          }} />
        </>
      )}
    </AbsoluteFill>
  );
};

/* ── бейдж: пилюля с лого или номером (пресет scene) ────────────── */
const Badge: React.FC<{ item: Item; theme: any; index: number }> = ({ item, theme, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 16, stiffness: 190, mass: 0.5 } });
  const light = item.scene_kind === "light";

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 16,
      background: light ? "#FFFFFF" : theme.badgeBg,
      border: light ? "1px solid #E4E4E8" : "1px solid rgba(255,255,255,0.10)",
      borderRadius: 999, padding: "16px 34px 16px 16px",
      boxShadow: light
        ? "0 6px 20px rgba(0,0,0,0.08)"
        : "0 10px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)",
      transform: `scale(${interpolate(pop, [0, 1], [0.86, 1])})`,
      opacity: pop,
      marginLeft: item.offset_x ? `${item.offset_x}%` : 0,
    }}>
      {item.number ? (
        <div style={{
          width: 44, height: 44, borderRadius: 999, background: theme.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: T.font, fontSize: 26, fontWeight: 800, color: "#062B22",
        }}>{item.number}</div>
      ) : item.logo_url ? (
        <div style={{
          width: 44, height: 44, borderRadius: 999, background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
        }}>
          <Img src={item.logo_url} style={{ width: 30, height: 30, objectFit: "contain" }} />
        </div>
      ) : null}
      <span style={{
        fontFamily: T.font, fontSize: 34, fontWeight: 700,
        color: light ? "#0B0B0C" : "#fff", letterSpacing: -0.4,
      }}>{item.label}</span>
    </div>
  );
};

/* ── стек бейджей: накапливаются по ходу речи ──────────────────── */
const BadgeStack: React.FC<{ items: Item[]; theme: any }> = ({ items, theme }) => (
  <AbsoluteFill style={{
    height: "70%", justifyContent: "center", alignItems: "center",
    gap: 26, padding: "0 60px", flexDirection: "column",
  }}>
    {items.map((it, i) => <Badge key={i} item={it} theme={theme} index={i} />)}
  </AbsoluteFill>
);

/* ── крупная цифра ──────────────────────────────────────────────── */
const BigFigure: React.FC<{ item: Item; theme: any }> = ({ item, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 200, mass: 0.6 } });
  return (
    <AbsoluteFill style={{ height: "70%", justifyContent: "center", alignItems: "center" }}>
      <div style={{
        fontFamily: T.font, fontSize: 132, fontWeight: 800,
        color: item.scene_kind === "light" ? "#0B0B0C" : "#fff",
        letterSpacing: -4, textAlign: "center",
        transform: `translateY(${interpolate(pop, [0, 1], [22, 0])}px)`, opacity: pop,
      }}>{item.big}</div>
      {item.unit && (
        <div style={{
          fontFamily: T.font, fontSize: 30, fontWeight: 500, marginTop: 14,
          color: item.scene_kind === "light" ? "#5A5A62" : "rgba(255,255,255,0.7)",
          textAlign: "center", maxWidth: "76%",
        }}>{item.unit}</div>
      )}
    </AbsoluteFill>
  );
};

/* ── карточка спикера: фиксирована весь ролик ───────────────────── */
const SpeakerCard: React.FC<{ src: string; theme: any }> = ({ src, theme }) => (
  <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
    <div style={{
      width: `${theme.cardWidth}%`, aspectRatio: "1 / 1",
      marginBottom: `${theme.cardBottom}%`,
      borderRadius: theme.cardRadius, overflow: "hidden",
      boxShadow: "0 18px 44px rgba(0,0,0,0.5)",
    }}>
      <OffthreadVideo src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  </AbsoluteFill>
);

/* ── субтитр с подчёркиванием ключевого слова ───────────────────── */
const UnderlineCaption: React.FC<{ cap: any; theme: any; light?: boolean }> = ({ cap, theme, light }) => {
  const hl = (cap.highlight || []).map((x: string) => x.toLowerCase().replace(/[.,!?—]/g, ""));
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: "55%" }}>
      <div style={{
        maxWidth: "84%", textAlign: "center", fontFamily: T.font,
        fontSize: 40, fontWeight: 500, lineHeight: 1.3,
        color: light ? "#0B0B0C" : "#fff",
      }}>
        {cap.text.split(" ").map((w: string, i: number) => {
          const on = hl.includes(w.toLowerCase().replace(/[.,!?—]/g, ""));
          return (
            <span key={i} style={{
              marginRight: 10,
              borderBottom: on ? `3px solid ${theme.accent}` : "none",
              paddingBottom: on ? 3 : 0,
            }}>{w}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ═══ ПЯТЬ ФОРМАТОВ ГОВОРЯЩЕЙ ГОЛОВЫ (как в CLONY) ═══════════════
   head_layout: split | split_reverse | cutout | jump | circle
   demo_share:  доля кадра под демо, % (по умолчанию 62)
   Всё это рендер, а не генерация — HeyGen за форму не платится.
   ═══════════════════════════════════════════════════════════════ */

const Demo: React.FC<{ src: string; style?: any }> = ({ src, style }) => (
  <OffthreadVideo
    src={src.startsWith("http") ? src : staticFile(src)}
    style={{ width: "100%", height: "100%", objectFit: "cover", ...style }}
  />
);

const Head: React.FC<{ src: string; style?: any; chroma?: string }> = ({ src, style, chroma }) => (
  <OffthreadVideo
    src={src.startsWith("http") ? src : staticFile(src)}
    style={{
      width: "100%", height: "100%", objectFit: "cover",
      // вырез по однотонному фону HeyGen делается на этапе ffmpeg,
      // сюда приходит уже .webm с альфой
      ...style,
    }}
  />
);

const HeadLayout: React.FC<{
  aroll: string; demo?: string; layout: string; share: number; frame?: number;
}> = ({ aroll, demo, layout, share, frame = 0 }) => {
  const { fps } = useVideoConfig();
  const f = useCurrentFrame();
  const demoPct = Math.min(85, Math.max(15, share || 62));

  // ── Сплит: демо сверху, ты снизу
  if (layout === "split") {
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <AbsoluteFill style={{ height: `${demoPct}%`, overflow: "hidden" }}>
          {demo && <Demo src={demo} />}
        </AbsoluteFill>
        <AbsoluteFill style={{ top: `${demoPct}%`, height: `${100 - demoPct}%`, overflow: "hidden" }}>
          <Head src={aroll} />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // ── Сплит наоборот: ты сверху, демо снизу
  if (layout === "split_reverse") {
    const headPct = 100 - demoPct;
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <AbsoluteFill style={{ height: `${headPct}%`, overflow: "hidden" }}>
          <Head src={aroll} />
        </AbsoluteFill>
        <AbsoluteFill style={{ top: `${headPct}%`, height: `${demoPct}%`, overflow: "hidden" }}>
          {demo && <Demo src={demo} />}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // ── Вырезанный: демо на весь кадр, ты внизу без фона
  if (layout === "cutout") {
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        {demo && <Demo src={demo} />}
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
          <div style={{ width: "62%", height: "48%", overflow: "hidden" }}>
            <Head src={aroll} style={{ objectFit: "contain", objectPosition: "bottom" }} />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // ── Прыжок: угол меняется каждые 2.5 секунды
  if (layout === "jump") {
    const corners = [
      { justifyContent: "flex-end", alignItems: "flex-start" },
      { justifyContent: "flex-end", alignItems: "flex-end" },
      { justifyContent: "flex-start", alignItems: "flex-end" },
      { justifyContent: "flex-start", alignItems: "flex-start" },
    ];
    const step = Math.floor(f / (fps * 2.5)) % corners.length;
    const pop = spring({ frame: f % Math.round(fps * 2.5), fps,
                         config: { damping: 18, mass: 0.4 } });
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        {demo && <Demo src={demo} />}
        <AbsoluteFill style={{ padding: 54, ...corners[step] }}>
          <div style={{
            width: "44%", aspectRatio: "3 / 4", borderRadius: 32, overflow: "hidden",
            boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
            transform: `scale(${interpolate(pop, [0, 1], [0.94, 1])})`,
          }}>
            <Head src={aroll} />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // ── Кружок: ты в круге поверх демо
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {demo && <Demo src={demo} />}
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: "12%" }}>
        <div style={{
          width: "46%", aspectRatio: "1 / 1", borderRadius: "50%", overflow: "hidden",
          border: "6px solid rgba(255,255,255,0.92)",
          boxShadow: "0 18px 44px rgba(0,0,0,0.5)",
        }}>
          <Head src={aroll} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ═══ ПРЕСЕТ story — поездки, фото и видео с телефона ════════════ */

/* Фото с эффектом Кена Бёрнса: медленный наезд и снос.
   Статичная фотография на 3 секунды — мёртвый кадр, движение обязательно. */
const KenBurns: React.FC<{ item: Item }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });

  const dir = item.motion || "in";
  const scale =
    dir === "in" ? interpolate(p, [0, 1], [1.0, 1.14]) :
    dir === "out" ? interpolate(p, [0, 1], [1.14, 1.0]) : 1.08;
  const x = dir === "left" ? interpolate(p, [0, 1], [3, -3])
          : dir === "right" ? interpolate(p, [0, 1], [-3, 3]) : 0;

  const src = item.src.startsWith("http") ? item.src : staticFile(item.src);

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {/* горизонтальный кадр в вертикали: размытая подложка вместо чёрных полей */}
      <AbsoluteFill>
        <Img src={src} style={{
          width: "100%", height: "100%", objectFit: "cover",
          filter: "blur(38px) brightness(0.45)", transform: "scale(1.2)",
        }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Img src={src} style={{
          width: "100%", height: "100%", objectFit: "contain",
          transform: `scale(${scale}) translateX(${x}%)`,
        }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* Видео с телефона — та же вписка в вертикаль */
const PhoneClip: React.FC<{ item: Item }> = ({ item }) => {
  const src = item.src.startsWith("http") ? item.src : staticFile(item.src);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill>
        <OffthreadVideo src={src} startFrom={sec(item.src_in || 0, 30)} muted
          style={{ width: "100%", height: "100%", objectFit: "cover",
                   filter: "blur(38px) brightness(0.45)", transform: "scale(1.2)" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <OffthreadVideo src={src} startFrom={sec(item.src_in || 0, 30)}
          playbackRate={item.speed || 1}
          style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* Титр места и даты — внизу, мелко, без плашки */
const PlaceTitle: React.FC<{ item: Item }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 200, mass: 0.6 } });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 220 }}>
      <div style={{
        textAlign: "center", fontFamily: T.font,
        transform: `translateY(${interpolate(rise, [0, 1], [14, 0])}px)`, opacity: rise,
      }}>
        <div style={{
          fontSize: 52, fontWeight: 600, color: "#fff", letterSpacing: -0.8,
          textShadow: "0 2px 16px rgba(0,0,0,0.6)",
        }}>{item.place}</div>
        {item.date && (
          <div style={{
            fontSize: 26, fontWeight: 500, marginTop: 8, letterSpacing: 2.4,
            color: "rgba(255,255,255,0.75)", textTransform: "uppercase",
            textShadow: "0 2px 12px rgba(0,0,0,0.6)",
          }}>{item.date}</div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/* ═══ ПРЕСЕТ cutout — человек вырезан и лежит ПОВЕРХ карточки ════
   aroll должен быть .webm с альфа-каналом:
     ffmpeg -i raw.mp4 -vf "colorkey=0x00FF00:0.30:0.10" -c:v libvpx-vp9 aroll.webm
   или rembg для съёмки без зелёного экрана.
   ═══════════════════════════════════════════════════════════════ */

const CutoutFrame: React.FC<{ item: Item; theme: any; aroll: string }> = ({ item, theme, aroll }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 200, mass: 0.5 } });

  const cardTop = item.card_top ?? theme.cardTop;
  // человек стоит выше карточки на overlap — отсюда и берётся глубина
  const personTop = cardTop - (item.overlap ?? theme.overlap);

  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      {/* СЛОЙ 1 — исходное видео внутри скруглённой карточки.
          Видно фон комнаты: именно он даёт глубину, плоская заливка её убивает. */}
      <AbsoluteFill style={{
        top: `${cardTop}%`,
        margin: "0 3%",
        borderTopLeftRadius: theme.cardRadius,
        borderTopRightRadius: theme.cardRadius,
        overflow: "hidden",
        background: item.card_color || theme.card,
        opacity: interpolate(rise, [0, 1], [0, 1]),
      }}>
        <OffthreadVideo
          src={item.aroll_raw || aroll}
          style={{
            width: "100%", height: `${100 / (1 - cardTop / 100)}%`,
            objectFit: "cover",
            // тянем так, чтобы кадр внутри карточки совпал с верхним слоем
            marginTop: `-${cardTop / (1 - cardTop / 100)}%`,
          }}
        />
      </AbsoluteFill>

      {/* СЛОЙ 2 — то же видео без фона, НЕ обрезано карточкой.
          Голова выходит за её край — весь приём в этом. */}
      <AbsoluteFill style={{ top: `${personTop}%`, justifyContent: "flex-start" }}>
        <OffthreadVideo
          src={aroll}
          style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "top" }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* Тёмная панель со скриншотом — верхняя часть кадра */
const TopPanel: React.FC<{ item: Item; theme: any }> = ({ item, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 180, mass: 0.5 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: "13%" }}>
      <div style={{
        width: "84%", borderRadius: 24, overflow: "hidden", background: theme.panel,
        boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
        transform: `translateY(${interpolate(pop, [0, 1], [16, 0])}px)`, opacity: pop,
      }}>
        {item.mockup && <Img src={item.mockup} style={{ width: "100%", display: "block" }} />}
      </div>
    </AbsoluteFill>
  );
};

/* Крупный гротеск между панелью и человеком */
const Headline: React.FC<{ item: Item; theme: any }> = ({ item, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 200, mass: 0.5 } });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: "44%" }}>
      <div style={{
        fontFamily: T.font, fontSize: 68, fontWeight: 800, color: theme.ink,
        letterSpacing: -2, textAlign: "center",
        transform: `translateY(${interpolate(pop, [0, 1], [12, 0])}px)`, opacity: pop,
      }}>{item.text}</div>
    </AbsoluteFill>
  );
};

/* Акцентный титр serif-курсивом — второй шрифт, 5-6 раз за ролик */
const AccentTitle: React.FC<{ item: Item; theme: any }> = ({ item, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 200, mass: 0.7 } });
  return (
    <AbsoluteFill style={{
      justifyContent: "center", alignItems: "center",
      paddingBottom: item.position === "low" ? 0 : "36%",
    }}>
      <div style={{
        fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
        fontStyle: "italic", fontSize: item.size || 58, fontWeight: 500,
        color: item.color || theme.ink, letterSpacing: 1.5, textAlign: "center",
        opacity: pop,
      }}>{item.text}</div>
    </AbsoluteFill>
  );
};

/* ═══ ПРЕСЕТ topslot — скриншот узкой полосой сверху, лицо доминирует ══
   Граница 33%, не 50%. Субтитр стоит НА СТЫКЕ, между полосой и лицом.
   ═══════════════════════════════════════════════════════════════════ */

const TopSlot: React.FC<{ item: Item; split: number }> = ({ item, split }) => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 4], [0, 1], { extrapolateRight: "clamp" });
  const src = item.mockup || item.src;
  return (
    <AbsoluteFill style={{ height: `${split}%`, background: "#fff", overflow: "hidden", opacity: fade }}>
      {src && (
        <Img src={src.startsWith("http") ? src : staticFile(src)}
             style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
      )}
    </AbsoluteFill>
  );
};

/* Субтитр на стыке: тёмный на светлом сверху, белый на лице снизу */
const SeamCaption: React.FC<{ cap: any; split: number }> = ({ cap, split }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 18, stiffness: 200, mass: 0.4 } });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: `${split + 1.5}%` }}>
      <div style={{
        fontFamily: T.font, fontSize: 62, fontWeight: 800, color: "#0B0B0C",
        letterSpacing: -1.6, textAlign: "center",
        transform: `scale(${interpolate(pop, [0, 1], [0.94, 1])})`,
      }}>{cap.text}</div>
    </AbsoluteFill>
  );
};

/* ── сборка ────────────────────────────────────────────────────── */
export const Reel: React.FC<{ edl: Edl }> = ({ edl }) => {
  const { fps } = useVideoConfig();
  const e: any = edl;
  const arollSrc = edl.aroll
    ? (edl.aroll.startsWith("http") ? edl.aroll : staticFile(edl.aroll))
    : null;

  const layer = (types: string[]) =>
    edl.timeline.filter((i) => types.includes(i.type));

  const isSplit = e.preset === "split";
  const isScene = e.preset === "scene";
  const isCutout = e.preset === "cutout";
  const theme = { ...(isCutout ? CUTOUT : isScene ? SCENE : SPLIT), ...(e.theme || {}) };

  // в scene текущая глава определяет светлый/тёмный фон для текста
  const sceneAt = (t: number) =>
    layer(["scene"]).find((x: any) => x.s <= t && t < x.e) as any;

  // в split A-roll живёт в нижней половине, кроме моментов aroll_fullscreen
  const fullscreenWindows: any[] = layer(["aroll_fullscreen"]);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {arollSrc && e.head_layout && (
        <HeadLayout
          aroll={arollSrc}
          demo={e.demo}
          layout={e.head_layout}
          share={e.demo_share ?? 62}
        />
      )}

      {arollSrc && !isScene && !isCutout && !e.head_layout && (
        isSplit ? (
          <>
            <AbsoluteFill style={{ top: "50%", height: "50%", overflow: "hidden" }}>
              <ARoll src={arollSrc} />
            </AbsoluteFill>
            {fullscreenWindows.map((w, i) => (
              <Sequence key={`fs-aroll${i}`} from={sec(w.s, fps)}
                        durationInFrames={sec(w.e - w.s, fps)}>
                <ARoll src={arollSrc} />
              </Sequence>
            ))}
          </>
        ) : <ARoll src={arollSrc} />
      )}

      {isCutout && arollSrc && (
        <>
          {layer(["cutout"]).map((item, i) => (
            <Sequence key={`co${i}`} from={sec(item.s, fps)} durationInFrames={sec(item.e - item.s, fps)}>
              <CutoutFrame item={item} theme={theme} aroll={arollSrc} />
            </Sequence>
          ))}
          {layer(["panel_top"]).map((item, i) => (
            <Sequence key={`tp${i}`} from={sec(item.s, fps)} durationInFrames={sec(item.e - item.s, fps)}>
              <TopPanel item={item} theme={theme} />
            </Sequence>
          ))}
          {layer(["headline"]).map((item, i) => (
            <Sequence key={`hl${i}`} from={sec(item.s, fps)} durationInFrames={sec(item.e - item.s, fps)}>
              <Headline item={item} theme={theme} />
            </Sequence>
          ))}
          {layer(["accent_title"]).map((item, i) => (
            <Sequence key={`at${i}`} from={sec(item.s, fps)} durationInFrames={sec(item.e - item.s, fps)}>
              <AccentTitle item={item} theme={theme} />
            </Sequence>
          ))}
        </>
      )}

      {e.preset === "topslot" && (
        <>
          {layer(["topslot"]).map((item, i) => (
            <Sequence key={`ts${i}`} from={sec(item.s, fps)} durationInFrames={sec(item.e - item.s, fps)}>
              <TopSlot item={item} split={e.top_split ?? 33} />
            </Sequence>
          ))}
          {edl.captions.map((cap, i) => (
            <Sequence key={`sc${i}`} from={sec(cap.s, fps)}
                      durationInFrames={Math.max(1, sec(cap.e - cap.s, fps))}>
              <SeamCaption cap={cap} split={e.top_split ?? 33} />
            </Sequence>
          ))}
        </>
      )}

      {e.preset === "story" && (
        <>
          {layer(["photo", "clip"]).map((item, i) => (
            <Sequence key={`st${i}`} from={sec(item.s, fps)} durationInFrames={sec(item.e - item.s, fps)}>
              {item.type === "photo" ? <KenBurns item={item} /> : <PhoneClip item={item} />}
            </Sequence>
          ))}
          {layer(["place"]).map((item, i) => (
            <Sequence key={`pl${i}`} from={sec(item.s, fps)} durationInFrames={sec(item.e - item.s, fps)}>
              <PlaceTitle item={item} />
            </Sequence>
          ))}
        </>
      )}

      {isScene && (
        <>
          {layer(["scene"]).map((item, i) => (
            <Sequence key={`sc${i}`} from={sec(item.s, fps)} durationInFrames={sec(item.e - item.s, fps)}>
              <SceneBg item={item} theme={theme} />
            </Sequence>
          ))}

          {layer(["badge_stack"]).map((item: any, i) => (
            <Sequence key={`bs${i}`} from={sec(item.s, fps)} durationInFrames={sec(item.e - item.s, fps)}>
              <BadgeStack items={item.badges || []} theme={theme} />
            </Sequence>
          ))}

          {layer(["bigfig"]).map((item, i) => (
            <Sequence key={`bf${i}`} from={sec(item.s, fps)} durationInFrames={sec(item.e - item.s, fps)}>
              <BigFigure item={item} theme={theme} />
            </Sequence>
          ))}

          {layer(["mockup"]).map((item: any, i) => (
            <Sequence key={`mk${i}`} from={sec(item.s, fps)} durationInFrames={sec(item.e - item.s, fps)}>
              <AbsoluteFill style={{ height: "70%", justifyContent: "center", alignItems: "center" }}>
                <div style={{
                  width: item.mockup_kind === "phone" ? "46%" : "80%",
                  borderRadius: item.mockup_kind === "phone" ? 34 : 16,
                  overflow: "hidden",
                  boxShadow: "0 20px 46px rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}>
                  <Img src={item.mockup} style={{ width: "100%", display: "block" }} />
                </div>
              </AbsoluteFill>
            </Sequence>
          ))}

          {arollSrc && <SpeakerCard src={arollSrc} theme={theme} />}
        </>
      )}

      {isSplit && layer(["panel"]).map((item, i) => (
        <Sequence key={`panel${i}`} from={sec(item.s, fps)} durationInFrames={sec(item.e - item.s, fps)}>
          <Panel item={item} theme={theme} />
        </Sequence>
      ))}

      {layer(["slide", "broll"]).map((item, i) => (
        <Sequence key={`fs${i}`} from={sec(item.s, fps)} durationInFrames={sec(item.e - item.s, fps)}>
          {item.type === "slide" ? <Slide item={item} /> : <BRoll item={item} />}
        </Sequence>
      ))}

      {layer(["pip"]).map((item, i) => (
        <Sequence key={`pip${i}`} from={sec(item.s, fps)} durationInFrames={sec(item.e - item.s, fps)}>
          <Pip item={item} />
        </Sequence>
      ))}

      {layer(["chip"]).map((item, i) => (
        <Sequence key={`chip${i}`} from={sec(item.s, fps)} durationInFrames={sec(item.e - item.s, fps)}>
          {item.variant === "plate" ? <Plate item={item} /> : <Chip item={item} />}
        </Sequence>
      ))}

      {e.preset !== "topslot" && edl.captions.map((cap, i) => (
        <Sequence key={`cap${i}`} from={sec(cap.s, fps)} durationInFrames={Math.max(1, sec(cap.e - cap.s, fps))}>
          {e.captions_style === "underline"
            ? <UnderlineCaption cap={cap} theme={theme}
                light={(sceneAt(cap.s) || {}).scene_kind === "light"} />
            : e.captions_style === "progressive"
            ? <ProgressiveCaption cap={cap} theme={theme} />
            : e.captions_style === "word"
              ? <WordCaption cap={cap} />
                : <Caption cap={cap} />}
        </Sequence>
      ))}

      {edl.audio?.music?.url && (
        <Audio src={edl.audio.music.url} volume={db(edl.audio.music.gain_db ?? -26)} />
      )}
      {(edl.audio?.sfx || []).map((s, i) => (
        <Sequence key={`sfx${i}`} from={sec(s.at, fps)}>
          <Audio src={s.url} volume={db(s.gain_db ?? -12)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
