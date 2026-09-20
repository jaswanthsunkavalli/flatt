import { DFA, DfaGeneratorOptions, PatternCategory, PatternDefinition } from '../types';
import { minimizeDFA, findDeadStates, getReachableStates } from './dfaMinimizer';

/**
 * 12 Canonical Formal Language Patterns for Deterministic Finite Automata.
 * Every generator builds a mathematically complete, strictly deterministic DFA.
 */

/**
 * Optimizes the handling of sink / dead states by completely pruning them
 * from the DFA state set and transition matrix.
 *
 * A sink/dead state is an unescapable non-accepting state from which no accepting state
 * can ever be reached. Removing dead states and their incoming transitions produces
 * an optimized, cleaner graph representation while maintaining 100% mathematical and
 * logical DFA correctness:
 *  - Every string in L(M) terminates in the exact same accepting state.
 *  - Every string not in L(M) that previously entered a dead state now encounters
 *    a pruned transition, entering the implicit rejecting sink.
 */
export function pruneDeadStates(dfa: DFA): DFA {
  const deadStates = findDeadStates(dfa);
  if (deadStates.size === 0) {
    return dfa;
  }

  // Preserve the start state in the rare case where no accept state is reachable
  const statesToPrune = new Set<string>();
  for (const s of deadStates) {
    if (s !== dfa.startState) {
      statesToPrune.add(s);
    }
  }

  if (statesToPrune.size === 0) {
    return dfa;
  }

  const prunedStates = dfa.states.filter((s) => !statesToPrune.has(s));
  const prunedAcceptStates = dfa.acceptStates.filter((s) => !statesToPrune.has(s));

  const prunedTransitions: Record<string, Record<string, string>> = {};
  for (const s of prunedStates) {
    prunedTransitions[s] = {};
    const trans = dfa.transitions[s] || {};
    for (const sym of dfa.alphabet) {
      const dest = trans[sym];
      // Only retain transitions that lead to surviving (non-pruned) states
      if (dest && !statesToPrune.has(dest) && prunedStates.includes(dest)) {
        prunedTransitions[s][sym] = dest;
      }
      // Transitions into pruned sink states are omitted; partial DFA semantics
      // deterministically reject any string attempting these transitions.
    }
  }

  return {
    ...dfa,
    states: prunedStates,
    acceptStates: prunedAcceptStates,
    transitions: prunedTransitions,
  };
}

/**
 * Optimizes the DFA based on sink state handling options.
 * When options.pruneDeadStates is true, completely prunes all sink states.
 */
export function optimizeSinkStates(dfa: DFA, options?: DfaGeneratorOptions): DFA {
  if (options?.pruneDeadStates) {
    return pruneDeadStates(dfa);
  }
  return dfa;
}

// Normalizes state names so that startState is 'q0', active states are 'q1', 'q2'...,
// and dead/trap states (if any exist and are not pruned) are uniquely labeled 'q_dead'.
export function normalizeDfaStateNames(dfa: DFA, options?: DfaGeneratorOptions): DFA {
  const deadStates = findDeadStates(dfa);
  const reachable = getReachableStates(dfa);
  const activeStates = dfa.states.filter((s) => reachable.has(s) && !deadStates.has(s));

  // Determine an intuitive ordering starting from startState
  const orderedActive: string[] = [dfa.startState];
  const activeSet = new Set<string>(activeStates);
  activeSet.delete(dfa.startState);

  // Follow forward transitions for natural topological order
  const queue: string[] = [dfa.startState];
  const visited = new Set<string>([dfa.startState]);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const trans = dfa.transitions[curr] || {};
    for (const sym of dfa.alphabet) {
      const next = trans[sym];
      if (next && activeSet.has(next) && !visited.has(next)) {
        visited.add(next);
        orderedActive.push(next);
        queue.push(next);
      }
    }
  }

  // Append any remaining non-dead states
  dfa.states.forEach((s) => {
    if (activeSet.has(s) && !visited.has(s)) {
      orderedActive.push(s);
      visited.add(s);
    }
  });

  const shouldPrune = options?.pruneDeadStates ?? false;
  const hasDeadStates = !shouldPrune && dfa.states.some((s) => reachable.has(s) && deadStates.has(s));

  const stateNameMap: Record<string, string> = {};
  orderedActive.forEach((s, idx) => {
    stateNameMap[s] = `q${idx}`;
  });

  if (hasDeadStates) {
    dfa.states.forEach((s) => {
      if (reachable.has(s) && deadStates.has(s)) {
        stateNameMap[s] = 'q_dead';
      }
    });
  }

  const finalStates = [...orderedActive.map((s) => stateNameMap[s])];
  if (hasDeadStates && !finalStates.includes('q_dead')) {
    finalStates.push('q_dead');
  }

  const finalTransitions: Record<string, Record<string, string>> = {};
  finalStates.forEach((s) => {
    finalTransitions[s] = {};
  });

  orderedActive.forEach((s) => {
    const newFrom = stateNameMap[s];
    for (const sym of dfa.alphabet) {
      const destOld = dfa.transitions[s]?.[sym];
      if (destOld && stateNameMap[destOld]) {
        finalTransitions[newFrom][sym] = stateNameMap[destOld];
      } else if (hasDeadStates) {
        finalTransitions[newFrom][sym] = 'q_dead';
      }
      // If shouldPrune is true, transitions to dead states are completely pruned
    }
  });

  if (hasDeadStates) {
    for (const sym of dfa.alphabet) {
      finalTransitions['q_dead'][sym] = 'q_dead';
    }
  }

  const finalAcceptStates = Array.from(
    new Set(
      dfa.acceptStates
        .filter((s) => reachable.has(s) && !deadStates.has(s))
        .map((s) => stateNameMap[s])
        .filter(Boolean)
    )
  );

  return {
    ...dfa,
    states: finalStates,
    startState: stateNameMap[dfa.startState] || 'q0',
    acceptStates: finalAcceptStates,
    transitions: finalTransitions,
  };
}

// Helper to sanitize & parse the alphabet selection
export function parseAlphabet(raw?: string): string[] {
  if (raw === '0,1' || raw === '01') return ['0', '1'];
  return ['a', 'b'];
}

// Ensures any characters present in user-entered patterns are included in alphabet
export function ensureAlphabet(baseAlphabet: string[], ...patterns: string[]): string[] {
  const set = new Set(baseAlphabet);
  for (const p of patterns) {
    if (typeof p === 'string') {
      for (const char of p) {
        if (char.trim()) set.add(char);
      }
    }
  }
  return Array.from(set);
}

// Standard Product Automaton Constructor for Intersection and Union
export function productAutomaton(
  dfa1: DFA,
  dfa2: DFA,
  mode: 'intersection' | 'union',
  meta: { name: string; description: string; formula: string; category?: string },
  options?: DfaGeneratorOptions
): DFA {
  const alphabet = Array.from(new Set([...dfa1.alphabet, ...dfa2.alphabet]));
  const startPair = `${dfa1.startState}#${dfa2.startState}`;

  const visited = new Set<string>();
  const queue: string[] = [startPair];
  visited.add(startPair);

  const transitions: Record<string, Record<string, string>> = {};
  const acceptStatePairs: string[] = [];

  while (queue.length > 0) {
    const pair = queue.shift()!;
    const [s1, s2] = pair.split('#');

    const isAcc1 = dfa1.acceptStates.includes(s1);
    const isAcc2 = dfa2.acceptStates.includes(s2);
    const isAcc = mode === 'intersection' ? isAcc1 && isAcc2 : isAcc1 || isAcc2;
    if (isAcc) {
      acceptStatePairs.push(pair);
    }

    transitions[pair] = {};
    for (const c of alphabet) {
      const next1 = dfa1.transitions[s1]?.[c] ?? s1;
      const next2 = dfa2.transitions[s2]?.[c] ?? s2;
      const nextPair = `${next1}#${next2}`;
      transitions[pair][c] = nextPair;

      if (!visited.has(nextPair)) {
        visited.add(nextPair);
        queue.push(nextPair);
      }
    }
  }

  // Rename states to q0, q1, q2... preserving startState as q0
  const stateList = Array.from(visited);
  const sortedStates = [startPair, ...stateList.filter((s) => s !== startPair)];
  const stateNameMap: Record<string, string> = {};
  sortedStates.forEach((s, idx) => {
    stateNameMap[s] = `q${idx}`;
  });

  const finalStates = sortedStates.map((s) => stateNameMap[s]);
  const finalTransitions: Record<string, Record<string, string>> = {};

  sortedStates.forEach((s) => {
    const newName = stateNameMap[s];
    finalTransitions[newName] = {};
    for (const c of alphabet) {
      const destOld = transitions[s][c];
      finalTransitions[newName][c] = stateNameMap[destOld];
    }
  });

  const finalAcceptStates = acceptStatePairs.map((s) => stateNameMap[s]);

  const rawDfa: DFA = {
    name: meta.name,
    description: meta.description,
    alphabet,
    states: finalStates,
    startState: stateNameMap[startPair],
    acceptStates: finalAcceptStates,
    transitions: finalTransitions,
    category: meta.category || 'combination',
    formula: meta.formula,
  };

  return normalizeDfaStateNames(minimizeDFA(rawDfa), options);
}

// ----------------------------------------------------------------------
// 1. Contains Substring (Supports arbitrary substring or single symbol)
// ----------------------------------------------------------------------
export function buildContainsSubstring(
  pattern: string,
  alphabetInput?: string,
  options?: DfaGeneratorOptions
): DFA {
  const pat = pattern.trim() || 'ab';
  const alphabet = ensureAlphabet(parseAlphabet(alphabetInput), pat);
  const m = pat.length;

  const states: string[] = [];
  for (let i = 0; i <= m; i++) {
    states.push(`q${i}`);
  }

  const transitions: Record<string, Record<string, string>> = {};
  states.forEach((s) => {
    transitions[s] = {};
  });

  for (let i = 0; i < m; i++) {
    const currentPrefix = pat.slice(0, i);
    for (const c of alphabet) {
      const candidate = currentPrefix + c;
      let nextStateIndex = 0;
      for (let k = Math.min(m, candidate.length); k > 0; k--) {
        if (candidate.endsWith(pat.slice(0, k))) {
          nextStateIndex = k;
          break;
        }
      }
      transitions[`q${i}`][c] = `q${nextStateIndex}`;
    }
  }

  // Final match state q_m: loops on all symbols once substring is found
  for (const c of alphabet) {
    transitions[`q${m}`][c] = `q${m}`;
  }

  const dfa: DFA = {
    name: `Contains Substring '${pat}'`,
    description: `Language of all strings containing '${pat}' as a contiguous substring.`,
    alphabet,
    states,
    startState: 'q0',
    acceptStates: [`q${m}`],
    transitions,
    category: 'substring_affix',
    formula: `L = { w ∈ Σ* | '${pat}' ∈ Substrings(w) }`,
  };

  return optimizeSinkStates(dfa, options);
}

// ----------------------------------------------------------------------
// 2. Ends with Substring (Supports arbitrary substring or single symbol)
// ----------------------------------------------------------------------
export function buildEndsWithSubstring(
  pattern: string,
  alphabetInput?: string,
  options?: DfaGeneratorOptions
): DFA {
  const pat = pattern.trim() || 'ab';
  const alphabet = ensureAlphabet(parseAlphabet(alphabetInput), pat);
  const m = pat.length;

  const states: string[] = [];
  for (let i = 0; i <= m; i++) {
    states.push(`q${i}`);
  }

  const transitions: Record<string, Record<string, string>> = {};
  states.forEach((s) => {
    transitions[s] = {};
  });

  for (let i = 0; i <= m; i++) {
    const currentPrefix = pat.slice(0, i);
    for (const c of alphabet) {
      const candidate = currentPrefix + c;
      let nextStateIndex = 0;
      for (let k = Math.min(m, candidate.length); k > 0; k--) {
        if (candidate.endsWith(pat.slice(0, k))) {
          nextStateIndex = k;
          break;
        }
      }
      transitions[`q${i}`][c] = `q${nextStateIndex}`;
    }
  }

  const dfa: DFA = {
    name: `Ends with Substring '${pat}'`,
    description: `Language of all strings that end with the suffix '${pat}'.`,
    alphabet,
    states,
    startState: 'q0',
    acceptStates: [`q${m}`],
    transitions,
    category: 'substring_affix',
    formula: `L = { w ∈ Σ* | w ends with '${pat}' }`,
  };

  return optimizeSinkStates(dfa, options);
}

// ----------------------------------------------------------------------
// 3. Starts with Substring (Supports arbitrary substring or single symbol)
// ----------------------------------------------------------------------
export function buildStartsWithSubstring(
  pattern: string,
  alphabetInput?: string,
  options?: DfaGeneratorOptions
): DFA {
  const pat = pattern.trim() || 'ab';
  const alphabet = ensureAlphabet(parseAlphabet(alphabetInput), pat);
  const m = pat.length;

  const states: string[] = [];
  for (let i = 0; i <= m; i++) {
    states.push(`q${i}`);
  }
  states.push('q_dead');

  const transitions: Record<string, Record<string, string>> = {};
  states.forEach((s) => {
    transitions[s] = {};
  });

  for (let i = 0; i < m; i++) {
    const expected = pat[i];
    for (const c of alphabet) {
      if (c === expected) {
        transitions[`q${i}`][c] = `q${i + 1}`;
      } else {
        transitions[`q${i}`][c] = 'q_dead';
      }
    }
  }

  // Once prefix is matched at q_m, accept and loop on all symbols
  for (const c of alphabet) {
    transitions[`q${m}`][c] = `q${m}`;
    transitions['q_dead'][c] = 'q_dead';
  }

  const dfa: DFA = {
    name: `Starts with Substring '${pat}'`,
    description: `Language of all strings that start with the prefix '${pat}'.`,
    alphabet,
    states,
    startState: 'q0',
    acceptStates: [`q${m}`],
    transitions,
    category: 'substring_affix',
    formula: `L = { w ∈ Σ* | w starts with '${pat}' }`,
  };

  return optimizeSinkStates(dfa, options);
}

// ----------------------------------------------------------------------
// 4. Starts with Substring and Ends with Substring
// (Canonical minimal DFA: no redundant dead states)
// ----------------------------------------------------------------------
export function buildStartsAndEndsWith(
  startPattern: string,
  endPattern: string,
  alphabetInput?: string,
  options?: DfaGeneratorOptions
): DFA {
  const startPat = startPattern.trim() || 'a';
  const endPat = endPattern.trim() || 'b';
  const alphabet = ensureAlphabet(parseAlphabet(alphabetInput), startPat, endPat);

  // Canonical single-symbol case: exactly 3 functional states + 1 clean trap state
  if (startPat.length === 1 && endPat.length === 1) {
    if (startPat === endPat) {
      // Language: starts with 'a' and ends with 'a'
      const states = ['q0', 'q1', 'q2', 'q_dead'];
      const transitions: Record<string, Record<string, string>> = {
        q0: {},
        q1: {},
        q2: {},
        q_dead: {},
      };
      for (const c of alphabet) {
        transitions['q0'][c] = c === startPat ? 'q1' : 'q_dead';
        transitions['q1'][c] = c === startPat ? 'q1' : 'q2';
        transitions['q2'][c] = c === startPat ? 'q1' : 'q2';
        transitions['q_dead'][c] = 'q_dead';
      }
      return optimizeSinkStates({
        name: `Starts with '${startPat}' and Ends with '${endPat}'`,
        description: `Language of strings starting with '${startPat}' and ending with '${endPat}'.`,
        alphabet,
        states,
        startState: 'q0',
        acceptStates: ['q1'],
        transitions,
        category: 'substring_affix',
        formula: `L = { w ∈ Σ* | w starts with '${startPat}' ∧ w ends with '${endPat}' }`,
      }, options);
    } else {
      // Language: starts with 'a' and ends with 'b' (distinct characters)
      const states = ['q0', 'q1', 'q2', 'q_dead'];
      const transitions: Record<string, Record<string, string>> = {
        q0: {},
        q1: {},
        q2: {},
        q_dead: {},
      };
      for (const c of alphabet) {
        transitions['q0'][c] = c === startPat ? 'q1' : 'q_dead';
        transitions['q1'][c] = c === endPat ? 'q2' : 'q1';
        transitions['q2'][c] = c === endPat ? 'q2' : 'q1';
        transitions['q_dead'][c] = 'q_dead';
      }
      return optimizeSinkStates({
        name: `Starts with '${startPat}' and Ends with '${endPat}'`,
        description: `Language of strings starting with '${startPat}' and ending with '${endPat}'.`,
        alphabet,
        states,
        startState: 'q0',
        acceptStates: ['q2'],
        transitions,
        category: 'substring_affix',
        formula: `L = { w ∈ Σ* | w starts with '${startPat}' ∧ w ends with '${endPat}' }`,
      }, options);
    }
  }

  // Multi-symbol prefix and suffix:
  const startDfa = buildStartsWithSubstring(startPat, alphabetInput);
  const endDfa = buildEndsWithSubstring(endPat, alphabetInput);

  return productAutomaton(startDfa, endDfa, 'intersection', {
    name: `Starts with '${startPat}' and Ends with '${endPat}'`,
    description: `Language of strings starting with '${startPat}' and ending with '${endPat}'.`,
    formula: `L = { w ∈ Σ* | w starts with '${startPat}' ∧ w ends with '${endPat}' }`,
    category: 'substring_affix',
  }, options);
}

// ----------------------------------------------------------------------
// 5. Even Number of Occurrences
// ----------------------------------------------------------------------
export function buildEvenOccurrences(
  symbolInput: string,
  alphabetInput?: string,
  options?: DfaGeneratorOptions
): DFA {
  const symbol = symbolInput.trim() || 'a';
  const alphabet = ensureAlphabet(parseAlphabet(alphabetInput), symbol);

  const states = ['q0', 'q1'];
  const transitions: Record<string, Record<string, string>> = {
    q0: {},
    q1: {},
  };

  for (const c of alphabet) {
    if (c === symbol) {
      transitions['q0'][c] = 'q1';
      transitions['q1'][c] = 'q0';
    } else {
      transitions['q0'][c] = 'q0';
      transitions['q1'][c] = 'q1';
    }
  }

  const dfa: DFA = {
    name: `Even Number of '${symbol}'s`,
    description: `Language of all strings with an even count of the symbol '${symbol}' (including 0 occurrences).`,
    alphabet,
    states,
    startState: 'q0',
    acceptStates: ['q0'],
    transitions,
    category: 'counting_parity',
    formula: `L = { w ∈ Σ* | N_${symbol}(w) ≡ 0 (mod 2) }`,
  };

  return optimizeSinkStates(dfa, options);
}

// ----------------------------------------------------------------------
// 6. Odd Number of Occurrences
// ----------------------------------------------------------------------
export function buildOddOccurrences(
  symbolInput: string,
  alphabetInput?: string,
  options?: DfaGeneratorOptions
): DFA {
  const symbol = symbolInput.trim() || 'a';
  const alphabet = ensureAlphabet(parseAlphabet(alphabetInput), symbol);

  const states = ['q0', 'q1'];
  const transitions: Record<string, Record<string, string>> = {
    q0: {},
    q1: {},
  };

  for (const c of alphabet) {
    if (c === symbol) {
      transitions['q0'][c] = 'q1';
      transitions['q1'][c] = 'q0';
    } else {
      transitions['q0'][c] = 'q0';
      transitions['q1'][c] = 'q1';
    }
  }

  const dfa: DFA = {
    name: `Odd Number of '${symbol}'s`,
    description: `Language of all strings with an odd count of the symbol '${symbol}'.`,
    alphabet,
    states,
    startState: 'q0',
    acceptStates: ['q1'],
    transitions,
    category: 'counting_parity',
    formula: `L = { w ∈ Σ* | N_${symbol}(w) ≡ 1 (mod 2) }`,
  };

  return optimizeSinkStates(dfa, options);
}

// ----------------------------------------------------------------------
// 7. Both Even and Odd Number of Occurrences
// ----------------------------------------------------------------------
export function buildBothEvenAndOddOccurrences(
  evenSymbolInput: string,
  oddSymbolInput: string,
  alphabetInput?: string,
  options?: DfaGeneratorOptions
): DFA {
  const evenSym = evenSymbolInput.trim() || 'a';
  const oddSym = oddSymbolInput.trim() || 'b';
  const alphabet = ensureAlphabet(parseAlphabet(alphabetInput), evenSym, oddSym);

  const states = ['q0', 'q1', 'q2', 'q3'];
  const transitions: Record<string, Record<string, string>> = {
    q0: {},
    q1: {},
    q2: {},
    q3: {},
  };

  // State encoding:
  // q0 = (even, even) [Start]
  // q1 = (even, odd)  [Accepting]
  // q2 = (odd, even)
  // q3 = (odd, odd)
  const stateByParity: Record<string, string> = {
    '0,0': 'q0',
    '0,1': 'q1',
    '1,0': 'q2',
    '1,1': 'q3',
  };

  const parities: [number, number][] = [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ];

  parities.forEach(([e, o]) => {
    const curState = stateByParity[`${e},${o}`];
    for (const c of alphabet) {
      let nextE = e;
      let nextO = o;
      if (c === evenSym) nextE = (e + 1) % 2;
      if (c === oddSym) nextO = (o + 1) % 2;
      transitions[curState][c] = stateByParity[`${nextE},${nextO}`];
    }
  });

  const dfa: DFA = {
    name: `Even '${evenSym}'s and Odd '${oddSym}'s`,
    description: `Language of strings having an even number of '${evenSym}'s and an odd number of '${oddSym}'s.`,
    alphabet,
    states,
    startState: 'q0',
    acceptStates: ['q1'],
    transitions,
    category: 'counting_parity',
    formula: `L = { w ∈ Σ* | N_${evenSym}(w) ≡ 0 (mod 2) ∧ N_${oddSym}(w) ≡ 1 (mod 2) }`,
  };

  return optimizeSinkStates(dfa, options);
}

// ----------------------------------------------------------------------
// 8. Exactly n Occurrences
// ----------------------------------------------------------------------
export function buildExactlyNOccurrences(
  nVal: number,
  symbolInput: string,
  alphabetInput?: string,
  options?: DfaGeneratorOptions
): DFA {
  const n = Math.max(0, Math.min(6, Math.floor(nVal ?? 2)));
  const symbol = symbolInput.trim() || 'a';
  const alphabet = ensureAlphabet(parseAlphabet(alphabetInput), symbol);

  const states: string[] = [];
  for (let i = 0; i <= n; i++) {
    states.push(`q${i}`);
  }
  states.push('q_dead');

  const transitions: Record<string, Record<string, string>> = {};
  states.forEach((s) => {
    transitions[s] = {};
  });

  for (let i = 0; i < n; i++) {
    for (const c of alphabet) {
      if (c === symbol) {
        transitions[`q${i}`][c] = `q${i + 1}`;
      } else {
        transitions[`q${i}`][c] = `q${i}`;
      }
    }
  }

  // At state q_n (exactly n achieved):
  for (const c of alphabet) {
    if (c === symbol) {
      transitions[`q${n}`][c] = 'q_dead'; // exceeds n
    } else {
      transitions[`q${n}`][c] = `q${n}`;
    }
  }

  // At dead / trap state:
  for (const c of alphabet) {
    transitions['q_dead'][c] = 'q_dead';
  }

  const dfa: DFA = {
    name: `Exactly ${n} '${symbol}'s`,
    description: `Language of strings containing exactly ${n} occurrences of symbol '${symbol}'.`,
    alphabet,
    states,
    startState: 'q0',
    acceptStates: [`q${n}`],
    transitions,
    category: 'counting_parity',
    formula: `L = { w ∈ Σ* | N_${symbol}(w) = ${n} }`,
  };

  return optimizeSinkStates(dfa, options);
}

// ----------------------------------------------------------------------
// 9. At Most n Occurrences
// ----------------------------------------------------------------------
export function buildAtMostNOccurrences(
  nVal: number,
  symbolInput: string,
  alphabetInput?: string,
  options?: DfaGeneratorOptions
): DFA {
  const n = Math.max(0, Math.min(6, Math.floor(nVal ?? 2)));
  const symbol = symbolInput.trim() || 'a';
  const alphabet = ensureAlphabet(parseAlphabet(alphabetInput), symbol);

  const states: string[] = [];
  const acceptStates: string[] = [];
  for (let i = 0; i <= n; i++) {
    states.push(`q${i}`);
    acceptStates.push(`q${i}`);
  }
  states.push('q_dead');

  const transitions: Record<string, Record<string, string>> = {};
  states.forEach((s) => {
    transitions[s] = {};
  });

  for (let i = 0; i < n; i++) {
    for (const c of alphabet) {
      if (c === symbol) {
        transitions[`q${i}`][c] = `q${i + 1}`;
      } else {
        transitions[`q${i}`][c] = `q${i}`;
      }
    }
  }

  // At state q_n:
  for (const c of alphabet) {
    if (c === symbol) {
      transitions[`q${n}`][c] = 'q_dead';
    } else {
      transitions[`q${n}`][c] = `q${n}`;
    }
  }

  // At trap:
  for (const c of alphabet) {
    transitions['q_dead'][c] = 'q_dead';
  }

  const dfa: DFA = {
    name: `At Most ${n} '${symbol}'s`,
    description: `Language of strings containing at most ${n} occurrences of symbol '${symbol}'.`,
    alphabet,
    states,
    startState: 'q0',
    acceptStates,
    transitions,
    category: 'counting_parity',
    formula: `L = { w ∈ Σ* | N_${symbol}(w) ≤ ${n} }`,
  };

  return optimizeSinkStates(dfa, options);
}

// ----------------------------------------------------------------------
// 10. At Least n Occurrences
// ----------------------------------------------------------------------
export function buildAtLeastNOccurrences(
  nVal: number,
  symbolInput: string,
  alphabetInput?: string,
  options?: DfaGeneratorOptions
): DFA {
  const n = Math.max(0, Math.min(6, Math.floor(nVal ?? 2)));
  const symbol = symbolInput.trim() || 'a';
  const alphabet = ensureAlphabet(parseAlphabet(alphabetInput), symbol);

  const states: string[] = [];
  for (let i = 0; i <= n; i++) {
    states.push(`q${i}`);
  }

  const transitions: Record<string, Record<string, string>> = {};
  states.forEach((s) => {
    transitions[s] = {};
  });

  for (let i = 0; i < n; i++) {
    for (const c of alphabet) {
      if (c === symbol) {
        transitions[`q${i}`][c] = `q${i + 1}`;
      } else {
        transitions[`q${i}`][c] = `q${i}`;
      }
    }
  }

  // Once at least n is achieved, loop on all symbols:
  for (const c of alphabet) {
    transitions[`q${n}`][c] = `q${n}`;
  }

  const dfa: DFA = {
    name: `At Least ${n} '${symbol}'s`,
    description: `Language of strings containing at least ${n} occurrences of symbol '${symbol}'.`,
    alphabet,
    states,
    startState: 'q0',
    acceptStates: [`q${n}`],
    transitions,
    category: 'counting_parity',
    formula: `L = { w ∈ Σ* | N_${symbol}(w) ≥ ${n} }`,
  };

  return optimizeSinkStates(dfa, options);
}

// ----------------------------------------------------------------------
// 11. n Consecutive Symbol (e.g. 2 consecutive b's)
// ----------------------------------------------------------------------
export function buildNConsecutiveSymbol(
  nVal: number,
  symbolInput: string,
  alphabetInput?: string,
  conditionOrOptions?: 'does_not_contain' | 'contains' | DfaGeneratorOptions,
  options?: DfaGeneratorOptions
): DFA {
  const n = Math.max(1, Math.min(6, Math.floor(nVal ?? 2)));
  const symbol = symbolInput.trim() || 'b';
  const alphabet = ensureAlphabet(parseAlphabet(alphabetInput), symbol);

  let condition: 'does_not_contain' | 'contains' = 'contains';
  let genOptions = options;

  if (typeof conditionOrOptions === 'string') {
    condition = conditionOrOptions === 'does_not_contain' ? 'does_not_contain' : 'contains';
  } else if (conditionOrOptions && typeof conditionOrOptions === 'object') {
    genOptions = conditionOrOptions;
  }

  const targetSubstring = symbol.repeat(n);

  if (condition === 'does_not_contain') {
    // Mode: Language of strings that DO NOT contain n consecutive symbols (Avoids s^n)
    const m = targetSubstring.length;
    const states: string[] = [];
    const acceptStates: string[] = [];
    for (let i = 0; i < m; i++) {
      states.push(`q${i}`);
      acceptStates.push(`q${i}`);
    }
    states.push('q_dead');

    const transitions: Record<string, Record<string, string>> = {};
    states.forEach((s) => {
      transitions[s] = {};
    });

    for (let i = 0; i < m; i++) {
      const currentPrefix = targetSubstring.slice(0, i);
      for (const c of alphabet) {
        const candidate = currentPrefix + c;
        let nextStateIndex = 0;
        for (let k = Math.min(m, candidate.length); k > 0; k--) {
          if (candidate.endsWith(targetSubstring.slice(0, k))) {
            nextStateIndex = k;
            break;
          }
        }
        if (nextStateIndex === m) {
          transitions[`q${i}`][c] = 'q_dead';
        } else {
          transitions[`q${i}`][c] = `q${nextStateIndex}`;
        }
      }
    }

    for (const c of alphabet) {
      transitions['q_dead'][c] = 'q_dead';
    }

    const dfa: DFA = {
      name: `No ${n} Consecutive '${symbol}'s`,
      description: `Language of strings that do NOT contain ${n} consecutive '${symbol}'s. Encountering '${targetSubstring}' transitions into the permanent non-accepting dead/trap state.`,
      alphabet,
      states,
      startState: 'q0',
      acceptStates,
      transitions,
      category: 'consecutive_and_choice',
      formula: `L = { w ∈ Σ* | '${symbol}'^${n} ∉ Substrings(w) }`,
    };

    return optimizeSinkStates(dfa, genOptions);
  }

  // Default: Language of strings CONTAINING at least n consecutive occurrences of the symbol
  const containsDfa = buildContainsSubstring(targetSubstring, alphabetInput, genOptions);
  return {
    ...containsDfa,
    name: `${n} Consecutive '${symbol}'s`,
    description: `Language of all strings containing at least ${n} consecutive occurrences of '${symbol}' as a contiguous block ('${symbol}'^${n}).`,
    category: 'consecutive_and_choice',
    formula: `L = { w ∈ Σ* | '${symbol}'^${n} ∈ Substrings(w) }`,
  };
}

// ----------------------------------------------------------------------
// 12. String Contains Either of the Substrings
// ----------------------------------------------------------------------
export function buildContainsEitherSubstring(
  sub1: string,
  sub2: string,
  alphabetInput?: string,
  options?: DfaGeneratorOptions
): DFA {
  const s1 = sub1.trim() || 'ab';
  const s2 = sub2.trim() || 'ba';
  const alphabet = ensureAlphabet(parseAlphabet(alphabetInput), s1, s2);

  const dfa1 = buildContainsSubstring(s1, alphabetInput, options);
  const dfa2 = buildContainsSubstring(s2, alphabetInput, options);

  return productAutomaton(
    dfa1,
    dfa2,
    'union',
    {
      name: `Contains '${s1}' OR '${s2}'`,
      description: `Language of strings containing either '${s1}' or '${s2}' as a contiguous substring.`,
      formula: `L = { w ∈ Σ* | '${s1}' ∈ Substrings(w) ∨ '${s2}' ∈ Substrings(w) }`,
      category: 'consecutive_and_choice',
    },
    options
  );
}

// ----------------------------------------------------------------------
// Unified Alphabet & Symbol Options for UI Selectors
// ----------------------------------------------------------------------
const ALPHABET_OPTIONS = [
  { label: 'Σ = {a, b}', value: 'a,b' },
  { label: 'Σ = {0, 1}', value: '0,1' },
];

const SYMBOL_OPTIONS_AB = [
  { label: "Symbol 'a'", value: 'a' },
  { label: "Symbol 'b'", value: 'b' },
  { label: "Symbol '0'", value: '0' },
  { label: "Symbol '1'", value: '1' },
];

// ----------------------------------------------------------------------
// THE 12 REQUESTED PATTERNS (ALL OTHER PATTERNS REMOVED)
// ----------------------------------------------------------------------
export const PATTERN_CATEGORIES: PatternCategory[] = [
  {
    id: 'substring_affix',
    label: 'Substring & Affix Languages (1–4)',
    patterns: [
      {
        id: 'contains_substring',
        name: '1. Contains Substring',
        description: 'Strings containing a specified substring anywhere (substring may be a single symbol).',
        category: 'substring_affix',
        parameters: [
          {
            name: 'pattern',
            label: 'Substring',
            type: 'string',
            defaultValue: 'ab',
            helperText: 'Target substring, e.g. ab, 101, or single symbol a',
          },
          {
            name: 'alphabet',
            label: 'Alphabet (Σ)',
            type: 'select',
            defaultValue: 'a,b',
            options: ALPHABET_OPTIONS,
          },
        ],
        generate: (p, options) =>
          buildContainsSubstring(String(p.pattern || 'ab'), String(p.alphabet || 'a,b'), options),
        sampleAccepted: ['ab', 'aab', 'bab', 'aba'],
        sampleRejected: ['a', 'ba', 'bbb', 'b'],
      },
      {
        id: 'ends_with_substring',
        name: '2. Ends with Substring',
        description: 'Strings ending with a specified suffix substring (substring may be a single symbol).',
        category: 'substring_affix',
        parameters: [
          {
            name: 'pattern',
            label: 'Suffix Substring',
            type: 'string',
            defaultValue: 'ab',
            helperText: 'Suffix substring, e.g. ab, 01, or single symbol b',
          },
          {
            name: 'alphabet',
            label: 'Alphabet (Σ)',
            type: 'select',
            defaultValue: 'a,b',
            options: ALPHABET_OPTIONS,
          },
        ],
        generate: (p, options) =>
          buildEndsWithSubstring(String(p.pattern || 'ab'), String(p.alphabet || 'a,b'), options),
        sampleAccepted: ['ab', 'aab', 'bab', 'bbab'],
        sampleRejected: ['aba', 'a', 'ba', 'b'],
      },
      {
        id: 'starts_with_substring',
        name: '3. Starts with Substring',
        description: 'Strings starting with a specified prefix substring (substring may be a single symbol).',
        category: 'substring_affix',
        parameters: [
          {
            name: 'pattern',
            label: 'Prefix Substring',
            type: 'string',
            defaultValue: 'ab',
            helperText: 'Prefix substring, e.g. ab, 01, or single symbol a',
          },
          {
            name: 'alphabet',
            label: 'Alphabet (Σ)',
            type: 'select',
            defaultValue: 'a,b',
            options: ALPHABET_OPTIONS,
          },
        ],
        generate: (p, options) =>
          buildStartsWithSubstring(String(p.pattern || 'ab'), String(p.alphabet || 'a,b'), options),
        sampleAccepted: ['ab', 'aba', 'abb', 'abaa'],
        sampleRejected: ['ba', 'a', 'b', 'bab'],
      },
      {
        id: 'starts_and_ends_with',
        name: '4. Starts with Substring and Ends with Substring',
        description: 'Strings starting with one substring and ending with another (substring may be a single symbol).',
        category: 'substring_affix',
        parameters: [
          {
            name: 'startPattern',
            label: 'Starts with',
            type: 'string',
            defaultValue: 'a',
            helperText: 'Starting substring or single symbol (e.g. a, 01)',
          },
          {
            name: 'endPattern',
            label: 'Ends with',
            type: 'string',
            defaultValue: 'b',
            helperText: 'Ending substring or single symbol (e.g. b, 10)',
          },
          {
            name: 'alphabet',
            label: 'Alphabet (Σ)',
            type: 'select',
            defaultValue: 'a,b',
            options: ALPHABET_OPTIONS,
          },
        ],
        generate: (p, options) =>
          buildStartsAndEndsWith(
            String(p.startPattern || 'a'),
            String(p.endPattern || 'b'),
            String(p.alphabet || 'a,b'),
            options
          ),
        sampleAccepted: ['ab', 'aab', 'abb', 'abab'],
        sampleRejected: ['a', 'b', 'ba', 'aba'],
      },
    ],
  },
  {
    id: 'counting_parity',
    label: 'Occurrence & Parity Languages (5–9)',
    patterns: [
      {
        id: 'even_occurrences',
        name: '5. Even Number of Occurrences',
        description: 'Strings containing an even number of the specified symbol (0, 2, 4, ...).',
        category: 'counting_parity',
        parameters: [
          {
            name: 'symbol',
            label: 'Target Symbol',
            type: 'select',
            defaultValue: 'a',
            options: SYMBOL_OPTIONS_AB,
          },
          {
            name: 'alphabet',
            label: 'Alphabet (Σ)',
            type: 'select',
            defaultValue: 'a,b',
            options: ALPHABET_OPTIONS,
          },
        ],
        generate: (p, options) =>
          buildEvenOccurrences(String(p.symbol || 'a'), String(p.alphabet || 'a,b'), options),
        sampleAccepted: ['aa', 'baab', 'bb', 'aabaa'],
        sampleRejected: ['a', 'aaa', 'baa', 'ab'],
      },
      {
        id: 'odd_occurrences',
        name: '6. Odd Number of Occurrences',
        description: 'Strings containing an odd number of the specified symbol (1, 3, 5, ...).',
        category: 'counting_parity',
        parameters: [
          {
            name: 'symbol',
            label: 'Target Symbol',
            type: 'select',
            defaultValue: 'a',
            options: SYMBOL_OPTIONS_AB,
          },
          {
            name: 'alphabet',
            label: 'Alphabet (Σ)',
            type: 'select',
            defaultValue: 'a,b',
            options: ALPHABET_OPTIONS,
          },
        ],
        generate: (p, options) =>
          buildOddOccurrences(String(p.symbol || 'a'), String(p.alphabet || 'a,b'), options),
        sampleAccepted: ['a', 'aaa', 'ba', 'abaa'],
        sampleRejected: ['aa', 'bb', 'baab', 'aaaa'],
      },
      {
        id: 'exactly_n_occurrences',
        name: '7. Exactly n Occurrences',
        description: 'Strings containing exactly n occurrences of a specified symbol.',
        category: 'counting_parity',
        parameters: [
          {
            name: 'n',
            label: 'Exact Count (n)',
            type: 'number',
            defaultValue: 2,
            helperText: 'e.g. 2',
          },
          {
            name: 'symbol',
            label: 'Target Symbol',
            type: 'select',
            defaultValue: 'a',
            options: SYMBOL_OPTIONS_AB,
          },
          {
            name: 'alphabet',
            label: 'Alphabet (Σ)',
            type: 'select',
            defaultValue: 'a,b',
            options: ALPHABET_OPTIONS,
          },
        ],
        generate: (p, options) =>
          buildExactlyNOccurrences(
            Number(p.n ?? 2),
            String(p.symbol || 'a'),
            String(p.alphabet || 'a,b'),
            options
          ),
        sampleAccepted: ['aa', 'aba', 'baa', 'bbaab'],
        sampleRejected: ['a', 'aaa', 'b', 'ba'],
      },
      {
        id: 'atmost_n_occurrences',
        name: '8. At Most n Occurrences',
        description: 'Strings containing at most n occurrences of a specified symbol.',
        category: 'counting_parity',
        parameters: [
          {
            name: 'n',
            label: 'Maximum Count (n)',
            type: 'number',
            defaultValue: 2,
            helperText: 'e.g. 2',
          },
          {
            name: 'symbol',
            label: 'Target Symbol',
            type: 'select',
            defaultValue: 'a',
            options: SYMBOL_OPTIONS_AB,
          },
          {
            name: 'alphabet',
            label: 'Alphabet (Σ)',
            type: 'select',
            defaultValue: 'a,b',
            options: ALPHABET_OPTIONS,
          },
        ],
        generate: (p, options) =>
          buildAtMostNOccurrences(
            Number(p.n ?? 2),
            String(p.symbol || 'a'),
            String(p.alphabet || 'a,b'),
            options
          ),
        sampleAccepted: ['b', 'a', 'aa', 'aba', 'ba'],
        sampleRejected: ['aaa', 'baaaa', 'aabaa'],
      },
      {
        id: 'atleast_n_occurrences',
        name: '9. At Least n Occurrences',
        description: 'Strings containing at least n occurrences of a specified symbol.',
        category: 'counting_parity',
        parameters: [
          {
            name: 'n',
            label: 'Minimum Count (n)',
            type: 'number',
            defaultValue: 2,
            helperText: 'e.g. 2',
          },
          {
            name: 'symbol',
            label: 'Target Symbol',
            type: 'select',
            defaultValue: 'a',
            options: SYMBOL_OPTIONS_AB,
          },
          {
            name: 'alphabet',
            label: 'Alphabet (Σ)',
            type: 'select',
            defaultValue: 'a,b',
            options: ALPHABET_OPTIONS,
          },
        ],
        generate: (p, options) =>
          buildAtLeastNOccurrences(
            Number(p.n ?? 2),
            String(p.symbol || 'a'),
            String(p.alphabet || 'a,b'),
            options
          ),
        sampleAccepted: ['aa', 'aaa', 'aba', 'baaa', 'aaba'],
        sampleRejected: ['a', 'b', 'bb', 'bab'],
      },
    ],
  },
  {
    id: 'consecutive_and_choice',
    label: 'Consecutive & Alternative Languages (10–11)',
    patterns: [
      {
        id: 'n_consecutive_symbol',
        name: '10. n Consecutive Symbols',
        description: 'Language of strings containing at least n consecutive occurrences of a symbol (e.g. two consecutive b\'s).',
        category: 'consecutive_and_choice',
        parameters: [
          {
            name: 'n',
            label: 'Consecutive Count (n)',
            type: 'number',
            defaultValue: 2,
            helperText: 'e.g. 2 for 2 consecutive b\'s',
          },
          {
            name: 'symbol',
            label: 'Consecutive Symbol',
            type: 'select',
            defaultValue: 'b',
            options: SYMBOL_OPTIONS_AB,
          },
          {
            name: 'alphabet',
            label: 'Alphabet (Σ)',
            type: 'select',
            defaultValue: 'a,b',
            options: ALPHABET_OPTIONS,
          },
        ],
        generate: (p, options) =>
          buildNConsecutiveSymbol(
            Number(p.n ?? 2),
            String(p.symbol || 'b'),
            String(p.alphabet || 'a,b'),
            options
          ),
        sampleAccepted: ['bb', 'abb', 'bba', 'abbb', 'aabba'],
        sampleRejected: ['a', 'ab', 'ba', 'aba', 'bab'],
      },
      {
        id: 'contains_either_substring',
        name: '11. String Contains Either of the Substrings',
        description: 'Strings containing either of two specified substrings (S₁ ∨ S₂).',
        category: 'consecutive_and_choice',
        parameters: [
          {
            name: 'sub1',
            label: 'First Substring (S₁)',
            type: 'string',
            defaultValue: 'ab',
            helperText: 'e.g. ab or 00',
          },
          {
            name: 'sub2',
            label: 'Second Substring (S₂)',
            type: 'string',
            defaultValue: 'ba',
            helperText: 'e.g. ba or 11',
          },
          {
            name: 'alphabet',
            label: 'Alphabet (Σ)',
            type: 'select',
            defaultValue: 'a,b',
            options: ALPHABET_OPTIONS,
          },
        ],
        generate: (p, options) =>
          buildContainsEitherSubstring(
            String(p.sub1 || 'ab'),
            String(p.sub2 || 'ba'),
            String(p.alphabet || 'a,b'),
            options
          ),
        sampleAccepted: ['ab', 'ba', 'aab', 'bba', 'aba'],
        sampleRejected: ['a', 'b', 'aaa', 'bbb'],
      },
    ],
  },
];

/**
 * Universal DFA generator by pattern id, parameters, and optional generator options (e.g. pruneDeadStates).
 */
export function generatePatternDfa(
  patternId: string,
  params: Record<string, any>,
  options?: DfaGeneratorOptions
): DFA {
  for (const cat of PATTERN_CATEGORIES) {
    const p = cat.patterns.find((pat) => pat.id === patternId);
    if (p) {
      return p.generate(params, options);
    }
  }
  return buildContainsSubstring(String(params.pattern || 'ab'), String(params.alphabet || 'a,b'), options);
}
