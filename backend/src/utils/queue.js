// Simple in-memory sequential queue, one per client.
// Prevents hitting Groq rate limits and sending WhatsApp messages too fast (ban risk).
// For bigger scale, swap this for BullMQ + Redis - the enqueue() interface stays the same.

const queues = new Map(); // clientId -> { items: [], running: boolean }

function getQueue(clientId) {
  if (!queues.has(clientId)) {
    queues.set(clientId, { items: [], running: false });
  }
  return queues.get(clientId);
}

export function enqueue(clientId, taskFn) {
  const q = getQueue(clientId);
  return new Promise((resolve, reject) => {
    q.items.push({ taskFn, resolve, reject });
    processQueue(clientId);
  });
}

async function processQueue(clientId) {
  const q = getQueue(clientId);
  if (q.running) return;
  q.running = true;

  while (q.items.length > 0) {
    const { taskFn, resolve, reject } = q.items.shift();
    try {
      resolve(await taskFn());
    } catch (err) {
      reject(err);
    }
  }
  q.running = false;
}
