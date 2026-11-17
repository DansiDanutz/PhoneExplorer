import type { LayaCandidate, LayaChoice } from '../../shared/types';

interface LayaAnswer {
  choice?: unknown;
  confidence?: unknown;
  answer_confidence?: unknown;
}

interface LayaResponse {
  answers?: { next?: LayaAnswer };
  routing?: { model?: unknown };
}

/**
 * Thin client for the local Laya typed-decision service.
 *
 * Laya is deliberately not asked open-ended questions: the explorer supplies a
 * finite set of safe, observed candidates and Laya picks one. The host keeps
 * the graph, the safety filter and the start/stop control.
 */
export class LayaClient {
  private readonly endpoint =
    process.env.PHONEEXPLORER_LAYA_URL?.replace(/\/$/, '') || 'http://127.0.0.1:31419';

  async choose(
    state: Record<string, unknown>,
    candidates: LayaCandidate[],
  ): Promise<LayaChoice> {
    if (candidates.length === 0) throw new Error('There is nothing left to observe.');
    if (candidates.length === 1) {
      return { id: candidates[0].id, confidence: 1, model: 'single-candidate' };
    }
    const criteria = Object.fromEntries(
      candidates.map((candidate) => [
        candidate.id,
        `${candidate.label}: ${candidate.description}`,
      ]),
    );
    const response = await fetch(`${this.endpoint}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'typed-decisions',
        state: {
          app: 'PhoneExplorer',
          task: 'Choose the next safe navigation surface to inspect.',
          ...state,
          candidates: candidates.map(({ id, label, description }) => ({
            id,
            label,
            description,
          })),
        },
        questions: {
          next: {
            type: 'choice',
            instructions:
              'Choose one unvisited navigation surface. Prefer a tab or an overlay that reveals a distinct part of the app. Never choose a destructive action.',
            criteria,
          },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    }).catch((error: unknown) => {
      throw new Error(
        `Laya is unavailable at ${this.endpoint}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Laya returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ''}`);
    }
    const payload = (await response.json()) as LayaResponse;
    const answer = payload.answers?.next;
    const id = typeof answer?.choice === 'string' ? answer.choice : null;
    if (!id || !candidates.some((candidate) => candidate.id === id)) {
      throw new Error('Laya returned a choice that is not one of the observed controls.');
    }
    const rawConfidence = answer?.answer_confidence ?? answer?.confidence;
    const confidence = typeof rawConfidence === 'number' ? rawConfidence : 0;
    return {
      id,
      confidence,
      model: typeof payload.routing?.model === 'string' ? payload.routing.model : undefined,
    };
  }
}
