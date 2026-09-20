import { DFA, SimulationResult, SimulationStep } from '../types';

export function simulateDFA(dfa: DFA, inputString: string): SimulationResult {
  const steps: SimulationStep[] = [];
  let currentState = dfa.startState;

  // Check if string characters belong to alphabet
  for (let i = 0; i < inputString.length; i++) {
    const symbol = inputString[i];
    if (!dfa.alphabet.includes(symbol)) {
      return {
        inputString,
        isValidAlphabet: false,
        invalidSymbol: symbol,
        steps,
        currentState,
        isAccepted: false,
        status: 'error',
        message: `Invalid symbol '${symbol}' at position ${i + 1}. Alphabet is {${dfa.alphabet.join(', ')}}.`,
      };
    }
  }

  // Execute deterministic transitions
  for (let i = 0; i < inputString.length; i++) {
    const symbol = inputString[i];
    const trans = dfa.transitions[currentState] || {};
    const nextState = trans[symbol];

    if (!nextState) {
      // In pruned DFA representations where sink / dead states have been pruned,
      // a missing transition deterministically transitions into the implicit
      // non-accepting sink state. This maintains complete logical DFA language correctness.
      steps.push({
        stepIndex: i,
        fromState: currentState,
        symbol,
        toState: '∅ (Sink)',
      });

      return {
        inputString,
        isValidAlphabet: true,
        steps,
        currentState: '∅ (Sink)',
        isAccepted: false,
        status: 'completed',
        message: `REJECTED: Transition on symbol '${symbol}' from '${currentState}' enters the implicit sink / trap state.`,
      };
    }

    steps.push({
      stepIndex: i,
      fromState: currentState,
      symbol,
      toState: nextState,
    });

    currentState = nextState;
  }

  const isAccepted = dfa.acceptStates.includes(currentState);

  return {
    inputString,
    isValidAlphabet: true,
    steps,
    currentState,
    isAccepted,
    status: 'completed',
    message: isAccepted
      ? `ACCEPTED: Simulation halted in accept state '${currentState}'.`
      : `REJECTED: Simulation halted in non-accept state '${currentState}'.`,
  };
}

export function testStringsBatch(
  dfa: DFA,
  testList: string[]
): { input: string; isAccepted: boolean; stepsCount: number; isValid: boolean }[] {
  return testList.map((str) => {
    const res = simulateDFA(dfa, str);
    return {
      input: str === '' ? 'ε (empty)' : str,
      isAccepted: res.isAccepted,
      stepsCount: res.steps.length,
      isValid: res.isValidAlphabet,
    };
  });
}
