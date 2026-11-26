// The stand-alone Worker: reads ProbeOptions from the deployment's variables
// and serves every request with one probe. A misconfigured deployment answers
// 500 with the list of problems, so the fix is visible on the first request.

import { errorFormat } from './core/format.ts';
import { errorResponse } from './core/respond.ts';
import { optionsFromEnv } from './options.ts';
import { createProbe, type Probe } from './probe.ts';

type Env = Readonly<Record<string, unknown>>;

// One probe per environment object; the runtime reuses it across requests.
const probes = new WeakMap<Env, Probe | string[]>();

const probeFor = (env: Env): Probe | string[] => {
    const cached = probes.get(env);
    if (cached) return cached;
    const result = optionsFromEnv(env);
    const built = result.ok ? createProbe(result.options) : result.problems;
    if (!result.ok) console.error(`MyIP-Probe configuration problems: ${result.problems.join('; ')}`);
    probes.set(env, built);
    return built;
};

export default {
    fetch: (request, env) => {
        const probe = probeFor(env);
        if (Array.isArray(probe)) {
            return errorResponse(500, 'bad_config', `Configuration problems: ${probe.join('; ')}`, errorFormat(request.headers));
        }
        return probe.fetch(request);
    },
} satisfies ExportedHandler<Env>;
