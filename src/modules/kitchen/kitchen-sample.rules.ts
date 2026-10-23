/** Every cooked dish sold in the canteen needs a sample, including small rounds. */
export function kitchenSamplePolicy(product: any, batch: any) {
  const ticket = Boolean(batch.details?.workflowTicketId);
  const quantity = Number(
    batch.actualQuantity ??
      Number(batch.plannedQuantity || 0) +
        Number(batch.adjustmentQuantity || 0),
  );
  const requiresImage = !ticket && (batch.source === 'BOARDING' || quantity > 30);
  return {
    requiresSample: Boolean(product?.requiresSample) || ticket || quantity > 30,
    requiresImage,
  };
}

export function hasKitchenSample(samples: any[], batch: any, date: string) {
  return samples.some((sample) => {
    const sampledAt = Date.parse(sample.payload.sampledAt);
    if (!(Number(sample.payload.quantity) > 0) || !Number.isFinite(sampledAt))
      return false;
    if (batch.details?.workflowTicketId) {
      return (
        sample.date === date &&
        sample.payload.productId === batch.productId &&
        new Date(sampledAt + 7 * 3600000).toISOString().slice(0, 10) === date
      );
    }
    return (
      sample.parentId === batch.id &&
      sampledAt >= new Date(batch.startedAt).getTime()
    );
  });
}
