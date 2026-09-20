import { DFA } from '../types';

/**
 * Finds all states reachable from the start state using BFS.
 */
export function getReachableStates(dfa: DFA): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [dfa.startState];
  reachable.add(dfa.startState);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const stateTransitions = dfa.transitions[current] || {};

    for (const symbol of dfa.alphabet) {
      const next = stateTransitions[symbol];
      if (next && !reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }

  return reachable;
}

/**
 * Checks if a state is a dead/trap state.
 * A dead state is:
 * 1. Non-accepting
 * 2. Cannot reach ANY accepting state
 * 3. Typically transitions to itself on all alphabet symbols
 */
export function findDeadStates(dfa: DFA): Set<string> {
  const deadStates = new Set<string>();
  const acceptSet = new Set(dfa.acceptStates);

  for (const state of dfa.states) {
    if (acceptSet.has(state)) continue;

    // Check if state can reach any accept state
    const visited = new Set<string>();
    const queue = [state];
    visited.add(state);
    let canReachAccept = false;

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (acceptSet.has(curr)) {
        canReachAccept = true;
        break;
      }

      const transitions = dfa.transitions[curr] || {};
      for (const symbol of dfa.alphabet) {
        const next = transitions[symbol];
        if (next && !visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    if (!canReachAccept) {
      deadStates.add(state);
    }
  }

  return deadStates;
}

/**
 * Hopcroft's DFA Minimization Algorithm (O(k n log n))
 */
export function minimizeDFA(dfa: DFA): DFA {
  // 1. Remove unreachable states
  const reachable = getReachableStates(dfa);
  const states = dfa.states.filter((s) => reachable.has(s));

  if (states.length <= 1) {
    return dfa;
  }

  const acceptSet = new Set(dfa.acceptStates.filter((s) => reachable.has(s)));
  const nonAcceptStates = states.filter((s) => !acceptSet.has(s));
  const acceptList = Array.from(acceptSet);

  // If all states are accepting or all are non-accepting
  if (acceptList.length === 0 || nonAcceptStates.length === 0) {
    const singleStateName = 'q0';
    const transitions: Record<string, Record<string, string>> = {
      [singleStateName]: {},
    };
    for (const sym of dfa.alphabet) {
      transitions[singleStateName][sym] = singleStateName;
    }
    return {
      name: dfa.name,
      description: dfa.description,
      alphabet: [...dfa.alphabet],
      states: [singleStateName],
      startState: singleStateName,
      acceptStates: acceptList.length > 0 ? [singleStateName] : [],
      transitions,
      category: dfa.category,
      formula: dfa.formula,
    };
  }

  // Initial partition: P = { AcceptStates, NonAcceptStates }
  let P: string[][] = [acceptList, nonAcceptStates];
  let W: string[][] = [acceptList.length <= nonAcceptStates.length ? [...acceptList] : [...nonAcceptStates]];

  // Pre-calculate inverse transitions: inv[symbol][targetState] = Set(sourceStates)
  const inv: Record<string, Record<string, string[]>> = {};
  for (const sym of dfa.alphabet) {
    inv[sym] = {};
    for (const s of states) {
      inv[sym][s] = [];
    }
  }

  for (const s of states) {
    const trans = dfa.transitions[s] || {};
    for (const sym of dfa.alphabet) {
      const next = trans[sym];
      if (next && reachable.has(next)) {
        if (!inv[sym][next]) inv[sym][next] = [];
        inv[sym][next].push(s);
      }
    }
  }

  while (W.length > 0) {
    const A = W.pop()!;
    const ASet = new Set(A);

    for (const c of dfa.alphabet) {
      // Find all states X that lead to some state in A on symbol c
      const XSet = new Set<string>();
      for (const target of A) {
        const sources = inv[c][target] || [];
        for (const src of sources) {
          XSet.add(src);
        }
      }

      const newP: string[][] = [];

      for (const Y of P) {
        const Y_intersect_X: string[] = [];
        const Y_diff_X: string[] = [];

        for (const state of Y) {
          if (XSet.has(state)) {
            Y_intersect_X.push(state);
          } else {
            Y_diff_X.push(state);
          }
        }

        if (Y_intersect_X.length > 0 && Y_diff_X.length > 0) {
          newP.push(Y_intersect_X);
          newP.push(Y_diff_X);

          // Update W
          const yIndexInW = W.findIndex(
            (wSet) => wSet.length === Y.length && wSet.every((val, i) => val === Y[i])
          );

          if (yIndexInW !== -1) {
            W.splice(yIndexInW, 1, Y_intersect_X, Y_diff_X);
          } else {
            if (Y_intersect_X.length <= Y_diff_X.length) {
              W.push(Y_intersect_X);
            } else {
              W.push(Y_diff_X);
            }
          }
        } else {
          newP.push(Y);
        }
      }

      P = newP;
    }
  }

  // Build partition lookup: state -> partition ID
  const partitionMap: Record<string, number> = {};
  P.forEach((part, index) => {
    part.forEach((state) => {
      partitionMap[state] = index;
    });
  });

  // Assign clean, meaningful names to the partitions
  // Put start state partition first (e.g. q0)
  const startPartIndex = partitionMap[dfa.startState];
  const sortedPartIndices = [
    startPartIndex,
    ...P.map((_, i) => i).filter((i) => i !== startPartIndex),
  ];

  const partToNewName: Record<number, string> = {};
  sortedPartIndices.forEach((partIdx, newIdx) => {
    partToNewName[partIdx] = `q${newIdx}`;
  });

  const newStates = sortedPartIndices.map((partIdx) => partToNewName[partIdx]);
  const newStartState = partToNewName[startPartIndex];
  const newAcceptStates: string[] = [];

  for (const partIdx of sortedPartIndices) {
    const part = P[partIdx];
    if (part.some((s) => acceptSet.has(s))) {
      newAcceptStates.push(partToNewName[partIdx]);
    }
  }

  const newTransitions: Record<string, Record<string, string>> = {};

  for (const partIdx of sortedPartIndices) {
    const representative = P[partIdx][0];
    const newName = partToNewName[partIdx];
    newTransitions[newName] = {};

    for (const sym of dfa.alphabet) {
      const dest = dfa.transitions[representative]?.[sym];
      if (dest !== undefined && partitionMap[dest] !== undefined) {
        newTransitions[newName][sym] = partToNewName[partitionMap[dest]];
      }
    }
  }

  return {
    name: dfa.name,
    description: dfa.description,
    alphabet: [...dfa.alphabet],
    states: newStates,
    startState: newStartState,
    acceptStates: newAcceptStates,
    transitions: newTransitions,
    category: dfa.category,
    formula: dfa.formula,
  };
}
