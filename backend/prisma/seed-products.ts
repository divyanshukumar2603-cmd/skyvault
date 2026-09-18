/**
 * Seeds the product catalogue and a baseline of shopper activity.
 *
 *   npm run seed:products
 *
 * The demo shoppers exist so that popularity is a real measurement rather than
 * a column of zeros: a brand-new account should still see a sensible ordering
 * on its very first visit (the cold-start path). They have no password hash,
 * so none of them can be logged into.
 *
 * Re-running is safe — products are upserted by id and demo activity is
 * regenerated from scratch.
 */
import { PrismaClient, InteractionType } from '@prisma/client';

const prisma = new PrismaClient();

type Seed = {
  id: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  price: number;
  rating: number;
  ratingCount: number;
};

const PRODUCTS: Seed[] = [
  // Electronics
  { id: 'p-elec-01', name: 'Aurora 14" Ultrabook', description: 'Fanless 14-inch laptop with a 2.8K OLED display and 18-hour battery.', category: 'Electronics', brand: 'Aurora', price: 1299.00, rating: 4.6, ratingCount: 892 },
  { id: 'p-elec-02', name: 'Aurora Buds Pro', description: 'Active noise cancelling earbuds with spatial audio.', category: 'Electronics', brand: 'Aurora', price: 179.00, rating: 4.4, ratingCount: 2431 },
  { id: 'p-elec-03', name: 'Nimbus 27" 4K Monitor', description: 'Colour-accurate 27-inch display with USB-C single-cable docking.', category: 'Electronics', brand: 'Nimbus', price: 549.00, rating: 4.5, ratingCount: 617 },
  { id: 'p-elec-04', name: 'Nimbus Mechanical Keyboard', description: 'Hot-swappable 75% keyboard with PBT keycaps.', category: 'Electronics', brand: 'Nimbus', price: 129.00, rating: 4.7, ratingCount: 1043 },
  { id: 'p-elec-05', name: 'Volt Powerbank 20K', description: '20,000 mAh power bank with 100W passthrough charging.', category: 'Electronics', brand: 'Volt', price: 79.00, rating: 4.2, ratingCount: 3287 },

  // Fashion
  { id: 'p-fash-01', name: 'Meridian Wool Overcoat', description: 'Tailored double-faced wool coat, fully lined.', category: 'Fashion', brand: 'Meridian', price: 389.00, rating: 4.3, ratingCount: 214 },
  { id: 'p-fash-02', name: 'Meridian Oxford Shirt', description: 'Garment-washed cotton oxford with a soft collar.', category: 'Fashion', brand: 'Meridian', price: 89.00, rating: 4.5, ratingCount: 1120 },
  { id: 'p-fash-03', name: 'Trailhead Rain Shell', description: 'Three-layer waterproof shell that packs into its own pocket.', category: 'Fashion', brand: 'Trailhead', price: 219.00, rating: 4.6, ratingCount: 738 },
  { id: 'p-fash-04', name: 'Trailhead Runner GT', description: 'Everyday running shoe with a carbon-infused plate.', category: 'Fashion', brand: 'Trailhead', price: 149.00, rating: 4.4, ratingCount: 2966 },
  { id: 'p-fash-05', name: 'Kestrel Leather Weekender', description: 'Full-grain leather holdall with a detachable strap.', category: 'Fashion', brand: 'Kestrel', price: 459.00, rating: 4.8, ratingCount: 152 },

  // Home
  { id: 'p-home-01', name: 'Hearth Cast Iron Skillet', description: 'Pre-seasoned 12-inch skillet, oven safe to 260°C.', category: 'Home', brand: 'Hearth', price: 69.00, rating: 4.8, ratingCount: 4210 },
  { id: 'p-home-02', name: 'Hearth Pour-Over Kettle', description: 'Gooseneck kettle with variable temperature control.', category: 'Home', brand: 'Hearth', price: 119.00, rating: 4.6, ratingCount: 1876 },
  { id: 'p-home-03', name: 'Lumen Floor Lamp', description: 'Dimmable arc lamp with a linen shade and warm LED.', category: 'Home', brand: 'Lumen', price: 229.00, rating: 4.1, ratingCount: 391 },
  { id: 'p-home-04', name: 'Lumen Desk Task Light', description: 'Asymmetric task light with adjustable colour temperature.', category: 'Home', brand: 'Lumen', price: 149.00, rating: 4.5, ratingCount: 823 },
  { id: 'p-home-05', name: 'Drift Linen Duvet Set', description: 'Stonewashed French linen duvet cover with two shams.', category: 'Home', brand: 'Drift', price: 269.00, rating: 4.7, ratingCount: 645 },

  // Fitness
  { id: 'p-fit-01', name: 'Pulse Smart Ring', description: 'Sleep and recovery tracking ring with a seven-day battery.', category: 'Fitness', brand: 'Pulse', price: 299.00, rating: 4.2, ratingCount: 1533 },
  { id: 'p-fit-02', name: 'Pulse Heart Rate Strap', description: 'Chest strap with dual-band ANT+ and Bluetooth.', category: 'Fitness', brand: 'Pulse', price: 89.00, rating: 4.6, ratingCount: 2104 },
  { id: 'p-fit-03', name: 'Anchor Adjustable Dumbbells', description: 'Pair adjusting from 2.5 kg to 24 kg per hand.', category: 'Fitness', brand: 'Anchor', price: 549.00, rating: 4.5, ratingCount: 876 },
  { id: 'p-fit-04', name: 'Anchor Yoga Mat Pro', description: 'Natural rubber mat with an alignment guide, 6 mm.', category: 'Fitness', brand: 'Anchor', price: 98.00, rating: 4.4, ratingCount: 1687 },

  // Books
  { id: 'p-book-01', name: 'Designing Data-Intensive Applications', description: 'The reliability, scalability and maintainability of modern systems.', category: 'Books', brand: 'Kestrel Press', price: 54.00, rating: 4.9, ratingCount: 8921 },
  { id: 'p-book-02', name: 'The Pragmatic Cloud', description: 'Patterns for building on object storage and managed services.', category: 'Books', brand: 'Kestrel Press', price: 42.00, rating: 4.4, ratingCount: 1204 },
  { id: 'p-book-03', name: 'Recommender Systems in Practice', description: 'Collaborative filtering, ranking and evaluation, with case studies.', category: 'Books', brand: 'Meridian Press', price: 61.00, rating: 4.5, ratingCount: 702 },

  // Audio
  { id: 'p-aud-01', name: 'Resonance Studio Headphones', description: 'Open-back reference headphones with a detachable cable.', category: 'Audio', brand: 'Resonance', price: 399.00, rating: 4.7, ratingCount: 1345 },
  { id: 'p-aud-02', name: 'Resonance Desktop DAC', description: 'Balanced desktop DAC and headphone amplifier.', category: 'Audio', brand: 'Resonance', price: 349.00, rating: 4.6, ratingCount: 428 },
  { id: 'p-aud-03', name: 'Volt Portable Speaker', description: 'IP67 speaker with 24-hour playback and stereo pairing.', category: 'Audio', brand: 'Volt', price: 159.00, rating: 4.3, ratingCount: 3902 },
];

/** Demo shoppers, each with a distinct taste, so popularity is not uniform. */
const SHOPPERS = [
  { email: 'demo.shopper.tech@cloudvault.local', name: 'Demo Shopper (Tech)', favours: ['Electronics', 'Audio'] },
  { email: 'demo.shopper.home@cloudvault.local', name: 'Demo Shopper (Home)', favours: ['Home'] },
  { email: 'demo.shopper.style@cloudvault.local', name: 'Demo Shopper (Style)', favours: ['Fashion'] },
  { email: 'demo.shopper.fit@cloudvault.local', name: 'Demo Shopper (Fitness)', favours: ['Fitness', 'Books'] },
  { email: 'demo.shopper.mixed@cloudvault.local', name: 'Demo Shopper (Mixed)', favours: ['Electronics', 'Home', 'Books'] },
];

// Deterministic PRNG, so a reseed reproduces the same catalogue activity.
let seed = 42;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

async function main() {
  console.log('Seeding products...');
  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { id: p.id },
      create: p,
      update: { name: p.name, description: p.description, category: p.category, brand: p.brand, price: p.price, rating: p.rating, ratingCount: p.ratingCount },
    });
  }
  console.log(`  ${PRODUCTS.length} products upserted`);

  console.log('Seeding demo shoppers...');
  const shopperIds: { id: string; favours: string[] }[] = [];
  for (const s of SHOPPERS) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      create: { email: s.email, displayName: s.name },
      update: { displayName: s.name },
    });
    shopperIds.push({ id: user.id, favours: s.favours });
  }
  console.log(`  ${shopperIds.length} demo shoppers ready`);

  console.log('Regenerating demo interaction history...');
  await prisma.productInteraction.deleteMany({
    where: { userId: { in: shopperIds.map((s) => s.id) } },
  });

  const rows: { userId: string; productId: string; type: InteractionType; createdAt: Date }[] = [];

  // Sessions are generated as a real funnel: a view may lead to a click, a click
  // to a cart add, a cart add to a purchase. Generating the types independently
  // would produce impossible analytics (more purchases than cart adds).
  const P_CLICK = 0.45;
  const P_CART_GIVEN_CLICK = 0.35;
  const P_PURCHASE_GIVEN_CART = 0.5;

  for (const shopper of shopperIds) {
    const favoured = PRODUCTS.filter((p) => shopper.favours.includes(p.category));
    const others = PRODUCTS.filter((p) => !shopper.favours.includes(p.category));

    // 80% of a shopper's activity lands in the categories they favour.
    for (let session = 0; session < 40; session++) {
      const product = rand() < 0.8 ? pick(favoured) : pick(others);
      const ageDays = rand() * 14;
      const at = (offsetMinutes: number) =>
        new Date(Date.now() - ageDays * 86_400_000 + offsetMinutes * 60_000);

      const push = (type: InteractionType, offset: number) =>
        rows.push({ userId: shopper.id, productId: product.id, type, createdAt: at(offset) });

      push('VIEW', 0);
      if (rand() < P_CLICK) {
        push('CLICK', 1);
        if (rand() < P_CART_GIVEN_CLICK) {
          push('CART', 3);
          if (rand() < P_PURCHASE_GIVEN_CART) push('PURCHASE', 6);
        }
      }
    }
  }

  await prisma.productInteraction.createMany({ data: rows });
  const byType = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  ${rows.length} interactions created across ${shopperIds.length} shoppers`);
  console.log(`  funnel: ${byType.VIEW ?? 0} views -> ${byType.CLICK ?? 0} clicks -> ${byType.CART ?? 0} carts -> ${byType.PURCHASE ?? 0} purchases`);

  const counts = await prisma.productInteraction.groupBy({
    by: ['productId'],
    _count: { productId: true },
    orderBy: { _count: { productId: 'desc' } },
    take: 3,
  });
  console.log('\nMost-engaged products:');
  for (const c of counts) {
    const p = PRODUCTS.find((x) => x.id === c.productId);
    console.log(`  ${c._count.productId} interactions — ${p?.name}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
