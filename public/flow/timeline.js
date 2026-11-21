// Timings are illustrative. Some steps group multiple operations.
export function getTimeline(scenario) {
  let end = 0;
  return scenario.steps.map((step) => {
    const start = end;
    end += step.duration;
    return { ...step, start, end };
  });
}
