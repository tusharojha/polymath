import React, { useMemo, useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence } from "framer-motion";
import "./index.css"; // Tailwind imports
import {
  createDefaultSenseRegistry,
  defaultSensePlugins,
  type SenseOutput,
} from "@polymath/senses";
import { Sparkles, Brain, LayoutDashboard, Send, ChevronLeft, ChevronRight, Volume2, Mic, Music, Star, Award } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import mermaid from "mermaid";
import "katex/dist/katex.min.css";
import confetti from "canvas-confetti";

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#38bdf8',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#0ea5e9',
    lineColor: '#38bdf8',
    secondaryColor: '#1e293b',
    tertiaryColor: '#0b1020'
  }
});

type BrainResponse = {
  ok: boolean;
  data?: any;
  error?: string;
};

const registry = createDefaultSenseRegistry(defaultSensePlugins);

const MotionBox = motion.div;

const MarkdownBlock = ({ content }: { content: string }) => (
  <div className="prose prose-base max-w-none text-fg prose-headings:text-fg prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-3xl prose-h1:leading-tight prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-p:text-fgMuted prose-strong:text-fg prose-a:text-accent prose-code:text-accent prose-code:bg-accent/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {content}
    </ReactMarkdown>
  </div>
);

const MermaidBlock = ({ code, onFix }: { code: string; onFix?: () => void }) => {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!code) return;
    const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;

    try {
      mermaid.parse(code);
      mermaid.render(id, code)
        .then(({ svg }) => setSvg(svg))
        .catch(err => {
          console.error("Mermaid error:", err);
          setError("Mermaid parse error");
        });
    } catch (err) {
      console.error("Mermaid sync error:", err);
      setError("Mermaid parse error");
    }
  }, [code]);

  if (error) {
    return (
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-surface my-4">
        <div className="text-xs text-danger font-semibold">Diagram error — showing source</div>
        <pre className="text-xs text-fgMuted whitespace-pre-wrap">{code}</pre>
        {onFix && (
          <button className="btn btn-solid w-full" onClick={onFix}>
            Fix Diagram
          </button>
        )}
      </div>
    );
  }

  if (!svg) {
    return <div className="text-xs text-fgSubtle">Rendering diagram...</div>;
  }

  return (
    <div
      ref={containerRef}
      className="flex justify-center p-4 bg-surface rounded-xl border border-border overflow-auto my-6"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

function ExperimentViewer({ code }: { code: string }) {
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head><body style="margin:0;background:#0b0f16;color:#e5e7eb;">${code}</body></html>`;
  return (
    <iframe
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className="w-full h-[420px] rounded-xl border border-border bg-black"
      title="Experiment"
    />
  );
}

function SvgBlock({ svg }: { svg: string }) {
  return (
    <div
      className="w-full overflow-auto rounded-lg bg-white p-3 border border-border"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <pre className="w-full overflow-auto rounded-lg bg-[#0b0f16] text-[#e5e7eb] p-4 text-xs">
      <code className={`language-${language || "text"}`}>{code}</code>
    </pre>
  );
}

function QuizBlock({
  question,
  choices,
  answerType,
  expected,
  feedback
}: {
  question: string;
  choices?: string[];
  answerType: "text" | "choice";
  expected?: string;
  feedback?: { ok: boolean; message: string } | null;
}) {
  const [value, setValue] = useState("");
  const [localFeedback, setLocalFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const checkAnswer = () => {
    if (!expected) {
      setLocalFeedback({ ok: false, message: "No answer key provided." });
      return;
    }
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const expectedParts = expected.split("|").map((p) => normalize(p)).filter(Boolean);
    const normalized = normalize(value);
    const ok = expectedParts.length > 0
      ? expectedParts.some((p) => normalized.includes(p))
      : normalized === normalize(expected);

    setLocalFeedback({
      ok,
      message: ok ? "Correct — nice work." : "Not quite. Try again."
    });
    if (ok) {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    }
  };

  const effectiveFeedback = localFeedback || feedback;
  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-surface">
      <div className="text-sm font-semibold text-fg">{question}</div>
      {answerType === "choice" ? (
        <select
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="" disabled>Select an answer</option>
          {(choices || []).map((c, i) => (
            <option key={i} value={c}>{c}</option>
          ))}
        </select>
      ) : (
        <input
          className="input"
          placeholder="Type your answer..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
      <button className="btn btn-solid" onClick={checkAnswer}>
        Check Answer
      </button>
      {effectiveFeedback && (
        <div className={`text-xs ${effectiveFeedback.ok ? "text-success" : "text-danger"}`}>
          {effectiveFeedback.message}
        </div>
      )}
      {!effectiveFeedback && expected && (
        <div className="text-[10px] text-fgSubtle">Expected: {expected}</div>
      )}
    </div>
  );
}
// --- JSON-First Renderer (SDUI) ---

const TailwindComponents: Record<string, any> = {
  Box: (props: any) => <div {...props} />,
  Container: (props: any) => <div className="container mx-auto px-4" {...props} />,
  Heading: (props: any) => {
    const sizes: any = { xs: "text-sm font-bold uppercase tracking-widest", sm: "text-lg font-semibold", md: "text-2xl font-bold", lg: "text-3xl font-extrabold", xl: "text-4xl font-extrabold", "2xl": "text-5xl font-black" };
    return <h2 className={`${sizes[props.size || "md"]} text-fg tracking-tight ${props.className || ""}`} {...props} />;
  },
  Text: (props: any) => {
    const sizes: any = { xs: "text-xs", sm: "text-sm", md: "text-base", lg: "text-lg", xl: "text-xl" };
    const styles: any = { sm: "text-sm font-medium" };

    if (props.className?.includes("markdown-content")) {
      return <MarkdownBlock content={props.children} />;
    }

    let className = `${sizes[props.fontSize || "md"]} ${styles[props.textStyle] || ""} text-fg leading-relaxed`;
    if (props.color === "fgMuted") className += " text-fgMuted";
    if (props.color === "fgSubtle") className += " text-fgSubtle";
    if (props.color === "accent") className += " text-accent";
    if (props.fontWeight === "bold") className += " font-bold";
    if (props.fontWeight === "semibold") className += " font-semibold";
    if (props.textTransform === "uppercase") className += " uppercase";

    return <p className={`${className} ${props.className || ""}`} {...props} />;
  },
  Stack: (props: any) => <div className={`flex flex-col gap-4 ${props.className || ""}`} {...props} />,
  VStack: (props: any) => <div className={`flex flex-col ${props.justify === 'space-between' ? 'justify-between' : ''} ${props.align === 'stretch' ? 'items-stretch' : ''} gap-${props.gap || 2} ${props.className || ""}`} {...props} />,
  HStack: (props: any) => <div className={`flex flex-row items-center ${props.justify === 'space-between' ? 'justify-between' : ''} gap-${props.gap || 2} ${props.className || ""}`} {...props} />,
  Flex: (props: any) => <div className="flex" {...props} />,
  Button: (props: any) => (
    <button
      className={`btn ${props.variant === 'ghost' ? 'btn-ghost' : 'btn-solid'} ${props.size === 'lg' ? 'px-6 py-6 text-lg' : 'px-4 py-6'} ${props.w === 'full' ? 'w-full' : ''} ${props.className || ""}`}
      {...props}
    />
  ),
  Input: (props: any) => <input className={`input w-full ${props.className || ""}`} {...props} />,
  Select: ({ className, options, children, placeholder, onChange, ...props }: any) => {
    // LLM sometimes sends options as children
    const finalOptions = options || (Array.isArray(children) ? children : []);

    return (
      <div className="relative">
        <select
          className={`input w-full appearance-none pr-10 ${className || ""}`}
          onChange={(e) => onChange?.({ target: { value: e.target.value } })}
          {...props}
        >
          <option value="" disabled>{placeholder || "Select..."}</option>
          {finalOptions.map((o: any, idx: number) => {
            const value = typeof o === "object" ? (o.value ?? o.id) : o;
            const label = typeof o === "object" ? (o.label ?? o.text ?? o.value) : o;
            return <option key={idx} value={value}>{label}</option>;
          })}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-fgMuted">
          <ChevronRight size={16} className="rotate-90" />
        </div>
      </div>
    );
  },
  Divider: (props: any) => <div className="h-px bg-border my-4" {...props} />,
  Card: (props: any) => <div className={`card ${props.className || ""}`} {...props} />,
  ExperimentViewer: (props: any) => <ExperimentViewer code={props.code} />,
  SvgBlock: (props: any) => <SvgBlock svg={props.svg} />,
  MermaidBlock: (props: any) => <MermaidBlock code={props.code} onFix={props.onFix} />,
  CodeBlock: (props: any) => <CodeBlock code={props.code} language={props.language} />,
  QuizBlock: (props: any) => <QuizBlock {...props} />,
  Image: (props: any) => <img {...props} />
};

function JSONRenderer({ node, state, setState, onIntent, path, isThinking, disabledButtons }: any) {
  if (!node) return null;

  if (node.type === "flex") {
    const { className, ...restFlex } = node.flexBoxProperties || {};
    return (
      <div className={`flex ${className || ""}`} {...restFlex}>
        {node.contents?.map((child: any, idx: number) => (
          <JSONRenderer
            key={idx}
            node={child}
            state={state}
            setState={setState}
            onIntent={onIntent}
            path={`${path}.contents.${idx}`}
            isThinking={isThinking}
            disabledButtons={disabledButtons}
          />
        ))}
      </div>
    );
  }

  if (node.type === "chakra" || node.type === "component") {
    const Component = TailwindComponents[node.componentName] || TailwindComponents.Box;
    const { children, ...restProps } = node.props || {};

    // Handle Interactions
    const interactionProps: any = {};

    // 1. Input/Select Binding
    if (node.componentName === "Input" || node.componentName === "Select") {
      const stateKey = restProps.name || `field_${node.componentName}_${Math.random().toString(36).substr(2, 9)}`;
      if (!restProps.name) console.warn(`SDUI Warning: Component ${node.componentName} is missing a 'name' prop. Using fallback: ${stateKey}`);

      interactionProps.value = state[stateKey] || "";
      interactionProps.onChange = (e: any) => {
        const val = e.target.value;
        setState((prev: any) => ({ ...prev, [stateKey]: val }));
      };
    }

    // 2. Button Submission
    if (node.componentName === "Button" && node.onSubmit) {
      const isDisabled = isThinking || disabledButtons?.[path];
      interactionProps.disabled = isDisabled;
      interactionProps.onClick = () => {
        if (!isDisabled) {
          onIntent(node.onSubmit, state, node.sduiAction, path, node.sduiData);
        }
      };
      interactionProps.className = `${restProps.className || ""} ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`;
    }

    // 3. Mermaid fix action
    if (node.componentName === "MermaidBlock" && restProps?.code) {
      interactionProps.onFix = () =>
        onIntent(
          "Fix the Mermaid diagram syntax and re-render.",
          state,
          "fix-mermaid",
          undefined,
          {
            unitId: restProps.unitId,
            mediaIndex: restProps.mediaIndex,
            code: restProps.code
          }
        );
    }

    if (node.componentName === "QuizBlock") {
      const feedback = state?.quizResults?.[`${restProps.unitId}:${restProps.mediaIndex}`] || null;
      interactionProps.feedback = feedback;
    }

    // Void elements or components that handle their own children specifically
    const handsOffChildren = ["Input", "Select", "Divider", "img", "br", "hr"].includes(node.componentName);

    if (handsOffChildren) {
      return <Component {...restProps} {...interactionProps} />;
    }

    if (node.componentName === "Text" && typeof children === "string") {
      return (
        <div className={restProps.className || ""}>
          <MarkdownBlock content={children} />
          {node.contents?.map((child: any, idx: number) => (
            <JSONRenderer
              key={idx}
              node={child}
              state={state}
              setState={setState}
              onIntent={onIntent}
              path={`${path}.contents.${idx}`}
              isThinking={isThinking}
              disabledButtons={disabledButtons}
            />
          ))}
        </div>
      );
    }

    return (
      <Component {...restProps} {...interactionProps}>
        {typeof children === "string" ? <MarkdownBlock content={children} /> : children}
        {node.contents?.map((child: any, idx: number) => (
          <JSONRenderer
            key={idx}
            node={child}
            state={state}
            setState={setState}
            onIntent={onIntent}
            path={`${path}.contents.${idx}`}
            isThinking={isThinking}
            disabledButtons={disabledButtons}
          />
        ))}
      </Component>
    );
  }

  return null;
}

// --- Intelligence Panel ---

function IntelligencePanel({
  state,
  isThinking,
  notes,
  intents,
  readAloudText,
  topic,
}: {
  state: any;
  isThinking: boolean;
  notes: string[];
  intents: any[];
  readAloudText?: string;
  topic?: string;
}) {
  const [isReading, setIsReading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [musicLabel, setMusicLabel] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopReading = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const startReading = () => {
    if (!readAloudText || !("speechSynthesis" in window)) return;
    stopReading();
    const utterance = new SpeechSynthesisUtterance(readAloudText);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const pickMusic = async () => {
    const query = encodeURIComponent(`${topic || state?.goal?.title || "focus"} focus music`);
    const url = `https://itunes.apple.com/search?term=${query}&media=music&entity=song&limit=1`;
    const res = await fetch(url);
    const json = await res.json();
    const track = json?.results?.[0];
    if (!track?.previewUrl) return null;
    return {
      url: track.previewUrl as string,
      label: `${track.trackName} — ${track.artistName}`,
    };
  };



  // Calculate progress stars (0-5 based on knowledge level)
  const knowledgeLevel = state?.knowledgeLevel ?? 0;
  const progressStars = Math.min(5, Math.max(0, knowledgeLevel));

  // Get current agent activity
  const getAgentActivity = () => {
    if (!isThinking) return { text: "Ready", icon: Sparkles, color: "green-500" };

    const activeAgent = state?.activeAgent;
    if (activeAgent) {
      if (activeAgent === "understanding-agent") return { text: "Interpreting Signal", icon: Brain, color: "blue-400" };
      if (activeAgent === "planner-agent") return { text: "Strategic Planning", icon: LayoutDashboard, color: "purple-400" };
      if (activeAgent === "question-agent") return { text: "Designing Assessment", icon: Sparkles, color: "yellow-400" };
      if (activeAgent === "curriculum-agent") return { text: "Mapping Knowledge", icon: LayoutDashboard, color: "orange-400" };
      if (activeAgent === "teaching-agent") return { text: "Synthesizing Lesson", icon: Award, color: "accent" };
      if (activeAgent === "ui-builder-agent") return { text: "Composing Surface", icon: LayoutDashboard, color: "pink-400" };
      if (activeAgent === "sense-orchestrator-agent") return { text: "Orchestrating Senses", icon: Volume2, color: "cyan-400" };
    }

    if (state?.phase === "intake") return { text: "Gathering Context", icon: Sparkles, color: "blue-500" };
    if (state?.phase === "curriculum") return { text: "Building Curriculum", icon: LayoutDashboard, color: "purple-500" };

    return { text: "Thinking & Refining", icon: Brain, color: "accent" };
  };

  const activity = getAgentActivity();
  const ActivityIcon = activity.icon;

  return (
    <div className="flex flex-col gap-6 h-full p-6">
      {/* Agent State Card */}
      <div className={`card ${isThinking ? "thinking-card" : ""}`}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-row justify-between items-center">
            <span className="text-xs font-bold uppercase text-fgSubtle">
              Agent Status
            </span>
            <motion.div
              animate={isThinking ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ActivityIcon size={16} className={`text-${activity.color.replace('.', '-')}`} />
            </motion.div>
          </div>
          <p className="text-sm font-semibold text-fg">
            {activity.text}
          </p>
          {state?.phase && (
            <p className="text-xs text-fgMuted">
              Phase: {state.phase}
            </p>
          )}
        </div>
      </div>

      {/* Live Process Card */}
      <div className="card">
        <div className="flex flex-col gap-3">
          <div className="flex flex-row justify-between items-center">
            <span className="text-xs font-bold uppercase text-fgSubtle">
              Live Process
            </span>
            <motion.div
              animate={isThinking ? { opacity: [0.4, 1, 0.4] } : {}}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <Sparkles size={14} className="text-accent" />
            </motion.div>
          </div>
          <div className="flex flex-col gap-2">
            {isThinking && state?.activeAgent && (
              <div className="p-2 bg-accent/10 rounded border border-accent/20 flex flex-row items-center gap-2">
                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <div className="w-2 h-2 rounded-full bg-accent" />
                </motion.div>
                <p className="text-xs font-bold text-accent">Active: {state.activeAgent.replace("-agent", "").toUpperCase()}</p>
              </div>
            )}
            {(notes ?? []).slice(-4).map((note, idx) => (
              <div key={`note-${idx}`} className="p-2 bg-surface rounded border border-border">
                <p className="text-xs text-fgMuted">{note}</p>
              </div>
            ))}
            {(!notes || notes.length === 0) && !state?.activeAgent && (
              <p className="text-xs text-fgSubtle">Waiting for updates...</p>
            )}
          </div>
        </div>
      </div>

      {/* Intent Trace */}
      <div className="card">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-bold uppercase text-fgSubtle">
            Recent Intents
          </span>
          <div className="flex flex-col gap-2">
            {(intents ?? []).slice(-4).map((intent: any, idx: number) => (
              <div key={`intent-${idx}`} className="p-2 bg-surface rounded border border-border">
                <p className="text-xs text-fgMuted">{intent.type}</p>
              </div>
            ))}
            {(!intents || intents.length === 0) && (
              <p className="text-xs text-fgSubtle">No intents yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Progress Card */}
      <div className="card">
        <div className="flex flex-col gap-4">
          <div className="flex flex-row justify-between items-center">
            <span className="text-xs font-bold uppercase text-fgSubtle">
              Knowledge Progress
            </span>
            <Award size={16} className="text-accent" />
          </div>

          {/* Star Progress Indicator */}
          <div className="flex flex-row gap-2 justify-center py-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <motion.div
                key={star}
                initial={{ scale: 0 }}
                animate={{ scale: star <= progressStars ? 1 : 0.5 }}
                transition={{ duration: 0.3, delay: star * 0.1 }}
              >
                <Star
                  size={20}
                  fill={star <= progressStars ? "currentColor" : "transparent"}
                  className={star <= progressStars ? "text-accent" : "text-border"}
                />
              </motion.div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-row justify-between text-xs">
              <span className="text-fgMuted">Level {knowledgeLevel}</span>
              <span className="text-accent font-semibold">{Math.round((knowledgeLevel / 5) * 100)}%</span>
            </div>
            <div className="h-2 bg-surfaceRounded overflow-hidden rounded-full">
              <motion.div
                className="h-full bg-accent rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(knowledgeLevel / 5) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>

          {state?.curriculum?.modules && (
            <p className="text-xs text-fgMuted text-center">
              {state.curriculum.modules.filter((m: any) => m.completed).length} / {state.curriculum.modules.length} modules completed
            </p>
          )}
        </div>
      </div>

      {/* Sense Controls Card */}
      <div className="card flex-grow">
        <div className="flex flex-col gap-4">
          <span className="text-xs font-bold uppercase text-fgSubtle">
            Sense Controls
          </span>

          {/* Read Aloud */}
          <div
            className={`p-3 rounded-lg cursor-pointer transition-all duration-200 flex flex-row items-center gap-3 hover:translate-x-0.5 ${isReading ? "bg-accentSoft hover:bg-accentSoft" : "bg-bgSurface hover:bg-surfaceElevated"}`}
            onClick={() => {
              const next = !isReading;
              setIsReading(next);
              if (next) startReading();
              else stopReading();
            }}
          >
            <Volume2 size={18} className={isReading ? "text-accent" : "text-fgMuted"} />
            <div className="flex flex-col flex-1">
              <p className="text-sm font-medium text-fg">Read Aloud</p>
              <p className="text-xs text-fgMuted">{isReading ? "Playing..." : "Click to read content"}</p>
            </div>
          </div>

          {/* Voice Input */}
          <div
            className={`p-3 rounded-lg cursor-pointer transition-all duration-200 flex flex-row items-center gap-3 hover:translate-x-0.5 ${isListening ? "bg-accentSoft hover:bg-accentSoft" : "bg-bgSurface hover:bg-surfaceElevated"}`}
            onClick={() => setIsListening(!isListening)}
          >
            <Mic size={18} className={isListening ? "text-accent" : "text-fgMuted"} />
            <div className="flex flex-col flex-1">
              <p className="text-sm font-medium text-fg">Voice Question</p>
              <p className="text-xs text-fgMuted">{isListening ? "Listening..." : "Hold to ask"}</p>
            </div>
          </div>

          {/* Background Music */}
          <div
            className={`p-3 rounded-lg cursor-pointer transition-all duration-200 flex flex-row items-center gap-3 hover:translate-x-0.5 ${isMusicPlaying ? "bg-accentSoft hover:bg-accentSoft" : "bg-bgSurface hover:bg-surfaceElevated"}`}
            onClick={async () => {
              const next = !isMusicPlaying;
              setIsMusicPlaying(next);
              if (!next) {
                audioRef.current?.pause();
                return;
              }
              const picked = await pickMusic();
              if (!picked) return;
              setMusicLabel(picked.label);
              if (!audioRef.current) {
                audioRef.current = new Audio(picked.url);
              } else {
                audioRef.current.src = picked.url;
              }
              audioRef.current.loop = true;
              await audioRef.current.play();
            }}
          >
            <Music size={18} className={isMusicPlaying ? "text-accent" : "text-fgMuted"} />
            <div className="flex flex-col flex-1">
              <p className="text-sm font-medium text-fg">Focus Music</p>
              <p className="text-xs text-fgMuted">{isMusicPlaying ? (musicLabel ? `Playing: ${musicLabel}` : "Playing") : "Start ambient sound"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Workspace({ state, bridge, setAnswers, answers, senseArtifacts, isThinking, notes }: any) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [disabledButtons, setDisabledButtons] = useState<Record<string, boolean>>({});
  const [selectionMenu, setSelectionMenu] = useState<{ text: string; x: number; y: number } | null>(null);

  // SDUI State
  const surface = state?.shared?.learningSurface;
  const components = surface?.components;
  const [localState, setLocalState] = useState<Record<string, any>>({});
  const lastUnitId = useRef<string | null>(null);

  // Initialize local state when surface changes
  React.useEffect(() => {
    const currentUnitId = state?.shared?.activeStep?.unitId;

    if (currentUnitId !== lastUnitId.current) {
      // Unit changed: Reset local state or load from repository if available
      // Note: We might want to persist the old state here, but handleIntent already sends it
      const savedState = state?.shared?.unitStates?.[currentUnitId || ""] ?? surface?.state ?? {};
      setLocalState(savedState);
      lastUnitId.current = currentUnitId;
    } else if (surface?.state) {
      // Same unit, partial update: preserve user edits if they exist
      setLocalState(prev => ({ ...surface.state, ...prev }));
    }
  }, [surface, state?.shared?.activeStep?.unitId]);

  const curriculum = state?.shared?.curriculum;
  const progress = state?.shared?.curriculumProgress ?? {};
  const activeUnitId = state?.shared?.activeStep?.unitId;
  const activeUnitTitle = state?.shared?.activeStep?.title;

  const handleIntent = async (reasoning: string, currentState: any, action: string = "sdui-interaction", buttonKey?: string, extraData: any = {}) => {
    if (!bridge) return;
    if (buttonKey) {
      setDisabledButtons((prev) => ({ ...prev, [buttonKey]: true }));
    }

    // Sync state back to brain for preservation
    const currentUnitId = state?.shared?.activeStep?.unitId;
    const updatedExtraData = { ...extraData };
    if (currentUnitId) {
      updatedExtraData.unitState = currentState;
    }

    await bridge.signal({
      id: `intent-${Date.now()}`,
      userId: state.shared.userId,
      goalId: state.shared.goal.id,
      type: "direct text",
      observedAt: Date.now(),
      payload: {
        kind: "ui-intent",
        action,
        data: {
          meaning: reasoning,
          formState: currentState,
          surface: surface, // Pass the full surface context (questions, metadata)
          ...updatedExtraData
        }
      },
    });
  };

  useEffect(() => {
    if (!isThinking) {
      setDisabledButtons({});
    }
  }, [isThinking, state]); // Add state to trigger if update arrives after thinking

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection?.toString()?.trim() || "";
      if (!text || text.length < 8) {
        setSelectionMenu(null);
        return;
      }
      const range = selection?.getRangeAt(0);
      if (!range) return;
      const rect = range.getBoundingClientRect();
      setSelectionMenu({
        text,
        x: rect.left + rect.width / 2,
        y: rect.top - 8
      });
    };

    const handleScroll = () => setSelectionMenu(null);
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".selection-popover")) return;
      setSelectionMenu(null);
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("scroll", handleScroll, true);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("mousedown", handleClick);
    };
  }, []);

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderTree = (node: any, depth = 0) => {
    if (!node) return null;
    const isExpanded = expandedNodes[node.id] ?? depth < 1;
    const hasChildren = (node.children ?? []).length > 0;
    const status = progress[node.id];
    const isActive = (activeUnitId && node.id === activeUnitId) ||
      (activeUnitTitle && (node.title || "").toLowerCase() === activeUnitTitle.toLowerCase());
    return (
      <div key={node.id} style={{ marginLeft: depth * 12 }}>
        <div
          className={`flex flex-row gap-2 items-center p-2 rounded-md ${isActive ? "bg-accent/10 text-accent" : ""} ${hasChildren ? "hover:bg-surfaceElevated" : "cursor-pointer hover:bg-accent/5"}`}
        >
          {hasChildren ? (
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => toggleNode(node.id)}
            >
              <ChevronRight size={14} className="text-fgSubtle" />
            </motion.div>
          ) : (
            <div className="w-3" />
          )}
          <p
            className={`text-sm font-semibold ${isActive ? "text-accent" : "text-fg"}`}
            onClick={() => {
              if (!hasChildren) {
                handleIntent(`Open unit: ${node.title}`, state?.shared, "open-unit", undefined, { unitId: node.id, unitTitle: node.title });
              } else {
                toggleNode(node.id);
              }
            }}
          >
            {node.title}
          </p>
          {status && (
            <span className="text-xs text-fgMuted">
              {status === "done" ? "✓" : status === "in_progress" ? "•" : ""}
            </span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="flex flex-col gap-1">
            {node.children.map((child: any) => renderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const hasComponents = (components ?? []).length > 0;

  return (
    <div className={`grid h-screen bg-bg gap-0 relative transition-all duration-300 ${isSidebarCollapsed ? "lg:grid-cols-[0px_1fr_340px]" : "lg:grid-cols-[280px_1fr_340px]"}`}>
      {/* Collapsible Curriculum Sidebar */}
      <motion.div
        className="border-r border-border bg-bgSurface overflow-auto relative hidden lg:block"
        initial={false}
        animate={{ width: isSidebarCollapsed ? 0 : "280px" }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col p-6 gap-6">
          <div className="flex flex-row justify-between items-center">
            <h2 className="text-sm font-bold text-fg">Learning Path</h2>
            <div
              className="cursor-pointer p-1 rounded-md hover:bg-surfaceElevated"
              onClick={() => setIsSidebarCollapsed(true)}
            >
              <ChevronLeft size={18} className="text-fgSubtle" />
            </div>
          </div>

          {curriculum?.tree ? (
            <div className="flex flex-col gap-2">
              {renderTree(curriculum.tree)}
            </div>
          ) : curriculum?.modules && curriculum.modules.length > 0 ? (
            <div className="flex flex-col gap-3">
              {curriculum.modules.map((module: any, mIdx: number) => (
                <div key={module.id || mIdx} className="flex flex-col gap-1">
                  <div
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border hover:border-accent/40 ${module.active ? "bg-accentSoft border-accent/20" : "bg-transparent border-transparent"}`}
                  >
                    <div className="flex flex-row gap-3 items-center">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border ${module.completed ? "bg-accent border-accent text-white" : "bg-surface border-border"}`}>
                        {module.completed && <span className="text-[10px] font-bold">✓</span>}
                      </div>
                      <p className="text-sm font-semibold text-fg truncate">{module.title}</p>
                    </div>
                  </div>

                  {/* Units */}
                  <div className="flex flex-col gap-1 ml-6 border-l border-border/50 pl-3">
                    {module.units?.map((unit: any, uIdx: number) => {
                      const isActive = state?.shared?.activeStep?.unitId === unit.id;
                      const isCompleted = state?.shared?.curriculumProgress?.[unit.id] === "done";
                      return (
                        <div
                          key={unit.id || uIdx}
                          onClick={() => handleIntent(`Open unit: ${unit.title}`, state?.shared, "open-unit", undefined, { unitId: unit.id })}
                          className={`p-2 rounded-md cursor-pointer text-xs transition-all hover:bg-accent/5 ${isActive ? "text-accent font-bold bg-accent/10" : "text-fgMuted font-medium"}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-accent" : isCompleted ? "bg-green-500" : "bg-border"}`} />
                            {unit.title}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="h-10 bg-surfaceElevated animate-pulse rounded-lg" />
              <div className="h-10 bg-surfaceElevated animate-pulse rounded-lg" />
              <div className="h-10 bg-surfaceElevated animate-pulse rounded-lg" />
              <p className="text-[10px] text-center text-fgSubtle uppercase tracking-widest mt-2">{isThinking ? "Constructing Path..." : "Curriculum Pending"}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Toggle Button (when collapsed) */}
      {isSidebarCollapsed && (
        <motion.div
          className="absolute left-4 top-4 z-10 p-2 bg-bgSurface border border-border rounded-lg cursor-pointer shadow-md hover:bg-surfaceElevated hover:shadow-lg"
          onClick={() => setIsSidebarCollapsed(false)}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronRight size={20} className="text-accent" />
        </motion.div>
      )}

      {/* Dynamic Content Window */}
      <div className="flex flex-col p-6 md:p-12 overflow-auto relative">
        <div className="max-w-7xl mx-auto">
          {hasComponents ? components.map((node: any, idx: number) => (
            <JSONRenderer
              key={idx}
              node={node}
              state={localState}
              setState={setLocalState}
              onIntent={handleIntent}
              path={`root.${idx}`}
              isThinking={isThinking}
              disabledButtons={disabledButtons}
            />
          )) : (
            <div className="flex flex-col gap-10 min-w-[600px]">
              <div className="h-12 w-3/5 bg-surfaceElevated animate-pulse rounded-lg" />
              <div className="h-40 bg-surfaceElevated animate-pulse rounded-2xl" />
              <div className="flex flex-col gap-4">
                <div className="h-4 bg-surfaceElevated animate-pulse rounded w-full" />
                <div className="h-4 bg-surfaceElevated animate-pulse rounded w-full" />
                <div className="h-4 bg-surfaceElevated animate-pulse rounded w-3/4" />
                <div className="h-4 bg-surfaceElevated animate-pulse rounded w-full" />
              </div>
              <p className="text-xs text-center text-fgSubtle italic">{isThinking ? "Principal Agent is synthesizing your lesson..." : "Waiting for next step"}</p>
            </div>
          )}
        </div>

        {selectionMenu && (
          <div
            className="selection-popover fixed z-50 px-3 py-2 rounded-lg bg-surface border border-border shadow-lg text-xs flex flex-row gap-2 items-center"
            style={{ left: selectionMenu.x, top: selectionMenu.y }}
          >
            <span className="text-fgMuted">Selected:</span>
            <span className="text-fg font-semibold max-w-[220px] truncate">{selectionMenu.text}</span>
            <button
              className="btn btn-solid px-3 py-1 text-xs"
              onClick={() => {
                handleIntent(
                  `User wants to go deeper into: ${selectionMenu.text}`,
                  state?.shared,
                  "deepen-topic",
                  undefined,
                  { topic: selectionMenu.text, unitId: state?.shared?.activeStep?.unitId }
                );
                setSelectionMenu(null);
              }}
            >
              Go Deeper
            </button>
          </div>
        )}
      </div>

      {/* Intelligence Panel */}
      <div className="border-l border-border bg-bgSurface overflow-auto hidden lg:block">
        <IntelligencePanel
          state={state?.shared}
          isThinking={isThinking}
          notes={notes ?? []}
          intents={state?.intents ?? []}
        />
      </div>
    </div>
  );
}

function App() {
  const [topic, setTopic] = useState("");
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [view, setView] = useState<"landing" | "workspace">("landing");
  const [isThinking, setIsThinking] = useState(false);
  const [senseArtifacts, setSenseArtifacts] = useState<any[]>([]);

  const bridge = (window as any).polymath?.brain;


  // ... (renderSenses and startLearning omitted as they are unchanged)

  const renderSenses = async (result: any) => {
    const senseIntents = (result.intents ?? []).filter(
      (intent: any) => intent.type === "present-sense"
    );
    // ... logic unchanged
    const outputs: SenseOutput[] = [];
    for (const intent of senseIntents) {
      // ...
      const plugin = registry.list().find((entry) => entry.type === intent.sense);
      if (!plugin) continue;
      const controller = plugin.create();
      const output = await controller.present({
        context: { goal: result.shared.goal, userId: result.shared.userId },
        prompt: intent.prompt,
        params: intent.params,
      });
      outputs.push(output);
      await controller.dispose();
    }
    setSenseArtifacts(outputs.flatMap((output) => output.artifacts ?? []));
  };

  const startLearning = async () => {
    // ... same logic
    setError(null);
    const currentBridge = (window as any).polymath?.brain;
    if (!currentBridge) {
      setError("Polymath Bridge not detected. Please ensure you are running inside the Electron app.");
      console.error("Polymath bridge missing. window.polymath:", (window as any).polymath);
      return;
    }
    setIsThinking(true);
    setView("workspace");
    setState({
      shared: {
        goal: { title: topic || "Systems Thinking" },
        learningSurface: null
      }
    });
    try {
      const response = await bridge.start(topic || "Systems Thinking");
      if (response.ok) {
        setState(response.data);
        await renderSenses(response.data);
      } else {
        setError(response.error);
        setView("landing");
      }
    } catch (err) {
      setError((err as Error).message);
      setView("landing");
    }
  };

  useEffect(() => {
    if (!bridge?.onUpdate) return;
    bridge.onUpdate((payload: any) => {
      const data = payload?.data ?? payload;
      setState(data);
      const shared = data?.shared;
      if (shared?.learningSurface || shared?.curriculum || shared?.questions) {
        setView("workspace");
      }
    });

    if (bridge?.onStatusUpdate) {
      bridge.onStatusUpdate(({ status }: { status: "thinking" | "idle" }) => {
        setIsThinking(status === "thinking");
      });
    }
  }, [bridge]);

  if (view === "workspace") {
    return (
      <div className="relative h-screen">
        <Workspace
          state={state}
          bridge={bridge}
          setAnswers={setAnswers}
          answers={answers}
          senseArtifacts={senseArtifacts}
          isThinking={isThinking}
          notes={state?.notes ?? []}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center p-12 bg-bg">
      <motion.div
        className="card max-w-[640px] w-full text-center flex flex-col gap-8 p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col gap-8">
          <div className="flex flex-row gap-3 text-accent font-bold justify-center items-center">
            <Sparkles size={18} />
            <span className="text-xs uppercase tracking-widest">Polymath OS / v0.1</span>
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold text-fg">
              Architect your own intelligence.
            </h1>

            <p className="text-lg text-fgMuted">
              An adaptive learning environment that builds itself around your goals.
            </p>
          </div>

          <div className="flex flex-col w-full gap-4">
            <input
              className="input text-lg h-14 px-6"
              placeholder="What do you want to master?"
              value={topic}
              onChange={(e: any) => setTopic(e.target.value)}
              onKeyDown={(e: any) => e.key === "Enter" && startLearning()}
            />
            <button
              className="btn btn-solid h-14 w-full text-lg font-medium"
              onClick={startLearning}
            >
              Begin Learning Loop
            </button>
          </div>

          {error && <p className="text-red-500 font-medium">{error}</p>}
        </div>
      </motion.div>
    </div>
  );
}

const container = document.getElementById("app");
if (container) {
  createRoot(container).render(<App />);
}
