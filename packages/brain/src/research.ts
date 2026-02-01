import type { ResearchResult, ResearchSource } from "@polymath/agents";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "PolymathResearch/0.1",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Research fetch failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function wikipediaSummary(topic: string): Promise<ResearchSource | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`;
  try {
    const data = await fetchJson<{
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    }>(url);
    if (!data?.extract) return null;
    return {
      title: data.title ?? topic,
      url: data.content_urls?.desktop?.page ?? url,
      summary: data.extract,
    };
  } catch {
    return null;
  }
}

async function openAlexWorks(topic: string): Promise<ResearchSource[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(topic)}&per-page=3`;
  try {
    const data = await fetchJson<{
      results?: Array<{
        display_name?: string;
        publication_year?: number;
        primary_location?: { landing_page_url?: string };
        authorships?: Array<{ author?: { display_name?: string } }>;
      }>;
    }>(url);
    return (
      data.results?.map((item) => ({
        title: item.display_name ?? topic,
        url: item.primary_location?.landing_page_url ?? "https://openalex.org",
        year: item.publication_year,
        authors: item.authorships
          ?.map((author) => author.author?.display_name)
          .filter(Boolean) as string[] | undefined,
      })) ?? []
    );
  } catch {
    return [];
  }
}

export async function runResearch(topic: string): Promise<ResearchResult> {
  const sources: ResearchSource[] = [];
  const [wiki, works] = await Promise.all([
    wikipediaSummary(topic),
    openAlexWorks(topic),
  ]);
  if (wiki) sources.push(wiki);
  sources.push(...works);
  return {
    topic,
    sources,
    notes:
      sources.length === 0
        ? "No sources found. Consider a broader query."
        : "Sources retrieved from Wikipedia and OpenAlex.",
  };
}
