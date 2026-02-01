export interface ResearchSource {
  title: string;
  url: string;
  summary?: string;
  authors?: string[];
  year?: number;
}

export interface ResearchResult {
  topic: string;
  sources: ResearchSource[];
  notes?: string;
}
