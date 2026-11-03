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

export const developmentMenu = [
  {
    id: "pistachio-cloud",
    name: "Pistachio Cloud",
    category: "ice-cream",
    categoryName: "Ice Cream",
    description: "Pistachio gelato, toasted nuts, a little sea salt.",
    priceCents: 825,
    imageUrl: "/ice-cream/Pistachio%20Ice%20Cream%20Dessert%20Spread.png",
    badge: "A house favorite"
  },
  {
    id: "strawberry-cream-scoop",
    name: "Strawberry Cream Scoop",
    category: "ice-cream",
    categoryName: "Ice Cream",
    description: "Bright strawberry folded through soft, creamy ice cream.",
    priceCents: 695,
    imageUrl: "/ice-cream/Strawberry%20Ice%20Cream%20Bowl%20with%20Mint.png"
  },
  {
    id: "colorful-sundae-bar",
    name: "Colorful Sundae Bar",
    category: "ice-cream",
    categoryName: "Ice Cream",
    description: "Creamy scoops ready for a colorful selection of favorite toppings.",
    priceCents: 895,
    imageUrl: "/ice-cream/Colorful%20Sundae%20Topping%20Bar.png"
  },
  {
    id: "classic-cone",
    name: "Classic Vanilla Cone",
    category: "ice-cream-cones",
    categoryName: "Ice Cream Cones",
    description: "A crisp waffle cone piled with creamy vanilla soft serve.",
    priceCents: 690,
    imageUrl: "/ice-cream/Vanilla%20Soft-Serve%20Cone%20in%20Action.png",
    badge: "Freshly scooped"
  },
  {
    id: "pistachio-gelato-cone",
    name: "Pistachio Gelato Cone",
    category: "ice-cream-cones",
    categoryName: "Ice Cream Cones",
    description: "Two generous scoops of pistachio gelato in a crisp waffle cone.",
    priceCents: 825,
    imageUrl: "/ice-cream/Chocolate-Draped%20Ice%20Cream%20Cone%20Delight.png",
    badge: "A house favorite"
  },
  {
    id: "soft-serve-cone-trio",
    name: "Soft-Serve Cone Trio",
    category: "ice-cream-cones",
    categoryName: "Ice Cream Cones",
    description: "A colorful trio of vanilla, strawberry, and chocolate soft serve.",
    priceCents: 1095,
    imageUrl: "/images/Vanilla,%20Strawberry,%20and%20Chocolate%20Trio.png"
  },
  {
    id: "chocolate-swirl-cones",
    name: "Chocolate Swirl Cones",
    category: "ice-cream-cones",
    categoryName: "Ice Cream Cones",
    description: "Creamy soft serve finished with a glossy chocolate swirl.",
    priceCents: 795,
    imageUrl: "/images/Glossy%20Trio%20of%20Soft-Serve%20Cones.png"
  },
  {
    id: "strawberry-waffle",
    name: "Strawberry Sunday",
    category: "waffles",
    categoryName: "Waffles",
    description: "Warm Belgian waffle, strawberries and vanilla cream.",
    priceCents: 1290,
    imageUrl: "https://images.unsplash.com/photo-1558584724-0e4d32ca55a4?auto=format&fit=crop&w=900&q=82",
    badge: "Made to order"
  },
  {
    id: "chocolate-dream-waffle",
    name: "Chocolate Dream Waffle",
    category: "waffles",
    categoryName: "Waffles",
    description: "A golden Belgian waffle with dark chocolate and soft cream.",
    priceCents: 1390,
    imageUrl: "/krunchy/Chocolate%20Dream%20Waffle%20Slice.png",
    badge: "Made to order"
  },
  {
    id: "caramel-popcorn",
    name: "Salted Caramel Popcorn",
    category: "popcorn",
    categoryName: "Popcorn",
    description: "Small-batch caramel, buttery crunch, flaky salt.",
    priceCents: 590,
    imageUrl: "/images/Caramel%20Popcorn%20Still%20Life.png",
    badge: "Small batch"
  },
  {
    id: "movie-night-popcorn",
    name: "Movie Night Popcorn",
    category: "popcorn",
    categoryName: "Popcorn",
    description: "A generous tub of fresh popcorn for your favorite film.",
    priceCents: 690,
    imageUrl: "/krunchy/KrunchyKremmy%20Popcorn%20Bag%20Mockup.png",
    badge: "Shareable"
  },
  {
    id: "candy-mix",
    name: "The Pick ’n’ Mix",
    category: "candy",
    categoryName: "Candy",
    description: "A bright handful of chewy, tangy, happy things.",
    priceCents: 750,
    imageUrl: "https://images.unsplash.com/photo-1581798459219-318e76aecc7b?auto=format&fit=crop&w=900&q=82",
    badge: "Make it yours"
  },
  {
    id: "fruit-chew-party",
    name: "Fruit Chew Party",
    category: "candy",
    categoryName: "Candy",
    description: "A pocket-sized mix of bright, fruity, chewy favorites.",
    priceCents: 525,
    imageUrl: "/ice-cream/KrunchyKremmy%20Ice%20Cream%20Cart.png"
  },
  {
    id: "rainbow-candy-mix",
    name: "Rainbow Candy Mix",
    category: "candy",
    categoryName: "Candy",
    description: "A colorful mix of sweet and tangy pick-and-mix treats.",
    priceCents: 795,
    imageUrl: "/images/Rainbow%20Sprinkles%20in%20Glass%20Bowl.png",
    badge: "Make it yours"
  },
  {
    id: "pink-cotton-candy",
    name: "Classic Pink Cotton Candy",
    category: "cotton-candy",
    categoryName: "Cotton Candy",
    description: "Cloud-soft pink cotton candy with a sweet, airy finish.",
    priceCents: 620,
    imageUrl: "/images/cotton-candy-2.png",
    badge: "Light as a cloud"
  },
  {
    id: "blue-pink-cotton-candy",
    name: "Blue & Pink Cotton Candy",
    category: "cotton-candy",
    categoryName: "Cotton Candy",
    description: "A fluffy pastel pair of classic pink and blue raspberry.",
    priceCents: 720,
    imageUrl: "/images/cotton%20candy-1.png",
    badge: "A little color"
  },
  {
    id: "chocolate-cupcake-box",
    name: "Chocolate Cupcake Box",
    category: "cupcakes",
    categoryName: "Cupcakes",
    description: "Rich chocolate cupcakes with your choice of frosting and decorations. Please ask us to confirm allergens.",
    priceCents: 1750,
    imageUrl: "/images/ice-cream-cone-cupcakesf.jpg",
    customizationOptions: cupcakeOptions
  },
  {
    id: "mixed-cupcake-box",
    name: "Mixed-Flavour Cupcake Box",
    category: "cupcakes",
    categoryName: "Cupcakes",
    description: "A party-ready assortment of vanilla, chocolate, and strawberry cupcakes. Please ask us to confirm allergens.",
    priceCents: 2100,
    imageUrl: "/krunchy/Tropical%20Garden%20Cupcake%20Celebration.png",
    customizationOptions: cupcakeOptions
  },
  {
    id: "classic-hot-dog",
    name: "Classic Hot Dog",
    category: "hot-dogs",
    categoryName: "Hot Dogs & Buffet",
    description: "A freshly prepared hot dog with your choice of sausage, bread, and toppings.",
    priceCents: 850,
    imageUrl: "/krunchy/Golden%20Hot%20Dog%20Buffet%20Display.png",
    customizationOptions: hotDogOptions
  },
  {
    id: "classic-chapman-pouch",
    name: "Classic Chapman Pouch",
    category: "drinks",
    categoryName: "Refreshing KrunchyKremmy Drinks",
    description: "A bright, chilled Chapman-style refreshment. Ask us to confirm ingredients and allergens before ordering.",
    priceCents: 450,
    imageUrl: "/krunchy/KrunchyKremmy%20Orange%20Chapman.png",
    customizationOptions: drinkOptions
  },
  {
    id: "tropical-fruit-drink",
    name: "Tropical Fruit Drink",
    category: "drinks",
    categoryName: "Refreshing KrunchyKremmy Drinks",
    description: "A fruity tropical drink in a convenient pouch. Ingredients and allergens should be confirmed with the shop.",
    priceCents: 450,
    imageUrl: "/krunchy/Refreshing%20Citrus%20Punch%20with%20Ice%20and%20Fruit.png",
    customizationOptions: drinkOptions
  },
  {
    id: "chapman-party-pack",
    name: "Chapman Party Pack",
    category: "drinks",
    categoryName: "Refreshing KrunchyKremmy Drinks",
    description: "A multipack for small gatherings. Larger event quantities are available by quotation.",
    priceCents: 2400,
    imageUrl: "/krunchy/Refreshing%20Krunchykremmy%20Lemonade%20Pouches.png",
    badge: "Party-ready",
    customizationOptions: drinkOptions
  },
  {
    id: "classic-chicken-and-chips",
    name: "Classic Chicken & Chips",
    category: "chicken-and-chips",
    categoryName: "Chicken & Chips",
    description: "A satisfying chicken and chips meal with your choice of preparation, sauce, and sides.",
    priceCents: 1850,
    imageUrl: "/krunchy/Golden%20Fries,%20Grilled%20Chicken,%20and%20Ketchup.png",
    customizationOptions: chickenOptions
  },
  {
    id: "jollof-spaghetti-and-chicken",
    name: "Jollof Spaghetti & Chicken",
    category: "spaghetti-and-chicken",
    categoryName: "Spaghetti & Chicken",
    description: "A comforting jollof-style spaghetti meal served with chicken. Ask us to confirm ingredients and allergens.",
    priceCents: 2100,
    imageUrl: "/krunchy/Jollof%20Spaghetti%20with%20Charred%20Chicken.png",
    customizationOptions: spaghettiOptions
  },
];

export const categories = [
  {
    slug: "ice-cream",
    name: "Ice cream",
    description: "Slow-churned scoops for the long way home.",
    imageUrl: "/ice-cream/Pastel%20Ice%20Cream%20Cart%20in%20the%20Park.png",
    className: "category-tall"
  },
  {
    slug: "ice-cream-cones",
    name: "Ice cream cones",
    description: "Classic cones, mixed scoops, and sweet little extras.",
    imageUrl: "/images/ice-cream-cone-cupcakesf.jpg",
    className: ""
  },
  {
    slug: "waffles",
    name: "Waffles",
    description: "Warm, golden, and entirely your own.",
    imageUrl: "/krunchy/Golden%20Waffle%20Skewer%20Display.png",
    className: ""
  },
  {
    slug: "candy",
    name: "Candy",
    description: "A little color for the everyday.",
    imageUrl: "https://images.unsplash.com/photo-1581798459219-318e76aecc7b?auto=format&fit=crop&w=1100&q=84",
    className: ""
  },
  {
    slug: "cotton-candy",
    name: "Cotton candy",
    description: "Cloud-soft sweetness in bright pastel colors.",
    imageUrl: "/images/cotton-candy-2.png",
    className: ""
  },
  {
    slug: "popcorn",
    name: "Popcorn",
    description: "The very best seat-in-the-house snack.",
    imageUrl: "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=1100&q=84",
    className: ""
  },
  {
    slug: "cupcakes",
    name: "Cupcakes",
    description: "Little cakes made for lovely occasions.",
    imageUrl: "/krunchy/Tropical%20Garden%20Cupcake%20Celebration.png",
    className: ""
  },
  {
    slug: "hot-dogs",
    name: "Hot Dogs & Buffet",
    description: "Hot dogs and tailored buffet requests for your gathering.",
    imageUrl: "/krunchy/Golden%20Hot%20Dog%20Buffet%20Display.png",
    className: ""
  },
  {
    slug: "chicken-and-chips",
    name: "Chicken & Chips",
    description: "Comforting meals for everyday orders and event catering.",
    imageUrl: "/krunchy/Golden%20Fries,%20Grilled%20Chicken,%20and%20Ketchup.png",
    className: ""
  },
  {
    slug: "spaghetti-and-chicken",
    name: "Spaghetti & Chicken",
    description: "Warm, satisfying plates and shareable event trays.",
    imageUrl: "/krunchy/Jollof%20Spaghetti%20with%20Charred%20Chicken.png",
    className: ""
  },
  {
    slug: "drinks",
    name: "Refreshing KrunchyKremmy Drinks",
    description: "Refreshing pouches and party drinks, made to order.",
    imageUrl: "/krunchy/KrunchyKremmy%20Orange%20Chapman.png",
    className: ""
  }
];
