export type ComputeEngineAdapterStatus = {
  available: false;
  reason: string;
};

export const getComputeEngineAdapterStatus = (): ComputeEngineAdapterStatus => ({
  available: false,
  reason: "Compute Engine is declared for installation but is not available in this runtime.",
});
