const BASE_URL = '/api';

export async function fetchDefaults() {
  const res = await fetch(`${BASE_URL}/defaults`);
  return res.json();
}

export async function runCalculation(inputs: any) {
  const res = await fetch(`${BASE_URL}/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputs),
  });
  return res.json();
}
