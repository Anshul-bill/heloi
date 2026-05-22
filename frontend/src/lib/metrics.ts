export function calculateMSE(actual: number[], predicted: number[]): number {
  if (!actual || !predicted || actual.length !== predicted.length || actual.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < actual.length; i++) {
    sum += Math.pow(actual[i] - predicted[i], 2);
  }
  return sum / actual.length;
}

export function calculateRMSE(actual: number[], predicted: number[]): number {
  return Math.sqrt(calculateMSE(actual, predicted));
}

export function calculateRSE(actual: number[], predicted: number[]): number {
  if (!actual || !predicted || actual.length !== predicted.length || actual.length === 0) return 0;
  
  const meanActual = actual.reduce((a, b) => a + b, 0) / actual.length;
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < actual.length; i++) {
    numerator += Math.pow(actual[i] - predicted[i], 2);
    denominator += Math.pow(actual[i] - meanActual, 2);
  }
  
  return denominator === 0 ? 0 : numerator / denominator;
}
