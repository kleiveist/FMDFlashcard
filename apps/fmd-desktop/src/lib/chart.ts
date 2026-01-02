export const buildLineChartPoints = (values: number[]) => {
  if (values.length === 0) {
    return "";
  }
  const maxValue = Math.max(1, ...values);
  const step = values.length === 1 ? 0 : 100 / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = 40 - (value / maxValue) * 30;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
};
