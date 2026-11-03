import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clock3, MapPin, PartyPopper, Sparkles, X } from "lucide-react";

const sampleEvents = {
  eventTypes: [
    { id: "sample-birthday", name: "Birthday celebrations", slug: "birthdays", description: "Make their day delicious." },
    { id: "sample-wedding", name: "Weddings", slug: "weddings", description: "A sweet detail for your big day." },
    { id: "sample-party", name: "Private parties", slug: "private-parties", description: "Anniversaries, graduations, and get-togethers." },
    { id: "sample-corporate", name: "Corporate events", slug: "corporate", description: "A little something for the whole team." },
    { id: "sample-school", name: "School & children's events", slug: "school-events", description: "Colorful treats for little celebrations." },
    { id: "sample-showers", name: "Baby & bridal showers", slug: "showers", description: "A thoughtful dessert table for a lovely gathering." },
    { id: "sample-community", name: "Festivals & community events", slug: "community-events", description: "Crowd-pleasing treats for the whole neighborhood." },
    { id: "sample-religious", name: "Religious celebrations", slug: "religious-celebrations", description: "Sweet stations for meaningful moments together." },
    { id: "sample-other", name: "Other event", slug: "other", description: "Tell us what you are celebrating." }
  ],
  services: [
    { id: "sample-ice-cream", slug: "ice-cream-catering", name: "Ice cream catering", description: "A scoop station with flavors, cones, cups, and sundae toppings.", imageUrl: "/images/Glossy%20Trio%20of%20Soft-Serve%20Cones.png", includes: ["Serving station", "Flavor selection", "Cups or cones", "Sundae toppings"], customizationOptions: { iceCreamFlavors: ["Vanilla bean", "Pistachio", "Strawberry", "Dark chocolate", "Salted caramel"], servingStyles: ["Cups", "Cones", "Sundae station"], sundaeToppings: ["Sprinkles", "Brownie bites", "Cookie crumble", "Fresh strawberries"] } },
    { id: "sample-candy", slug: "candy-buffet", name: "Candy buffet", description: "A color-themed candy bar with gummy, sour, chocolate, and nostalgic favorites.", imageUrl: "https://images.unsplash.com/photo-1581798459219-318e76aecc7b?auto=format&fit=crop&w=900&q=82", includes: ["Color theme", "Candy selection", "Display jars", "Party favor options"], customizationOptions: { candyCategories: ["Gummy", "Sour", "Chocolate", "Retro"], colors: ["Blush", "Pastel", "Bright rainbow", "Chocolate & cream"], candySelections: ["Gummy bears", "Sour belts", "Chocolate buttons", "Fruit chews"] } },
    { id: "sample-popcorn", slug: "popcorn-catering", name: "Popcorn catering", description: "Fresh popcorn with sweet and savory flavors, served your way.", imageUrl: "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=900&q=82", includes: ["Flavor selection", "Serving station", "Individual bags", "Sweet and savory options"], customizationOptions: { popcornFlavors: ["Butter & sea salt", "Caramel", "Cheddar", "Kettle corn", "Chocolate drizzle"], packaging: ["Served fresh", "Individual bags", "Popcorn bar"] } },
    { id: "sample-waffle", slug: "waffle-station", name: "Waffle station", description: "Warm waffles with ice cream, toppings, and sauces made for sharing.", imageUrl: "/krunchy/Golden%20Waffle%20Skewer%20Display.png", includes: ["Fresh waffle station", "Waffle style selection", "Toppings and sauces", "Ice cream pairing"], customizationOptions: { waffleTypes: ["Belgian waffles", "Mini waffles", "Waffle sticks"], toppings: ["Fresh strawberries", "Brownie bites", "Cookie crumble", "Toasted hazelnuts"], sauces: ["Dark chocolate", "Salted caramel", "Strawberry"], iceCreamFlavors: ["Vanilla bean", "Pistachio", "Strawberry"] } },
    { id: "sample-hot-dogs", slug: "hot-dog-buffet", name: "Hot dog buffet", description: "A flexible hot dog buffet for birthdays, school events, weddings, and parties.", imageUrl: "/krunchy/Golden%20Hot%20Dog%20Buffet%20Display.png", includes: ["Hot dog menu selection", "Toppings and sauces", "Serving-style choices", "Staffing by quotation"], customizationOptions: { hotDogStyles: ["Classic", "Cheese", "Chicken sausage", "Spicy", "Loaded", "Premium"], sausageTypes: ["Beef", "Chicken", "Spicy"], breadTypes: ["Classic bun", "Soft roll"], toppings: ["Onions", "Relish", "Crispy onions", "Jalapeños"], sauces: ["Ketchup", "Mustard", "House sauce"], cheeseOptions: ["Cheddar", "No cheese"], packageSizes: ["Small party", "Medium party", "Large event", "Custom"], servingStyles: ["Self-serve buffet", "Staff-served"] } },
    { id: "sample-drinks", slug: "chapman-and-refreshments", name: "Chapman & refreshments", description: "Chapman, fruit drinks, and refreshing pouches for gatherings and events.", imageUrl: "/krunchy/KrunchyKremmy%20Orange%20Chapman.png", includes: ["Drink selections", "Pouch, cup, and party-pack options", "Chilled service requests", "Large-order quotation"], customizationOptions: { drinkFlavors: ["Classic Chapman", "Special Chapman", "Fruit punch", "Tropical fruit drink", "Signature refresher"], drinkPackaging: ["Individual pouches", "Cups", "Multipacks", "Bulk event order"], drinkServing: ["Chilled", "Room temperature"], packaging: ["Standard", "Event-themed labels"] } },
    { id: "sample-cupcakes", slug: "cupcake-station", name: "Cupcake station", description: "Custom cupcake flavours, frosting, and decorations for your celebration.", imageUrl: "/krunchy/Tropical%20Garden%20Cupcake%20Celebration.png", includes: ["Flavor selection", "Frosting and color choices", "Celebration decorations", "Custom-quantity quotation"], customizationOptions: { cupcakeFlavors: ["Vanilla", "Chocolate", "Red velvet", "Strawberry", "Lemon", "Cookies and cream", "Mixed"], frostingFlavors: ["Vanilla buttercream", "Chocolate", "Strawberry"], frostingColors: ["Pastel pink", "Cream", "Rainbow"], decorations: ["Sprinkles", "Fresh berries", "Cookie crumble"], packaging: ["Standard box", "Premium gift box"] } },
    { id: "sample-chicken", slug: "chicken-and-chips-catering", name: "Chicken & chips catering", description: "Chicken and chips packages for family gatherings, school events, and celebrations.", imageUrl: "/krunchy/Golden%20Fries,%20Grilled%20Chicken,%20and%20Ketchup.png", includes: ["Preparation-style selection", "Portion planning", "Sauces and sides", "Large-order quotation"], customizationOptions: { chickenStyles: ["Crispy fried", "Spicy fried", "Grilled"], portionSizes: ["Single meal", "Family pack", "Party tray"], chipPortions: ["Regular", "Large", "Sharing tray"], sauces: ["House sauce", "Pepper sauce", "Garlic dip"], sides: ["Coleslaw", "Plantain"], drinkAddOns: ["Chapman", "Fruit drink"] } },
    { id: "sample-spaghetti", slug: "spaghetti-and-chicken-catering", name: "Spaghetti & chicken catering", description: "Spaghetti and chicken meals or party trays, tailored to your guest count.", imageUrl: "/krunchy/Jollof%20Spaghetti%20with%20Charred%20Chicken.png", includes: ["Spaghetti-style selection", "Chicken portions", "Spice and side choices", "Event-tray quotation"], customizationOptions: { spaghettiStyles: ["Jollof", "Tomato", "Special house style"], chickenPortions: ["One piece", "Two pieces", "Sharing portions"], spiceLevels: ["Mild", "Medium", "Hot"], sides: ["Plantain", "Coleslaw"], drinkAddOns: ["Chapman", "Fruit drink"] } },
    { id: "sample-cotton-candy", slug: "cotton-candy-station", name: "Cotton candy station", description: "Cloud-soft cotton candy in party colors, served as a station or individual favors.", imageUrl: "/krunchy/Sweet%20Cotton%20Candy%20Moment.png", includes: ["Flavor and color choices", "Party favor packaging", "Guest-count planning"], customizationOptions: { colors: ["Pink", "Blue", "Rainbow"], packaging: ["Individual bags", "Party favors", "Serving station"] } },
    { id: "sample-custom", slug: "custom-catering", name: "Custom catering request", description: "Have a different idea? Share your vision and we will help shape a custom dessert setup.", imageUrl: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=82", includes: ["Custom setup ideas", "Personalized review", "A tailored quote"], customizationOptions: {} }
  ],
  packages: [
    { id: "sample-mini", slug: "sweet-mini-party", name: "Sweet Mini Party", description: "One treat station, thoughtfully tailored to your guest list.", priceMode: "QUOTE", minimumGuests: 1, items: [{ service: { id: "sample-ice-cream", slug: "ice-cream-catering", name: "Ice cream catering" } }] },
    { id: "sample-birthday", slug: "birthday-sweet-experience", name: "Birthday Sweet Experience", description: "A joyful mix of party favorites, tailored to your celebration.", priceMode: "QUOTE", minimumGuests: 1, items: [{ service: { id: "sample-ice-cream", slug: "ice-cream-catering", name: "Ice cream catering" } }, { service: { id: "sample-candy", slug: "candy-buffet", name: "Candy buffet" } }, { service: { id: "sample-popcorn", slug: "popcorn-catering", name: "Popcorn catering" } }] },
    { id: "sample-premium", slug: "premium-celebration", name: "Premium Celebration", description: "A full dessert moment with multiple stations and thoughtful details.", priceMode: "QUOTE", minimumGuests: 1, items: [{ service: { id: "sample-ice-cream", slug: "ice-cream-catering", name: "Ice cream catering" } }, { service: { id: "sample-candy", slug: "candy-buffet", name: "Candy buffet" } }, { service: { id: "sample-popcorn", slug: "popcorn-catering", name: "Popcorn catering" } }, { service: { id: "sample-waffle", slug: "waffle-station", name: "Waffle station" } }] },
    { id: "sample-corporate-package", slug: "corporate-sweet-experience", name: "Corporate Sweet Experience", description: "Flexible, polished dessert service for teams, clients, and company events.", priceMode: "QUOTE", minimumGuests: 1, items: [{ service: { id: "sample-ice-cream", slug: "ice-cream-catering", name: "Ice cream catering" } }, { service: { id: "sample-popcorn", slug: "popcorn-catering", name: "Popcorn catering" } }, { service: { id: "sample-waffle", slug: "waffle-station", name: "Waffle station" } }] },
    { id: "sample-complete", slug: "complete-sweet-treats", name: "Complete Sweet Treats Package", description: "Ice cream, candy, popcorn, and waffles together in one celebration.", priceMode: "QUOTE", minimumGuests: 1, items: [{ service: { id: "sample-ice-cream", slug: "ice-cream-catering", name: "Ice cream catering" } }, { service: { id: "sample-candy", slug: "candy-buffet", name: "Candy buffet" } }, { service: { id: "sample-popcorn", slug: "popcorn-catering", name: "Popcorn catering" } }, { service: { id: "sample-waffle", slug: "waffle-station", name: "Waffle station" } }] },
    { id: "sample-custom-package", slug: "custom-event-package", name: "Custom Event Package", description: "A bespoke celebration package shaped around your event and ideas.", priceMode: "QUOTE", minimumGuests: 1, items: [{ service: { id: "sample-custom", slug: "custom-catering", name: "Custom catering request" } }] },
    { id: "sample-hotdog-package", slug: "hot-dog-party-buffet", name: "Hot Dog Party Buffet", description: "A hot dog buffet with drinks and optional extras, tailored to your guest count.", priceMode: "QUOTE", minimumGuests: 1, items: [{ service: { id: "sample-hot-dogs", slug: "hot-dog-buffet", name: "Hot dog buffet" } }, { service: { id: "sample-drinks", slug: "chapman-and-refreshments", name: "Chapman & refreshments" } }] },
    { id: "sample-food-package", slug: "food-catering-package", name: "Food Catering Package", description: "Chicken and chips, spaghetti and chicken, and refreshments for your gathering.", priceMode: "QUOTE", minimumGuests: 1, items: [{ service: { id: "sample-chicken", slug: "chicken-and-chips-catering", name: "Chicken & chips catering" } }, { service: { id: "sample-spaghetti", slug: "spaghetti-and-chicken-catering", name: "Spaghetti & chicken catering" } }, { service: { id: "sample-drinks", slug: "chapman-and-refreshments", name: "Chapman & refreshments" } }] },
    { id: "sample-cupcake-party", slug: "birthday-treats-package", name: "Birthday Treats Package", description: "Cupcakes, Chapman, cotton candy, and ice cream for a joyful birthday.", priceMode: "QUOTE", minimumGuests: 1, items: [{ service: { id: "sample-cupcakes", slug: "cupcake-station", name: "Cupcake station" } }, { service: { id: "sample-drinks", slug: "chapman-and-refreshments", name: "Chapman & refreshments" } }, { service: { id: "sample-ice-cream", slug: "ice-cream-catering", name: "Ice cream catering" } }, { service: { id: "sample-cotton-candy", slug: "cotton-candy-station", name: "Cotton candy station" } }] },
    { id: "sample-kids-package", slug: "kids-party-package", name: "Kids' Party Package", description: "A colorful mix of ice cream, popcorn, cupcakes, and cotton candy.", priceMode: "QUOTE", minimumGuests: 1, items: [{ service: { id: "sample-ice-cream", slug: "ice-cream-catering", name: "Ice cream catering" } }, { service: { id: "sample-popcorn", slug: "popcorn-catering", name: "Popcorn catering" } }, { service: { id: "sample-cupcakes", slug: "cupcake-station", name: "Cupcake station" } }, { service: { id: "sample-cotton-candy", slug: "cotton-candy-station", name: "Cotton candy station" } }] }
  ]
};

const steps = ["Your event", "The good stuff", "Make it yours", "The details", "Review"];
const serviceGroups = {
  "ice-cream-catering": [["iceCreamFlavors", "Ice cream flavors", true], ["servingStyles", "Serving style", false], ["sundaeToppings", "Sundae toppings", true]],
  "candy-buffet": [["candyCategories", "Candy categories", true], ["candySelections", "Favorite candies", true], ["colors", "Color theme", false]],
  "popcorn-catering": [["popcornFlavors", "Popcorn flavors", true], ["packaging", "Serving style", false]],
  "waffle-station": [["waffleTypes", "Waffle types", true], ["iceCreamFlavors", "Ice cream flavors", true], ["toppings", "Toppings", true], ["sauces", "Sauces", true]]
  ,"hot-dog-buffet": [["hotDogStyles", "Hot dog styles", true], ["sausageTypes", "Sausage types", true], ["breadTypes", "Bread", false], ["toppings", "Toppings", true], ["sauces", "Sauces", true], ["cheeseOptions", "Cheese", false], ["packageSizes", "Package size", false], ["servingStyles", "Serving style", false]],
  "chapman-and-refreshments": [["drinkFlavors", "Drink flavors", true], ["drinkPackaging", "Packaging", true], ["drinkServing", "Serving temperature", false], ["packaging", "Custom labels", false]],
  "cupcake-station": [["cupcakeFlavors", "Cupcake flavors", true], ["frostingFlavors", "Frosting", true], ["frostingColors", "Frosting color", false], ["decorations", "Decorations", true], ["packaging", "Packaging", false]],
  "chicken-and-chips-catering": [["chickenStyles", "Chicken preparation", true], ["portionSizes", "Portion size", false], ["chipPortions", "Chips portion", false], ["sauces", "Sauces", true], ["sides", "Sides", true], ["drinkAddOns", "Drink add-ons", true]],
  "spaghetti-and-chicken-catering": [["spaghettiStyles", "Spaghetti style", true], ["chickenPortions", "Chicken portion", false], ["spiceLevels", "Spice level", false], ["sides", "Sides", true], ["drinkAddOns", "Drink add-ons", true]],
  "cotton-candy-station": [["colors", "Colors", true], ["packaging", "Packaging", true]]
};

const emptyCustomization = () => ({ needsAssistance: false });
const imageSource = (url) => url.replaceAll("%2C", ",");
const getLocalDateTime = (offsetDays = 30, hourOffset = 0) => {
  const date = new Date(Date.now() + offsetDays * 86400000 + hourOffset * 3600000);
  date.setMinutes(0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

function timeAsIso(value) {
  return value ? new Date(value).toISOString() : "";
}

export function EventsSection({ onBook }) {
  const [catalog, setCatalog] = useState(sampleEvents);
  const [isSample, setIsSample] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/events")
      .then((response) => {
        if (!response.ok) throw new Error("Event menu is unavailable.");
        return response.json();
      })
      .then((data) => {
        if (active && Array.isArray(data.services) && data.services.length) {
          setCatalog(data);
          setIsSample(false);
        }
      })
      .catch(() => {
        if (active) setIsSample(true);
      });
    return () => { active = false; };
  }, []);

  return (
    <section className="events-section" id="events">
      <div className="events-hero">
        <img src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1800&q=86" alt="A warmly decorated celebration ready for guests" loading="lazy" />
        <div className="events-hero-scrim" />
        <div className="events-hero-content">
          <p className="eyebrow"><span className="eyebrow-mark">✳</span> The good stuff, together</p>
          <h2>Make every celebration<br />a little <em>sweeter.</em></h2>
          <p>From birthdays to big-day celebrations, we bring sweet treats, hot food, and refreshing drinks to your special occasion.</p>
          <div className="events-hero-actions"><button className="button button-dark" onClick={onBook}>Tell us about your event <ArrowRight size={17} /></button><a href="#event-packages" className="text-link">Explore the packages <ArrowRight size={15} /></a></div>
        </div>
        <span className="events-hero-note">YOUR DAY, WITH A LITTLE EXTRA</span>
      </div>
      <div className="events-intro section-wrap">
        <div><p className="eyebrow">Good company. Great dessert.</p><h2>Every kind of day<br />deserves a <em>sweet table.</em></h2></div>
        <p>Ice cream stations, color-themed candy buffets, fresh popcorn, golden waffles—or a little of everything. Tell us what you are celebrating and we will help you dream up the details.</p>
      </div>
      <div className="event-service-grid section-wrap">
        {catalog.services.map((service, index) => (
          <article className="event-service-card" key={service.id}>
            <div className="event-service-image">            <img src={imageSource(service.imageUrl)} alt="" loading="lazy" /><span>0{index + 1} / MADE FOR SHARING</span></div>
            <div className="event-service-copy"><h3>{service.name}</h3><p>{service.description}</p><button className="text-link" onClick={onBook}>Make it part of your day <ArrowRight size={15} /></button></div>
          </article>
        ))}
      </div>
      <div className="event-packages section-wrap" id="event-packages">
        <div className="section-heading"><div><p className="eyebrow">A place to start</p><h2>A few ways to make it <em>sweet.</em></h2></div><p className="section-intro">Every celebration is different.<br />Packages are a starting point, not a set menu.</p></div>
        <div className="event-package-grid">
          {catalog.packages.map((eventPackage) => (
            <article className="event-package-card" key={eventPackage.id}>
              <span className="package-flower">✳</span><p className="eyebrow">MADE AROUND YOU</p><h3>{eventPackage.name}</h3><p className="package-description">{eventPackage.description}</p>
              <div className="package-services">{eventPackage.items.map(({ service }) => <span key={service.id}><Check size={13} />{service.name}</span>)}</div>
              <div className="package-price"><span>Pricing</span><strong>Request a quote</strong></div>
              <button className="button button-outline" onClick={() => onBook(eventPackage)}>Ask about this package <ArrowRight size={16} /></button>
            </article>
          ))}
        </div>
        <p className="event-menu-note">{isSample ? "Preview event menu — these sample offerings are not confirmed availability or prices." : "Package pricing is provided after we review your event details."}</p>
      </div>
      <div className="event-cta section-wrap"><Sparkles size={20} /><p>A different kind of celebration?</p><button className="text-link" onClick={onBook}>Tell us what you are dreaming up <ArrowRight size={15} /></button></div>
    </section>
  );
}

export function EventBookingWizard({ initialPackage, onClose, onSubmitted }) {
  const [catalog, setCatalog] = useState(sampleEvents);
  const [catalogReady, setCatalogReady] = useState(false);
  const [step, setStep] = useState(0);
  const [booking, setBooking] = useState(() => ({
    eventTypeSlug: "birthdays", eventName: "", otherEventType: "",
    startsLocal: getLocalDateTime(30), endsLocal: getLocalDateTime(30, 2),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    guestCount: 30, ageGroup: "", packageId: initialPackage?.id || "",
    services: [], venueName: "", venueType: "EVENT_HALL", address: "", city: "",
    region: "", postalCode: "", setupType: "UNSURE", accessInstructions: "",
    customerName: "", customerEmail: "", customerPhone: "", contactMethod: "EMAIL",
    companyName: "", specialRequests: "", budgetRange: "", termsAccepted: false, honeypot: ""
  }));
  const [availability, setAvailability] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    let active = true;
    fetch("/api/events")
      .then((response) => {
        if (!response.ok) throw new Error("Could not load event options.");
        return response.json();
      })
      .then((data) => {
        if (!active || !Array.isArray(data.services)) return;
        setCatalog(data);
        setCatalogReady(true);
        if (initialPackage?.id) {
          const found = data.packages.find((item) => item.id === initialPackage.id || item.slug === initialPackage.slug);
          if (found) {
            setBooking((current) => ({
              ...current,
              packageId: found.id,
              services: found.items.map(({ service }) => ({
                serviceId: service.id, servings: current.guestCount, customization: emptyCustomization()
              }))
            }));
          }
        }
      })
      .catch(() => {
        if (!active) return;
        setCatalogReady(false);
        if (initialPackage?.slug) {
          const found = sampleEvents.packages.find((item) => item.slug === initialPackage.slug);
          if (found) {
            setBooking((current) => ({
              ...current,
              packageId: found.id,
              services: found.items.map(({ service }) => ({
                serviceId: service.id, servings: current.guestCount, customization: emptyCustomization()
              }))
            }));
          }
        }
      });
    return () => { active = false; };
  }, [initialPackage]);

  useEffect(() => {
    const startsAt = timeAsIso(booking.startsLocal);
    const endsAt = timeAsIso(booking.endsLocal);
    if (!startsAt || !endsAt || new Date(startsAt) <= new Date() || new Date(endsAt) <= new Date(startsAt)) {
      setAvailability(null);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const params = new URLSearchParams({ startsAt, endsAt, timeZone: booking.timeZone });
    fetch(`/api/events/availability?${params}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Availability needs review.")))
      .then((data) => { if (active) setAvailability(data); })
      .catch((error) => { if (active && error.name !== "AbortError") setAvailability(null); });
    return () => { active = false; controller.abort(); };
  }, [booking.startsLocal, booking.endsLocal, booking.timeZone]);

  const selectedServices = useMemo(() => booking.services
    .map((selected) => catalog.services.find((service) => service.id === selected.serviceId))
    .filter(Boolean), [booking.services, catalog.services]);

  function update(field, value) {
    setBooking((current) => ({ ...current, [field]: value }));
  }

  function toggleService(serviceId) {
    setBooking((current) => {
      const selected = current.services.some((service) => service.serviceId === serviceId);
      return {
        ...current,
        packageId: "",
        services: selected
          ? current.services.filter((service) => service.serviceId !== serviceId)
          : [...current.services, { serviceId, servings: Number(current.guestCount), customization: emptyCustomization() }]
      };
    });
  }

  function updateService(serviceId, field, value, isMultiple = false) {
    setBooking((current) => ({
      ...current,
      services: current.services.map((service) => {
        if (service.serviceId !== serviceId) return service;
        if (field === "servings") return { ...service, servings: Math.max(1, Math.min(5000, Number(value) || 1)) };
        const customization = { ...service.customization };
        if (field === "needsAssistance") customization[field] = value;
        else if (isMultiple) {
          const values = customization[field] || [];
          customization[field] = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
        } else {
          const values = customization[field] || [];
          customization[field] = values.includes(value) ? [] : [value];
        }
        return { ...service, customization };
      })
    }));
  }

  function choosePackage(eventPackage) {
    setBooking((current) => ({
      ...current,
      packageId: eventPackage.id,
      services: eventPackage.items.map(({ service }) => ({
        serviceId: service.id, servings: Number(current.guestCount), customization: emptyCustomization()
      }))
    }));
  }

  function canContinue() {
    if (step === 0) return Boolean(booking.eventTypeSlug && booking.startsLocal && booking.endsLocal && Number(booking.guestCount) > 0) &&
      new Date(booking.startsLocal) > new Date() && new Date(booking.endsLocal) > new Date(booking.startsLocal) &&
      (booking.eventTypeSlug !== "other" || booking.otherEventType.trim());
    if (step === 1) return booking.services.length > 0 && selectedServices.length === booking.services.length;
    if (step === 3) return Boolean(booking.address.trim() && booking.city.trim() && booking.customerName.trim() && booking.customerEmail.trim() && booking.customerPhone.trim());
    return true;
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const payload = {
        ...booking,
        startsAt: timeAsIso(booking.startsLocal),
        endsAt: timeAsIso(booking.endsLocal),
        guestCount: Number(booking.guestCount),
        services: booking.services.map((service) => ({ ...service, servings: Number(service.servings) })),
        idempotencyKey
      };
      delete payload.startsLocal;
      delete payload.endsLocal;
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your request could not be submitted.");
      setConfirmation(result);
      onSubmitted?.(result);
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  function renderCustomization(service) {
    const selected = booking.services.find((item) => item.serviceId === service.id);
    const groups = serviceGroups[service.slug] || [];
    const optionConfig = service.customizationOptions || {};
    return (
      <article className="booking-custom-card" key={service.id}>
        <div className="booking-custom-heading"><div><span className="eyebrow">{service.name}</span><p>Tell us what you have in mind. We can help with the rest.</p></div><label>Estimated servings<input type="number" min="1" max="5000" value={selected?.servings || booking.guestCount} onChange={(event) => updateService(service.id, "servings", event.target.value)} /></label></div>
        <div className="booking-custom-fields">
          {groups.map(([field, label, multiple]) => {
            const choices = optionConfig[field] || [];
            if (!choices.length) return null;
            return <fieldset key={field}><legend>{label}</legend><div className="booking-options">{choices.map((choice) => {
              const isSelected = (selected?.customization[field] || []).includes(choice);
              return <button type="button" className={`booking-option ${isSelected ? "selected" : ""}`} key={choice} onClick={() => updateService(service.id, field, choice, multiple)}>{isSelected && <Check size={13} />}{choice}</button>;
            })}</div></fieldset>;
          })}
          <label className="assistance-check"><input type="checkbox" checked={selected?.customization.needsAssistance || false} onChange={(event) => updateService(service.id, "needsAssistance", event.target.checked)} /> Help me choose the details</label>
        </div>
      </article>
    );
  }

  return (
    <div className="modal-backdrop event-booking-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="event-booking-modal" role="dialog" aria-modal="true" aria-labelledby="event-booking-title">
        <button className="modal-close icon-button" onClick={onClose} aria-label="Close event booking"><X size={20} /></button>
        {confirmation ? (
          <div className="booking-confirmation">
            <span className="confirmation-icon"><PartyPopper size={27} /></span><p className="eyebrow">THE FIRST SWEET STEP</p>
            <h2>We have your <em>request.</em></h2><p className="confirmation-reference">Your reference <strong>{confirmation.reference}</strong></p>
            {confirmation.accessToken && <p className="confirmation-access">Private access code <strong>{confirmation.accessToken}</strong><small>Keep this code private. It is required to retrieve your request details.</small></p>}
            <p>This is a request, not a confirmed booking. Our team will check the date, location, and details, then follow up about availability and a tailored quote.</p>
            <div className="confirmation-reminder"><Clock3 size={17} /><span>Keep your reference handy. We will use the contact details you provided to get back to you.</span></div>
            <button className="button button-dark" onClick={onClose}>Back to KrunchyKremmy <ArrowRight size={17} /></button>
          </div>
        ) : <>
          <div className="event-wizard-header"><p className="eyebrow"><span className="eyebrow-mark">✳</span> SWEET CELEBRATIONS</p><h2 id="event-booking-title">Let’s make it <em>memorable.</em></h2><p>Tell us a little about the day. We will take it from here.</p></div>
          <div className="wizard-progress" aria-label={`Step ${step + 1} of ${steps.length}`}><div className="wizard-progress-track"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div><div className="wizard-step-labels">{steps.map((label, index) => <span className={index === step ? "current" : index < step ? "complete" : ""} key={label}><i>{index < step ? <Check size={11} /> : index + 1}</i>{label}</span>)}</div></div>
          {!catalogReady && <p className="booking-sample-banner">Preview options shown. Live services and booking submission require the event database.</p>}
          <div className="event-wizard-body">
            {step === 0 && <div className="wizard-fields">
              <label className="wizard-wide">What are you celebrating?<select value={booking.eventTypeSlug} onChange={(event) => update("eventTypeSlug", event.target.value)}>{catalog.eventTypes.map((type) => <option key={type.slug} value={type.slug}>{type.name}</option>)}</select></label>
              {booking.eventTypeSlug === "other" && <label className="wizard-wide">Tell us about your event<input required value={booking.otherEventType} onChange={(event) => update("otherEventType", event.target.value)} placeholder="Baby shower, festival, family reunion…" /></label>}
              <label className="wizard-wide">Event name <span className="field-optional">(optional)</span><input value={booking.eventName} onChange={(event) => update("eventName", event.target.value)} placeholder="Ava’s 8th birthday" /></label>
              <label>Starts<input type="datetime-local" min={getLocalDateTime(0)} value={booking.startsLocal} onChange={(event) => update("startsLocal", event.target.value)} /></label>
              <label>Ends<input type="datetime-local" min={booking.startsLocal} value={booking.endsLocal} onChange={(event) => update("endsLocal", event.target.value)} /></label>
              <label>Estimated guests<input type="number" min="1" max="5000" value={booking.guestCount} onChange={(event) => { const count = event.target.value; update("guestCount", count); setBooking((current) => ({ ...current, services: current.services.map((service) => ({ ...service, servings: Number(count) || 1 })) })); }} /></label>
              <label>Age group <span className="field-optional">(optional)</span><select value={booking.ageGroup} onChange={(event) => update("ageGroup", event.target.value)}><option value="">Not specified</option><option>Children</option><option>Adults</option><option>All ages</option></select></label>
              <label className="wizard-wide">Budget range <span className="field-optional">(optional)</span><select value={booking.budgetRange} onChange={(event) => update("budgetRange", event.target.value)}><option value="">Prefer not to say</option><option>Under $250</option><option>$250–$500</option><option>$500–$1,000</option><option>$1,000+</option><option>To be discussed</option></select></label>
              <div className={`availability-note ${availability?.manualReviewRequired ? "review" : ""}`}><Clock3 size={16} /><span>{availability?.reason || "Date and availability are reviewed by our team before a booking is confirmed."}</span></div>
            </div>}
            {step === 1 && <div className="wizard-services-content">
              <p className="wizard-hint">Pick a starting package or choose any combination of stations. Everything is tailored to your date and guest count.</p>
              <div className="wizard-package-list">{catalog.packages.map((item) => <button type="button" key={item.id} className={`wizard-package ${booking.packageId === item.id ? "selected" : ""}`} onClick={() => choosePackage(item)}><span><strong>{item.name}</strong><small>{item.description}</small></span><span className="quote-label">Request a quote</span></button>)}</div>
              <p className="eyebrow service-select-kicker">OR PICK YOUR STATIONS</p>
              <div className="wizard-service-list">{catalog.services.map((service) => {
                const checked = booking.services.some((item) => item.serviceId === service.id);
                return <button type="button" className={`wizard-service ${checked ? "selected" : ""}`} key={service.id} onClick={() => toggleService(service.id)}><img src={imageSource(service.imageUrl)} alt="" /><span className="wizard-service-copy"><strong>{service.name}</strong><small>{service.description}</small><small className="includes-note">{Array.isArray(service.includes) ? service.includes.slice(0, 3).join(" · ") : ""}</small></span><span className="service-check">{checked && <Check size={16} />}</span></button>;
              })}</div>
              <label className="other-service-note">Something special in mind?<textarea value={booking.specialRequests} onChange={(event) => update("specialRequests", event.target.value)} placeholder="Tell us what would make the day yours…" /></label>
            </div>}
            {step === 2 && <div className="wizard-customizations">
              {selectedServices.map(renderCustomization)}
              <label className="other-service-note">Anything else we should know?<textarea value={booking.specialRequests} onChange={(event) => update("specialRequests", event.target.value)} placeholder="Dietary notes, colors, setup ideas, or anything else…" /></label>
            </div>}
            {step === 3 && <div className="wizard-fields">
              <p className="wizard-subheading wizard-wide"><MapPin size={16} /> Where is the celebration?</p>
              <label className="wizard-wide">Venue type<select value={booking.venueType} onChange={(event) => update("venueType", event.target.value)}><option value="PRIVATE_RESIDENCE">Private residence</option><option value="EVENT_HALL">Event hall</option><option value="HOTEL">Hotel</option><option value="OFFICE">Office</option><option value="SCHOOL">School</option><option value="OUTDOOR">Outdoor venue</option><option value="OTHER">Other</option></select></label>
              <label className="wizard-wide">Venue name <span className="field-optional">(optional)</span><input value={booking.venueName} onChange={(event) => update("venueName", event.target.value)} placeholder="Venue or residence name" /></label>
              <label className="wizard-wide">Street address<input required value={booking.address} onChange={(event) => update("address", event.target.value)} placeholder="Street address" /></label>
              <label>City<input required value={booking.city} onChange={(event) => update("city", event.target.value)} /></label>
              <label>State / region<input value={booking.region} onChange={(event) => update("region", event.target.value)} /></label>
              <label>Postal code<input value={booking.postalCode} onChange={(event) => update("postalCode", event.target.value)} /></label>
              <label>Setup<select value={booking.setupType} onChange={(event) => update("setupType", event.target.value)}><option value="UNSURE">Not sure yet</option><option value="INDOOR">Indoors</option><option value="OUTDOOR">Outdoors</option></select></label>
              <label className="wizard-wide">Access or parking notes <span className="field-optional">(optional)</span><textarea value={booking.accessInstructions} onChange={(event) => update("accessInstructions", event.target.value)} placeholder="Loading access, stairs, parking…" /></label>
              <p className="wizard-subheading wizard-wide">How can we reach you?</p>
              <label>Your name<input required value={booking.customerName} onChange={(event) => update("customerName", event.target.value)} autoComplete="name" /></label>
              <label>Email address<input required type="email" value={booking.customerEmail} onChange={(event) => update("customerEmail", event.target.value)} autoComplete="email" /></label>
              <label>Phone number<input required type="tel" value={booking.customerPhone} onChange={(event) => update("customerPhone", event.target.value)} autoComplete="tel" /></label>
              <label>Preferred contact<select value={booking.contactMethod} onChange={(event) => update("contactMethod", event.target.value)}><option value="EMAIL">Email</option><option value="PHONE">Phone</option><option value="TEXT">Text message</option></select></label>
              <label className="wizard-wide">Company name <span className="field-optional">(optional)</span><input value={booking.companyName} onChange={(event) => update("companyName", event.target.value)} autoComplete="organization" /></label>
            </div>}
            {step === 4 && <div className="booking-review">
              <div className="review-section"><div><span className="review-number">01</span><h3>Your celebration</h3></div><button onClick={() => setStep(0)}>Edit</button><p>{catalog.eventTypes.find((type) => type.slug === booking.eventTypeSlug)?.name}{booking.otherEventType ? ` — ${booking.otherEventType}` : ""}{booking.eventName ? ` · ${booking.eventName}` : ""}</p><p>{new Date(booking.startsLocal).toLocaleString()} – {new Date(booking.endsLocal).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} ({booking.timeZone}) · {booking.guestCount} guests{booking.budgetRange ? ` · Budget: ${booking.budgetRange}` : ""}</p></div>
              <div className="review-section"><div><span className="review-number">02</span><h3>Your treats</h3></div><button onClick={() => setStep(1)}>Edit</button>{selectedServices.map((service) => { const selected = booking.services.find((item) => item.serviceId === service.id); const choices = Object.values(selected?.customization || {}).flatMap((value) => Array.isArray(value) ? value : typeof value === "string" && value ? [value] : []); return <p key={service.id}><strong>{service.name}</strong> · {selected?.servings} servings{choices.length ? ` · ${choices.join(", ")}` : ""}</p>; })}{booking.specialRequests && <p>Notes: {booking.specialRequests}</p>}<p className="quote-label review-quote">Pricing: requested quote — no price has been estimated.</p></div>
              <div className="review-section"><div><span className="review-number">03</span><h3>Place & contact</h3></div><button onClick={() => setStep(3)}>Edit</button><p>{booking.venueName ? `${booking.venueName}, ` : ""}{booking.address}, {booking.city}{booking.region ? `, ${booking.region}` : ""}</p><p>{booking.customerName} · {booking.customerEmail} · {booking.customerPhone}</p></div>
              <label className="terms-check"><input type="checkbox" checked={booking.termsAccepted} onChange={(event) => update("termsAccepted", event.target.checked)} /> I agree that KrunchyKremmy may use these details to respond to my event inquiry. I understand this is a request, not a confirmed booking.</label>
              <label className="booking-honeypot" aria-hidden="true">Leave this field empty<input tabIndex="-1" autoComplete="off" value={booking.honeypot} onChange={(event) => update("honeypot", event.target.value)} /></label>
            </div>}
          </div>
          {submitError && <p className="form-error booking-error" role="alert">{submitError}</p>}
          <div className="wizard-actions">{step > 0 ? <button className="button button-outline" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button> : <span className="wizard-policy">Your request is private and is not a confirmed booking.</span>}
            {step < steps.length - 1 ? <button className="button button-dark" disabled={!canContinue()} onClick={() => setStep(step + 1)}>Continue <ArrowRight size={16} /></button> : <button className="button button-dark" disabled={!booking.termsAccepted || submitting} onClick={submit}>{submitting ? "Sending request…" : "Submit booking request"} <ArrowRight size={16} /></button>}
          </div>
          <p className="wizard-footer-note">No charge is taken here. Availability and a tailored quote are confirmed by the team.</p>
        </>}
      </section>
    </div>
  );
}
