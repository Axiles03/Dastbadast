import "dotenv/config";
import mongoose from "mongoose";
import { Restaurant } from "../src/models/Restaurant.js";
import { RestaurantReview } from "../src/models/RestaurantReview.js";

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/dastbadast";

(async () => {
  await mongoose.connect(MONGO_URI);
  const restaurants = await Restaurant.find({}).select("_id").lean();
  for (const r of restaurants) {
    const stats = await RestaurantReview.aggregate([
      { $match: { restaurantId: r._id } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    if (stats[0]) {
      await Restaurant.findByIdAndUpdate(r._id, {
        averageRating: +stats[0].avg.toFixed(2),
        totalRatings: stats[0].count,
      });
    } else {
      // даже если 0 отзывов — пишем дефолты, чтобы поле существовало
      await Restaurant.findByIdAndUpdate(r._id, {
        averageRating: 0,
        totalRatings: 0,
      });
    }
  }
  console.log(`✅ Migrated ${restaurants.length} restaurants`);
  process.exit(0);
})();
