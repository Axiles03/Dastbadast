import { useState } from "react";
import { View, Text, Pressable, Image } from "react-native";
import { useCart } from "../lib/cart-context";
import { Ionicons } from "@expo/vector-icons";

export type FoodCardItem = {
  id: string;
  title: string;
  price: number;
  image?: string | null;
  description?: string | null;
  averageRating?: number;
  reviewCount?: number;
  isAvailable?: boolean;
  restaurantId: string;
  restaurantName: string;
};

const FOOD_FALLBACKS = [
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80",
  "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&q=80",
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&q=80",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function coverFor(name: string, image?: string | null) {
  if (image && image.trim()) return image;
  return FOOD_FALLBACKS[hash(name) % FOOD_FALLBACKS.length];
}

export function FoodCard({
  food,
  currencySymbol,
  onPress,
  onAdd,
}: {
  food: FoodCardItem;
  currencySymbol: string;
  onPress?: () => void;
  onAdd?: () => void;
}) {
  const { add, items } = useCart();
  const [flash, setFlash] = useState(false);
  const inCart = items.find((i) => i.foodId === food.id);

  const handleAdd = () => {
    if (onAdd) return onAdd();
    add({
      foodId: food.id,
      title: food.title,
      price: food.price,
      image: coverFor(food.title, food.image),
      description: food.description ?? undefined,
      quantity: 1,
      restaurantId: food.restaurantId,
      restaurantName: food.restaurantName,
    });
    setFlash(true);
    setTimeout(() => setFlash(false), 1200);
  };

  return (
    <View className="bg-soft-surface border border-border rounded-2xl p-3 items-center w-[160px]">
      <Pressable onPress={onPress} className="w-full items-center">
        <View className="relative w-[140px] h-[140px] rounded-full bg-soft-surface-2 overflow-hidden">
          <Image
            source={{ uri: coverFor(food.title, food.image) }}
            className="w-full h-full"
            resizeMode="cover"
          />
          {typeof food.averageRating === "number" && food.averageRating > 0 && (
            <View className="absolute top-1.5 right-1.5 flex-row items-center bg-text-inverse px-1.5 py-0.5 rounded-full">
              <Ionicons name="star" size={10} color="#F5A623" />
              <Text className="text-2xs font-extrabold text-text ml-0.5">
                {food.averageRating.toFixed(1)}
              </Text>
            </View>
          )}
          {inCart && (
            <View className="absolute top-1.5 left-1.5 bg-accent min-w-[20px] h-[20px] rounded-full items-center justify-center px-1.5">
              <Text className="text-2xs font-extrabold text-text-inverse">
                {inCart.quantity}
              </Text>
            </View>
          )}
        </View>
        <Text
          className="text-sm font-bold text-text mt-2.5 text-center"
          numberOfLines={1}
        >
          {food.title}
        </Text>
        <Text className="text-sm font-extrabold text-accent mt-1">
          {food.price} {currencySymbol}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleAdd}
        className="bg-accent mt-2 w-9 h-9 rounded-full items-center justify-center shadow-soft-sm active:scale-95"
      >
        <Ionicons name="add" size={22} color="white" />
      </Pressable>
      {flash && <Text className="text-2xs text-accent mt-1">✓ добавлено</Text>}
    </View>
  );
}
