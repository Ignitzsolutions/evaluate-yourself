export function createGazeTelemetryBatcher(send, { maxBatchSize = 5, flushIntervalMs = 100 } = {}) {
  let queue = [];
  let timer = null;
  let closed = false;

  const flush = () => {
    if (closed || queue.length === 0) {
      return;
    }
    const batch = queue;
    queue = [];
    send(batch.length === 1 ? batch[0] : { type: "batch", events: batch, batch_size: batch.length });
  };

  const scheduleFlush = () => {
    if (timer || closed) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, flushIntervalMs);
  };

  return {
    enqueue(event) {
      if (closed || typeof send !== "function") {
        return false;
      }
      queue.push(event);
      if (queue.length >= maxBatchSize) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        flush();
      } else {
        scheduleFlush();
      }
      return true;
    },
    flush,
    close() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      flush();
      closed = true;
    },
  };
}
