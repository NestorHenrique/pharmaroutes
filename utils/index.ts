export const isRecentDoctor = (createdAt?: string) => {
  if (!createdAt) return false;
  const createdDate = new Date(createdAt);
  const now = new Date();
  return (now.getTime() - createdDate.getTime()) / (1000 * 3600 * 24) <= 7;
};