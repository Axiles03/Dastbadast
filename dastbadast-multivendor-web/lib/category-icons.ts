export function categoryIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('бургер') || t.includes('burger')) return '🍔';
  if (t.includes('напит') || t.includes('drink') || t.includes('чай') || t.includes('кофе')) return '🥤';
  if (t.includes('десерт') || t.includes('слад') || t.includes('торт')) return '🧁';
  if (t.includes('суп') || t.includes('лапш') || t.includes('лагман')) return '🍜';
  if (t.includes('салат')) return '🥗';
  if (t.includes('пицц')) return '🍕';
  if (t.includes('основ') || t.includes('горяч')) return '🍽️';
  if (t.includes('шашлык') || t.includes('мяс')) return '🥩';
  return '🍴';
}

export function foodImageUrl(title: string, image?: string | null): string {
  if (image && image.trim()) return image.trim();
  const q = encodeURIComponent(title.slice(0, 40));
  return `https://placehold.co/400x400/252836/EA7369?text=${q}`;
}
