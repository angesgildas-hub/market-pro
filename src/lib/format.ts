export const formatPrice = (amount: number): string => {
  return (amount || 0).toLocaleString('de-DE') + ' FCFA';
};

export const formatNumber = (num: number): string => {
  return (num || 0).toLocaleString('de-DE');
};
