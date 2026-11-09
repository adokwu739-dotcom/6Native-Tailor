export type Product = {
  id: string;
  name: string;
  category: "Ready to wear" | "New arrivals" | "Accessories";
  price: number;
  image: string;
  note: string;
  color: string;
};

export const products: Product[] = [
  {
    id: "season-dress",
    name: "All-Season Ankara Dress",
    category: "New arrivals",
    price: 98500,
    image:
      "/images/all-season-ankara-dress.jpeg",
    note: "Hand-finished · Nigerian Ankara",
    color: "#e5d7c6",
  },
  {
    id: "green-palm-coord",
    name: "Green Palm Co-ord",
    category: "Ready to wear",
    price: 112000,
    image:
      "/images/green-palm-coord.jpeg",
    note: "Small-batch · Palm print",
    color: "#d9d3c9",
  },
  {
    id: "purple-agbada",
    name: "Purple Agbada Set",
    category: "Ready to wear",
    price: 42000,
    image:
      "/images/purple-agbada.jpeg",
    note: "Traditional wear · Tailored finish",
    color: "#d8d1c5",
  },
  {
    id: "green-mens-kaftan",
    name: "Green Men's Kaftan",
    category: "Ready to wear",
    price: 76000,
    image:
      "/images/green-mens-kaftan.jpeg",
    note: "Native wear · Made to move",
    color: "#cfd9d4",
  },
];

export function formatNaira(amount: number) {
  return `₦${new Intl.NumberFormat("en-NG").format(amount)}`;
}
