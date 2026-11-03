import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before loading the development menu.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

const categories = [
  { name: "Ice Cream", slug: "ice-cream", description: "Slow-churned scoops for the long way home.", imageUrl: "/ice-cream/Pastel%20Ice%20Cream%20Cart%20in%20the%20Park.png" },
  { name: "Ice Cream Cones", slug: "ice-cream-cones", description: "Classic cones, mixed scoops, and sweet little extras.", imageUrl: "/images/Glossy%20Trio%20of%20Soft-Serve%20Cones.png" },
  { name: "Waffles", slug: "waffles", description: "Warm, golden, and entirely your own.", imageUrl: "/krunchy/Golden%20Waffle%20Skewer%20Display.png" },
  { name: "Candy", slug: "candy", description: "A little color for the everyday.", imageUrl: "https://images.unsplash.com/photo-1581798459219-318e76aecc7b?auto=format&fit=crop&w=1100&q=84" },
  { name: "Cotton Candy", slug: "cotton-candy", description: "Cloud-soft sweetness in bright pastel colors.", imageUrl: "/images/cotton-candy-2.png" },
  { name: "Popcorn", slug: "popcorn", description: "The very best seat-in-the-house snack.", imageUrl: "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=1100&q=84" },
  { name: "Cupcakes", slug: "cupcakes", description: "Little cakes made for lovely occasions.", imageUrl: "/krunchy/Tropical%20Garden%20Cupcake%20Celebration.png" },
  { name: "Hot Dogs & Buffet", slug: "hot-dogs", description: "Hot dogs and tailored buffet requests for your gathering.", imageUrl: "/krunchy/Golden%20Hot%20Dog%20Buffet%20Display.png" },
  { name: "Chicken & Chips", slug: "chicken-and-chips", description: "Comforting meals for everyday orders and event catering.", imageUrl: "/krunchy/Golden%20Fries,%20Grilled%20Chicken,%20and%20Ketchup.png" },
  { name: "Spaghetti & Chicken", slug: "spaghetti-and-chicken", description: "Warm, satisfying plates and shareable event trays.", imageUrl: "/krunchy/Jollof%20Spaghetti%20with%20Charred%20Chicken.png" },
  { name: "Refreshing KrunchyKremmy Drinks", slug: "drinks", description: "Refreshing pouches and party drinks, made to order.", imageUrl: "/krunchy/KrunchyKremmy%20Orange%20Chapman.png" }
];

const cupcakeOptions = [
  { key: "boxSize", label: "Box size", required: true, choices: [{ name: "Box of 4", priceCents: 0 }, { name: "Box of 6", priceCents: 800 }, { name: "Box of 12", priceCents: 2400 }] },
  { key: "flavor", label: "Cupcake flavour", required: true, choices: [{ name: "Vanilla", priceCents: 0 }, { name: "Chocolate", priceCents: 0 }, { name: "Red velvet", priceCents: 100 }, { name: "Strawberry", priceCents: 75 }, { name: "Lemon", priceCents: 50 }] },
  { key: "frosting", label: "Frosting", required: true, choices: [{ name: "Vanilla buttercream", priceCents: 0 }, { name: "Chocolate", priceCents: 0 }, { name: "Strawberry", priceCents: 50 }] },
  { key: "color", label: "Frosting colour", choices: [{ name: "Pastel pink", priceCents: 0 }, { name: "Cream", priceCents: 0 }, { name: "Rainbow", priceCents: 100 }] },
  { key: "decorations", label: "Decorations", multiple: true, choices: [{ name: "Sprinkles", priceCents: 50 }, { name: "Fresh berries", priceCents: 150 }, { name: "Cookie crumble", priceCents: 100 }] },
  { key: "packaging", label: "Packaging", choices: [{ name: "Standard box", priceCents: 0 }, { name: "Premium gift box", priceCents: 250 }] },
  { key: "message", label: "Celebration message", type: "text", maxLength: 80 }
];
const hotDogOptions = [
  { key: "sausage", label: "Sausage", required: true, choices: [{ name: "Classic", priceCents: 0 }, { name: "Chicken", priceCents: 100 }, { name: "Spicy", priceCents: 100 }] },
  { key: "bread", label: "Bread", choices: [{ name: "Classic bun", priceCents: 0 }, { name: "Soft roll", priceCents: 50 }] },
  { key: "toppings", label: "Toppings", multiple: true, choices: [{ name: "Onions", priceCents: 0 }, { name: "Relish", priceCents: 0 }, { name: "Crispy onions", priceCents: 75 }, { name: "Jalapeños", priceCents: 75 }] },
  { key: "sauce", label: "Sauce", choices: [{ name: "Ketchup", priceCents: 0 }, { name: "Mustard", priceCents: 0 }, { name: "Spicy sauce", priceCents: 50 }] },
  { key: "extras", label: "Extras", multiple: true, choices: [{ name: "Cheese", priceCents: 100 }, { name: "Extra sausage", priceCents: 250 }] }
];
const drinkOptions = [
  { key: "size", label: "Serving size", required: true, choices: [{ name: "Regular pouch", priceCents: 0 }, { name: "Large cup", priceCents: 150 }] },
  { key: "serving", label: "Serving", choices: [{ name: "Chilled", priceCents: 0 }, { name: "Party-ready pack", priceCents: 250 }] },
  { key: "label", label: "Custom event label", type: "text", maxLength: 60 }
];
const chickenOptions = [
  { key: "preparation", label: "Chicken preparation", required: true, choices: [{ name: "Crispy fried", priceCents: 0 }, { name: "Spicy fried", priceCents: 100 }, { name: "Grilled", priceCents: 200 }] },
  { key: "portion", label: "Chicken portion", choices: [{ name: "One piece", priceCents: 0 }, { name: "Two pieces", priceCents: 450 }] },
  { key: "sauce", label: "Sauce", choices: [{ name: "House sauce", priceCents: 0 }, { name: "Pepper sauce", priceCents: 50 }, { name: "Garlic dip", priceCents: 75 }] },
  { key: "side", label: "Side", choices: [{ name: "No extra side", priceCents: 0 }, { name: "Coleslaw", priceCents: 250 }, { name: "Plantain", priceCents: 300 }] }
];
const spaghettiOptions = [
  { key: "style", label: "Spaghetti style", required: true, choices: [{ name: "Jollof", priceCents: 0 }, { name: "Tomato", priceCents: 0 }, { name: "Special house style", priceCents: 200 }] },
  { key: "spice", label: "Spice level", choices: [{ name: "Mild", priceCents: 0 }, { name: "Medium", priceCents: 0 }, { name: "Hot", priceCents: 0 }] },
  { key: "chicken", label: "Chicken portion", choices: [{ name: "One piece", priceCents: 0 }, { name: "Two pieces", priceCents: 450 }] },
  { key: "side", label: "Side", choices: [{ name: "No extra side", priceCents: 0 }, { name: "Plantain", priceCents: 300 }, { name: "Coleslaw", priceCents: 250 }] }
];

const products = [
  { name: "Pistachio Cloud", slug: "pistachio-cloud", category: "ice-cream", description: "Pistachio gelato, toasted nuts, a little sea salt.", priceCents: 825, stock: 24, imageUrl: "/ice-cream/Pistachio%20Ice%20Cream%20Dessert%20Spread.png", featured: true },
  { name: "Strawberry Cream Scoop", slug: "strawberry-cream-scoop", category: "ice-cream", description: "Bright strawberry folded through soft, creamy ice cream.", priceCents: 695, stock: 24, imageUrl: "/ice-cream/Strawberry%20Ice%20Cream%20Bowl%20with%20Mint.png" },
  { name: "Colorful Sundae Bar", slug: "colorful-sundae-bar", category: "ice-cream", description: "Creamy scoops ready for a colorful selection of favorite toppings.", priceCents: 895, stock: 24, imageUrl: "/ice-cream/Colorful%20Sundae%20Topping%20Bar.png" },
  { name: "Classic Vanilla Cone", slug: "classic-vanilla-cone", category: "ice-cream-cones", description: "A crisp waffle cone piled with creamy vanilla soft serve.", priceCents: 690, stock: 24, imageUrl: "/ice-cream/Vanilla%20Soft-Serve%20Cone%20in%20Action.png", featured: true },
  { name: "Pistachio Gelato Cone", slug: "pistachio-gelato-cone", category: "ice-cream-cones", description: "Two generous scoops of pistachio gelato in a crisp waffle cone.", priceCents: 825, stock: 24, imageUrl: "/ice-cream/Chocolate-Draped%20Ice%20Cream%20Cone%20Delight.png", featured: true },
  { name: "Soft-Serve Cone Trio", slug: "soft-serve-cone-trio", category: "ice-cream-cones", description: "A colorful trio of vanilla, strawberry, and chocolate soft serve.", priceCents: 1095, stock: 18, imageUrl: "/images/Vanilla,%20Strawberry,%20and%20Chocolate%20Trio.png" },
  { name: "Chocolate Swirl Cones", slug: "chocolate-swirl-cones", category: "ice-cream-cones", description: "Creamy soft serve finished with a glossy chocolate swirl.", priceCents: 795, stock: 20, imageUrl: "/images/Glossy%20Trio%20of%20Soft-Serve%20Cones.png" },
  { name: "Strawberry Sunday", slug: "strawberry-sunday", category: "waffles", description: "Warm Belgian waffle, strawberries and vanilla cream.", priceCents: 1290, stock: 18, imageUrl: "https://images.unsplash.com/photo-1558584724-0e4d32ca55a4?auto=format&fit=crop&w=900&q=82", featured: true },
  { name: "Chocolate Dream Waffle", slug: "chocolate-dream-waffle", category: "waffles", description: "A golden Belgian waffle with dark chocolate and soft cream.", priceCents: 1390, stock: 14, imageUrl: "/krunchy/Chocolate%20Dream%20Waffle%20Slice.png", featured: true },
  { name: "Salted Caramel Popcorn", slug: "salted-caramel-popcorn", category: "popcorn", description: "Small-batch caramel, buttery crunch, flaky salt.", priceCents: 590, stock: 40, imageUrl: "/images/Caramel%20Popcorn%20Still%20Life.png", featured: true },
  { name: "Butter & Sea Salt Popcorn", slug: "butter-sea-salt-popcorn", category: "popcorn", description: "Fluffy kernels, good butter, and a pinch of sea salt.", priceCents: 490, stock: 32, imageUrl: "https://images.unsplash.com/photo-1585647347384-2593bc35786b?auto=format&fit=crop&w=900&q=82" },
  { name: "Movie Night Popcorn", slug: "movie-night-popcorn", category: "popcorn", description: "A generous tub of fresh popcorn for your favorite film.", priceCents: 690, stock: 30, imageUrl: "/krunchy/KrunchyKremmy%20Popcorn%20Bag%20Mockup.png", featured: true },
  { name: "The Pick ’n’ Mix", slug: "the-pick-n-mix", category: "candy", description: "A bright handful of chewy, tangy, happy things.", priceCents: 750, stock: 30, imageUrl: "https://images.unsplash.com/photo-1581798459219-318e76aecc7b?auto=format&fit=crop&w=900&q=82", featured: true },
  { name: "Fruit Chew Party", slug: "fruit-chew-party", category: "candy", description: "A pocket-sized mix of bright, fruity, chewy favorites.", priceCents: 525, stock: 36, imageUrl: "/ice-cream/KrunchyKremmy%20Ice%20Cream%20Cart.png", available: true },
  { name: "Rainbow Candy Mix", slug: "rainbow-candy-mix", category: "candy", description: "A colorful mix of sweet and tangy pick-and-mix treats.", priceCents: 795, stock: 30, imageUrl: "/images/Rainbow%20Sprinkles%20in%20Glass%20Bowl.png", featured: true },
  { name: "Classic Pink Cotton Candy", slug: "classic-pink-cotton-candy", category: "cotton-candy", description: "Cloud-soft pink cotton candy with a sweet, airy finish.", priceCents: 620, stock: 24, imageUrl: "/images/cotton-candy-2.png", featured: true },
  { name: "Blue & Pink Cotton Candy", slug: "blue-pink-cotton-candy", category: "cotton-candy", description: "A fluffy pastel pair of classic pink and blue raspberry.", priceCents: 720, stock: 24, imageUrl: "/images/cotton%20candy-1.png", featured: true },
  { name: "Chocolate Cupcake Box", slug: "chocolate-cupcake-box", category: "cupcakes", description: "Rich chocolate cupcakes with your choice of frosting and decorations. Please ask us to confirm allergens.", priceCents: 1750, stock: 40, imageUrl: "/images/ice-cream-cone-cupcakesf.jpg", customizationOptions: cupcakeOptions },
  { name: "Mixed-Flavour Cupcake Box", slug: "mixed-cupcake-box", category: "cupcakes", description: "A party-ready assortment of vanilla, chocolate, and strawberry cupcakes. Please ask us to confirm allergens.", priceCents: 2100, stock: 30, imageUrl: "/krunchy/Tropical%20Garden%20Cupcake%20Celebration.png", customizationOptions: cupcakeOptions },
  { name: "Classic Hot Dog", slug: "classic-hot-dog", category: "hot-dogs", description: "A freshly prepared hot dog with your choice of sausage, bread, and toppings.", priceCents: 850, stock: 50, imageUrl: "/krunchy/Golden%20Hot%20Dog%20Buffet%20Display.png", customizationOptions: hotDogOptions },
  { name: "Classic Chapman Pouch", slug: "classic-chapman-pouch", category: "drinks", description: "A bright, chilled Chapman-style refreshment. Ask us to confirm ingredients and allergens before ordering.", priceCents: 450, stock: 80, imageUrl: "/krunchy/KrunchyKremmy%20Orange%20Chapman.png", customizationOptions: drinkOptions },
  { name: "Tropical Fruit Drink", slug: "tropical-fruit-drink", category: "drinks", description: "A fruity tropical drink in a convenient pouch. Ingredients and allergens should be confirmed with the shop.", priceCents: 450, stock: 80, imageUrl: "/krunchy/Refreshing%20Citrus%20Punch%20with%20Ice%20and%20Fruit.png", customizationOptions: drinkOptions },
  { name: "Chapman Party Pack", slug: "chapman-party-pack", category: "drinks", description: "A multipack for small gatherings. Larger event quantities are available by quotation.", priceCents: 2400, stock: 24, imageUrl: "/krunchy/Refreshing%20Krunchykremmy%20Lemonade%20Pouches.png", featured: true, customizationOptions: drinkOptions },
  { name: "Classic Chicken & Chips", slug: "classic-chicken-and-chips", category: "chicken-and-chips", description: "A satisfying chicken and chips meal with your choice of preparation, sauce, and sides.", priceCents: 1850, stock: 40, imageUrl: "/krunchy/Golden%20Fries,%20Grilled%20Chicken,%20and%20Ketchup.png", customizationOptions: chickenOptions },
  { name: "Jollof Spaghetti & Chicken", slug: "jollof-spaghetti-and-chicken", category: "spaghetti-and-chicken", description: "A comforting jollof-style spaghetti meal served with chicken. Ask us to confirm ingredients and allergens.", priceCents: 2100, stock: 40, imageUrl: "/krunchy/Jollof%20Spaghetti%20with%20Charred%20Chicken.png", customizationOptions: spaghettiOptions },
];

const optionGroups = {
  waffle: {
    base: [["Belgian waffle", 790], ["Chocolate waffle", 890], ["Mini waffles", 650]],
    iceCream: [["Vanilla bean", 180], ["Pistachio", 220], ["Strawberry", 180], ["Dark chocolate", 200]],
    toppings: [["Fresh strawberries", 130], ["Brownie bites", 110], ["Toasted hazelnuts", 100], ["Cookie crumble", 90], ["Rainbow sprinkles", 70]],
    sauces: [["Dark chocolate", 75], ["Salted caramel", 75], ["Strawberry", 75], ["Cookie butter", 95]],
    extras: [["Whipped cream", 60], ["Extra scoop", 180]]
  },
  sundae: {
    base: [["Little cup", 490], ["Big bowl", 690], ["Share the love", 990]],
    iceCream: [["Vanilla bean", 160], ["Pistachio", 220], ["Strawberry", 160], ["Dark chocolate", 180]],
    toppings: [["Brownie bites", 110], ["Cookie crumble", 90], ["Toasted hazelnuts", 100], ["Fresh strawberries", 130]],
    sauces: [["Dark chocolate", 75], ["Salted caramel", 75], ["Strawberry", 75]]
  },
  candy: {
    base: [["Little pouch", 450], ["Share bag", 750], ["Party jar", 1100]],
    toppings: [["Sour belts", 100], ["Gummy bears", 100], ["Fruit chews", 100], ["Chocolate buttons", 125], ["Cola bottles", 100]]
  },
  popcorn: {
    base: [["Little bag", 390], ["Big bowl", 590], ["Movie-night tub", 890]],
    toppings: [["Sea salt", 0], ["Caramel drizzle", 90], ["Cheddar dust", 75], ["Chocolate chips", 110], ["Cinnamon sugar", 60]]
  }
};

const eventTypes = [
  ["Birthday celebrations", "birthdays", "Cakes optional, sweet moments guaranteed.", 1],
  ["Weddings", "weddings", "Dessert stations for the day you will always remember.", 2],
  ["Private parties", "private-parties", "Anniversaries, graduations, and get-togethers.", 3],
  ["Corporate events", "corporate", "A thoughtful treat for teams and clients.", 4],
  ["School & children's events", "school-events", "Colorful, crowd-pleasing treats for little celebrations.", 5],
  ["Baby & bridal showers", "showers", "A thoughtful dessert table for a lovely gathering.", 6],
  ["Festivals & community events", "community-events", "Crowd-pleasing treats for the whole neighborhood.", 7],
  ["Religious celebrations", "religious-celebrations", "Sweet stations for meaningful moments together.", 8],
  ["Other event", "other", "Tell us what you are celebrating.", 9]
];

const eventServices = [
  { name: "Ice cream catering", slug: "ice-cream-catering", description: "A scoop station with flavors, cones, cups, and sundae toppings.", imageUrl: "/images/Glossy%20Trio%20of%20Soft-Serve%20Cones.png", includes: ["Serving station", "Flavor selection", "Cups or cones", "Sundae toppings"], customizationOptions: { iceCreamFlavors: ["Vanilla bean", "Pistachio", "Strawberry", "Dark chocolate", "Salted caramel"], servingStyles: ["Cups", "Cones", "Sundae station"], sundaeToppings: ["Sprinkles", "Brownie bites", "Cookie crumble", "Fresh strawberries"] } },
  { name: "Candy buffet", slug: "candy-buffet", description: "A color-themed candy bar with gummy, sour, chocolate, and nostalgic favorites.", imageUrl: "https://images.unsplash.com/photo-1581798459219-318e76aecc7b?auto=format&fit=crop&w=900&q=82", includes: ["Color theme", "Candy selection", "Display jars", "Party favor options"], customizationOptions: { candyCategories: ["Gummy", "Sour", "Chocolate", "Retro"], colors: ["Blush", "Pastel", "Bright rainbow", "Chocolate & cream"], candySelections: ["Gummy bears", "Sour belts", "Chocolate buttons", "Fruit chews"] } },
  { name: "Popcorn catering", slug: "popcorn-catering", description: "Fresh popcorn with sweet and savory flavors, served your way.", imageUrl: "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=900&q=82", includes: ["Flavor selection", "Serving station", "Individual bags", "Sweet and savory options"], customizationOptions: { popcornFlavors: ["Butter & sea salt", "Caramel", "Cheddar", "Kettle corn", "Chocolate drizzle"], packaging: ["Served fresh", "Individual bags", "Popcorn bar"] } },
  { name: "Waffle station", slug: "waffle-station", description: "Warm waffles with ice cream, toppings, and sauces made for sharing.", imageUrl: "/krunchy/Golden%20Waffle%20Skewer%20Display.png", includes: ["Fresh waffle station", "Waffle style selection", "Toppings and sauces", "Ice cream pairing"], customizationOptions: { waffleTypes: ["Belgian waffles", "Mini waffles", "Waffle sticks"], toppings: ["Fresh strawberries", "Brownie bites", "Cookie crumble", "Toasted hazelnuts"], sauces: ["Dark chocolate", "Salted caramel", "Strawberry"], iceCreamFlavors: ["Vanilla bean", "Pistachio", "Strawberry"] } },
  { name: "Hot dog buffet", slug: "hot-dog-buffet", description: "A flexible hot dog buffet for birthdays, school events, weddings, and parties.", imageUrl: "/krunchy/Golden%20Hot%20Dog%20Buffet%20Display.png", includes: ["Hot dog menu selection", "Toppings and sauces", "Serving-style choices", "Staffing by quotation"], customizationOptions: { hotDogStyles: ["Classic", "Cheese", "Chicken sausage", "Spicy", "Loaded", "Premium"], sausageTypes: ["Beef", "Chicken", "Spicy"], breadTypes: ["Classic bun", "Soft roll"], toppings: ["Onions", "Relish", "Crispy onions", "Jalapeños"], sauces: ["Ketchup", "Mustard", "House sauce"], cheeseOptions: ["Cheddar", "No cheese"], packageSizes: ["Small party", "Medium party", "Large event", "Custom"], servingStyles: ["Self-serve buffet", "Staff-served"] } },
  { name: "Chapman & refreshments", slug: "chapman-and-refreshments", description: "Chapman, fruit drinks, and refreshing pouches for gatherings and events.", imageUrl: "/krunchy/KrunchyKremmy%20Orange%20Chapman.png", includes: ["Drink selections", "Pouch, cup, and party-pack options", "Chilled service requests", "Large-order quotation"], customizationOptions: { drinkFlavors: ["Classic Chapman", "Special Chapman", "Fruit punch", "Tropical fruit drink", "Signature refresher"], drinkPackaging: ["Individual pouches", "Cups", "Multipacks", "Bulk event order"], drinkServing: ["Chilled", "Room temperature"], packaging: ["Standard", "Event-themed labels"] } },
  { name: "Cupcake station", slug: "cupcake-station", description: "Custom cupcake flavors, frosting, and decorations for your celebration.", imageUrl: "/krunchy/Tropical%20Garden%20Cupcake%20Celebration.png", includes: ["Flavor selection", "Frosting and color choices", "Celebration decorations", "Custom-quantity quotation"], customizationOptions: { cupcakeFlavors: ["Vanilla", "Chocolate", "Red velvet", "Strawberry", "Lemon", "Cookies and cream", "Mixed"], frostingFlavors: ["Vanilla buttercream", "Chocolate", "Strawberry"], frostingColors: ["Pastel pink", "Cream", "Rainbow"], decorations: ["Sprinkles", "Fresh berries", "Cookie crumble"], packaging: ["Standard box", "Premium gift box"] } },
  { name: "Chicken & chips catering", slug: "chicken-and-chips-catering", description: "Chicken and chips packages for family gatherings, school events, and celebrations.", imageUrl: "/krunchy/Golden%20Fries,%20Grilled%20Chicken,%20and%20Ketchup.png", includes: ["Preparation-style selection", "Portion planning", "Sauces and sides", "Large-order quotation"], customizationOptions: { chickenStyles: ["Crispy fried", "Spicy fried", "Grilled"], portionSizes: ["Single meal", "Family pack", "Party tray"], chipPortions: ["Regular", "Large", "Sharing tray"], sauces: ["House sauce", "Pepper sauce", "Garlic dip"], sides: ["Coleslaw", "Plantain"], drinkAddOns: ["Chapman", "Fruit drink"] } },
  { name: "Spaghetti & chicken catering", slug: "spaghetti-and-chicken-catering", description: "Spaghetti and chicken meals or party trays, tailored to your guest count.", imageUrl: "/krunchy/Jollof%20Spaghetti%20with%20Charred%20Chicken.png", includes: ["Spaghetti-style selection", "Chicken portions", "Spice and side choices", "Event-tray quotation"], customizationOptions: { spaghettiStyles: ["Jollof", "Tomato", "Special house style"], chickenPortions: ["One piece", "Two pieces", "Sharing portions"], spiceLevels: ["Mild", "Medium", "Hot"], sides: ["Plantain", "Coleslaw"], drinkAddOns: ["Chapman", "Fruit drink"] } },
  { name: "Cotton candy station", slug: "cotton-candy-station", description: "Cloud-soft cotton candy in party colors, served as a station or individual favors.", imageUrl: "/krunchy/Sweet%20Cotton%20Candy%20Moment.png", includes: ["Flavor and color choices", "Party favor packaging", "Guest-count planning"], customizationOptions: { colors: ["Pink", "Blue", "Rainbow"], packaging: ["Individual bags", "Party favors", "Serving station"] } },
  { name: "Custom catering request", slug: "custom-catering", description: "Have a different idea? Share your vision and we will help shape a custom dessert setup.", imageUrl: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=82", includes: ["Custom setup ideas", "Personalized review", "A tailored quote"], customizationOptions: {} }
];

const eventPackages = [
  { name: "Sweet Mini Party", slug: "sweet-mini-party", description: "A cozy gathering with one treat station. Tell us your guest count and we will tailor a quote.", items: ["ice-cream-catering"] },
  { name: "Birthday Sweet Experience", slug: "birthday-sweet-experience", description: "A joyful mix of party favorites, tailored to your celebration.", items: ["ice-cream-catering", "candy-buffet", "popcorn-catering"] },
  { name: "Premium Celebration", slug: "premium-celebration", description: "A full dessert moment with multiple stations and thoughtful details.", items: ["ice-cream-catering", "candy-buffet", "popcorn-catering", "waffle-station"] },
  { name: "Corporate Sweet Experience", slug: "corporate-sweet-experience", description: "Flexible, polished dessert service for teams, clients, and company events.", items: ["ice-cream-catering", "popcorn-catering", "waffle-station"] },
  { name: "Complete Sweet Treats Package", slug: "complete-sweet-treats", description: "Ice cream, candy, popcorn, and waffles together in one celebration.", items: ["ice-cream-catering", "candy-buffet", "popcorn-catering", "waffle-station"] },
  { name: "Custom Event Package", slug: "custom-event-package", description: "A bespoke celebration package shaped around your event and ideas.", items: ["custom-catering"] },
  { name: "Hot Dog Party Buffet", slug: "hot-dog-party-buffet", description: "A hot dog buffet with drinks and optional extras, tailored to your guest count.", items: ["hot-dog-buffet", "chapman-and-refreshments"] },
  { name: "Food Catering Package", slug: "food-catering-package", description: "Chicken and chips, spaghetti and chicken, and refreshments for your gathering.", items: ["chicken-and-chips-catering", "spaghetti-and-chicken-catering", "chapman-and-refreshments"] },
  { name: "Birthday Treats Package", slug: "birthday-treats-package", description: "Cupcakes, Chapman, cotton candy, and ice cream for a joyful birthday.", items: ["cupcake-station", "chapman-and-refreshments", "ice-cream-catering", "cotton-candy-station"] },
  { name: "Kids' Party Package", slug: "kids-party-package", description: "A colorful mix of ice cream, popcorn, cupcakes, and cotton candy.", items: ["ice-cream-catering", "popcorn-catering", "cupcake-station", "cotton-candy-station"] }
];

async function main() {
  console.log("Loading development sample menu; these are not live business prices or inventory.");
  const categoryIds = new Map();
  for (const category of categories) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category
    });
    categoryIds.set(category.slug, saved.id);
  }
  for (const product of products) {
    const { category: categorySlug, ...data } = product;
    await prisma.product.upsert({
      where: { slug: data.slug },
      update: { ...data, categoryId: categoryIds.get(categorySlug) },
      create: { ...data, categoryId: categoryIds.get(categorySlug) }
    });
  }
  await prisma.product.updateMany({
    where: { slug: { in: ["vanilla-cupcake-box", "loaded-hot-dog", "family-chicken-and-chips", "tomato-spaghetti-and-chicken", "butter-sea-salt-popcorn"] } },
    data: { available: false }
  });
  await prisma.product.updateMany({
    where: { slug: "cotton-candy-party-pack" },
    data: { available: false }
  });
  for (const [kind, groups] of Object.entries(optionGroups)) {
    for (const [groupKey, options] of Object.entries(groups)) {
      for (const [index, [name, priceCents]] of options.entries()) {
        await prisma.builderOption.upsert({
          where: { kind_groupKey_name: { kind, groupKey, name } },
          update: { priceCents, active: true, maxSelections: groupKey === "iceCream" ? 2 : groupKey === "base" ? 1 : 5, stock: 9999 },
          create: { kind, groupKey, name, priceCents, active: true, maxSelections: groupKey === "iceCream" ? 2 : groupKey === "base" ? 1 : 5, stock: 9999 + index }
        });
      }
    }
  }
  const eventServiceIds = new Map();
  for (const [name, slug, description, sortOrder] of eventTypes) {
    await prisma.eventType.upsert({
      where: { slug },
      update: { name, description, sortOrder, active: true },
      create: { name, slug, description, sortOrder }
    });
  }
  for (const [index, service] of eventServices.entries()) {
    const saved = await prisma.eventService.upsert({
      where: { slug: service.slug },
      update: { ...service, sortOrder: index, active: true },
      create: { ...service, sortOrder: index }
    });
    eventServiceIds.set(service.slug, saved.id);
  }
  for (const [index, eventPackage] of eventPackages.entries()) {
    const { items, ...data } = eventPackage;
    await prisma.eventPackage.upsert({
      where: { slug: data.slug },
      update: {
        ...data,
        sortOrder: index,
        active: true,
        items: { deleteMany: {}, create: items.map((slug) => ({ serviceId: eventServiceIds.get(slug) })) }
      },
      create: {
        ...data,
        sortOrder: index,
        items: { create: items.map((slug) => ({ serviceId: eventServiceIds.get(slug) })) }
      }
    });
  }
}

main()
  .catch((error) => {
    console.error("Development seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
