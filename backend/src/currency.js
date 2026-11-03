export function formatNaira(kobo) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN"
  }).format(kobo / 100);
}
