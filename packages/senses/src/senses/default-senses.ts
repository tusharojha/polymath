import { createTemplateSense } from "./sense-factory";
import type { SensePlugin } from "../index";

export const defaultSensePlugins: SensePlugin[] = [
  createTemplateSense({
    id: "sense-sound",
    name: "Soundscape",
    type: "sound",
    description: "Audio cues and ambient sound to guide attention and memory.",
  }),
  createTemplateSense({
    id: "sense-infographic",
    name: "Infographic",
    type: "infographic",
    description: "Condensed visuals and diagrams for quick comprehension.",
  }),
  createTemplateSense({
    id: "sense-animation",
    name: "Animation",
    type: "animation",
    description: "Animated sequences to illustrate change over time.",
  }),
  createTemplateSense({
    id: "sense-slides",
    name: "Slides",
    type: "slides",
    description: "Structured slide deck for guided narrative learning.",
  }),
  createTemplateSense({
    id: "sense-visual",
    name: "Visual Canvas",
    type: "visual",
    description: "Open visual workspace for sketches, maps, and diagrams.",
  }),
  createTemplateSense({
    id: "sense-character",
    name: "Character",
    type: "character",
    description: "Narrated character or mentor guiding the session.",
  }),
  createTemplateSense({
    id: "sense-music",
    name: "Music",
    type: "music",
    description: "Mood-setting music to support focus and flow.",
  }),
  createTemplateSense({
    id: "sense-experiment",
    name: "Experiment Designer",
    type: "experiment",
    description: "Interactive experiment builder for hands-on learning.",
  }),
  createTemplateSense({
    id: "sense-paper",
    name: "Research Paper",
    type: "paper",
    description: "Curated papers and evidence for deeper grounding.",
  }),
  createTemplateSense({
    id: "sense-industry",
    name: "Industry Update",
    type: "industry-update",
    description: "Live signals from the field for relevance and context.",
  }),
];
