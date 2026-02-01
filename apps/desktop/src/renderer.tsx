import React, { useMemo, useState, useEffect } from "react";
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

type BrainResponse = {
  ok: boolean;
  data?: any;
  error?: string;
};

const registry = createDefaultSenseRegistry(defaultSensePlugins);

const MotionBox = motion.div;

const MarkdownBlock = ({ content }: { content: string }) => (
  <div className="prose prose-sm max-w-none text-fg">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
  </div>
);

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
// --- JSON-First Renderer (SDUI) ---

const TailwindComponents: Record<string, any> = {
  Box: (props: any) => <div {...props} />,
  Container: (props: any) => <div className="container mx-auto px-4" {...props} />,
  Heading: (props: any) => {
    const sizes: any = { xs: "text-sm font-bold uppercase", sm: "text-lg font-bold", md: "text-xl font-bold", lg: "text-2xl font-bold", xl: "text-3xl font-bold", "2xl": "text-4xl font-extrabold" };
    return <h2 className={`${sizes[props.size || "md"]} text-fg ${props.className || ""}`} {...props} />;
  },
  Text: (props: any) => {
    const sizes: any = { xs: "text-xs", sm: "text-sm", md: "text-base", lg: "text-lg", xl: "text-xl" };
    const styles: any = { sm: "text-sm font-medium" }; // Mapping textStyle="sm"

    // Convert Chakra color props to Tailwind classes if possible, or style
    let className = `${sizes[props.fontSize || "md"]} ${styles[props.textStyle] || ""} text-fg`;
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
  CodeBlock: (props: any) => <CodeBlock code={props.code} language={props.language} />
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
          onIntent(node.onSubmit, state, node.sduiAction, path);
        }
      };
      interactionProps.className = `${restProps.className || ""} ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`;
    }

    // Void elements or components that handle their own children specifically
    const handsOffChildren = ["Input", "Select", "Divider", "img", "br", "hr"].includes(node.componentName);

    if (handsOffChildren) {
      return <Component {...restProps} {...interactionProps} />;
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
}: {
  state: any;
  isThinking: boolean;
  notes: string[];
  intents: any[];
}) {
  const [isReading, setIsReading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);



  // Calculate progress stars (0-5 based on knowledge level)
  const knowledgeLevel = state?.knowledgeLevel ?? 0;
  const progressStars = Math.min(5, Math.max(0, knowledgeLevel));

  // Get current agent activity
  const getAgentActivity = () => {
    if (isThinking) return { text: "Thinking & Refining", icon: Brain, color: "accent" };
    if (state?.phase === "intake") return { text: "Gathering Context", icon: Sparkles, color: "blue.500" };
    if (state?.phase === "curriculum") return { text: "Building Curriculum", icon: LayoutDashboard, color: "purple.500" };
    return { text: "Ready", icon: Sparkles, color: "green.500" };
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
            {(notes ?? []).slice(-4).map((note, idx) => (
              <div key={`note-${idx}`} className="p-2 bg-surface rounded border border-border">
                <p className="text-xs text-fgMuted">{note}</p>
              </div>
            ))}
            {(!notes || notes.length === 0) && (
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
            onClick={() => setIsReading(!isReading)}
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
            onClick={() => setIsMusicPlaying(!isMusicPlaying)}
          >
            <Music size={18} className={isMusicPlaying ? "text-accent" : "text-fgMuted"} />
            <div className="flex flex-col flex-1">
              <p className="text-sm font-medium text-fg">Focus Music</p>
              <p className="text-xs text-fgMuted">{isMusicPlaying ? "Playing" : "Start ambient sound"}</p>
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

  // SDUI State
  const surface = state?.shared?.learningSurface;
  const components = surface?.components;
  const [localState, setLocalState] = useState<Record<string, any>>({});

  // Initialize local state when surface changes
  React.useEffect(() => {
    if (surface?.state) {
      setLocalState(surface.state);
    }
  }, [surface]);

  const curriculum = state?.shared?.curriculum;
  const progress = state?.shared?.curriculumProgress ?? {};
  const activeUnitId = state?.shared?.activeStep?.unitId;
  const activeUnitTitle = state?.shared?.activeStep?.title;

  const handleIntent = async (reasoning: string, currentState: any, action: string = "sdui-interaction", buttonKey?: string, extraData: any = {}) => {
    if (!bridge) return;
    if (buttonKey) {
      setDisabledButtons((prev) => ({ ...prev, [buttonKey]: true }));
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
          ...extraData
        }
      },
    });
  };

  useEffect(() => {
    if (!isThinking) {
      setDisabledButtons({});
    }
  }, [isThinking]);

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

  if (!components) {
    return (
      <div className={`grid h-screen bg-bg gap-0 ${isSidebarCollapsed ? "grid-cols-[0px_1fr_340px]" : "grid-cols-[280px_1fr_340px]"} lg:grid-cols-[280px_1fr_340px]`}>
        {/* Left sidebar skeleton */}
        <div className={`border-r border-border p-10 bg-bgSurface ${isSidebarCollapsed ? "hidden" : "block"}`}>
          <div className="flex flex-col gap-8 h-full">
            <div className="h-6 w-2/5 bg-surfaceElevated animate-pulse rounded-md" />
            <div className="flex flex-col gap-4">
              <div className="h-10 bg-surfaceElevated animate-pulse rounded-lg" />
              <div className="h-10 bg-surfaceElevated animate-pulse rounded-lg" />
              <div className="h-10 bg-surfaceElevated animate-pulse rounded-lg" />
            </div>
          </div>
        </div>

        {/* Main content skeleton */}
        <div className="p-12">
          <div className="flex flex-col gap-10">
            <div className="h-12 w-3/5 bg-surfaceElevated animate-pulse rounded-lg" />
            <div className="h-40 bg-surfaceElevated animate-pulse rounded-2xl" />
            <div className="flex flex-col gap-4">
              <div className="h-4 bg-surfaceElevated animate-pulse rounded w-full" />
              <div className="h-4 bg-surfaceElevated animate-pulse rounded w-full" />
              <div className="h-4 bg-surfaceElevated animate-pulse rounded w-3/4" />
              <div className="h-4 bg-surfaceElevated animate-pulse rounded w-full" />
            </div>
          </div>
        </div>

        {/* Right Intel Panel */}
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
                          onClick={() => handleIntent(`Open unit: ${unit.title}`, state?.shared, "open-unit", { unitId: unit.id })}
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
            <p className="text-sm text-fgMuted text-center py-8">
              Curriculum will appear here
            </p>
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
          {components.map((node: any, idx: number) => (
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
          ))}
        </div>
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
      if (data?.shared?.learningSurface) {
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
