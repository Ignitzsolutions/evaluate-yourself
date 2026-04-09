import { createGazeTelemetryBatcher } from "../gazeTelemetryBatch";

describe("createGazeTelemetryBatcher", () => {
  it("batches events until max size is reached", () => {
    const sent = [];
    const batcher = createGazeTelemetryBatcher((payload) => sent.push(payload), {
      maxBatchSize: 2,
      flushIntervalMs: 1000,
    });

    batcher.enqueue({ type: "frame", t: 1 });
    expect(sent).toHaveLength(0);

    batcher.enqueue({ type: "frame", t: 2 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      type: "batch",
      batch_size: 2,
      events: [
        { type: "frame", t: 1 },
        { type: "frame", t: 2 },
      ],
    });
  });

  it("flushes buffered events when closed", () => {
    const sent = [];
    const batcher = createGazeTelemetryBatcher((payload) => sent.push(payload), {
      maxBatchSize: 3,
      flushIntervalMs: 1000,
    });

    batcher.enqueue({ type: "init", t: 1 });
    batcher.close();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({ type: "init", t: 1 });
  });
});
