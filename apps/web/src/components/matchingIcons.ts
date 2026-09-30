import {
  Car,
  CloudRain,
  Construction,
  Leaf,
  MapPin,
  School,
  ShieldCheck,
  TrainFront,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

export type MatchingIconOption = {
  key: string;
  label: string;
  Icon: LucideIcon;
};

export const matchingIconOptions: MatchingIconOption[] = [
  { key: "train", label: "Järnväg", Icon: TrainFront },
  { key: "weather", label: "Väder", Icon: CloudRain },
  { key: "school", label: "Skola", Icon: School },
  { key: "map-pin", label: "Plats", Icon: MapPin },
  { key: "shield", label: "Säkerhet", Icon: ShieldCheck },
  { key: "car", label: "Vägtrafik", Icon: Car },
  { key: "construction", label: "Vägarbete", Icon: Construction },
  { key: "environment", label: "Miljö", Icon: Leaf },
  { key: "warning", label: "Varning", Icon: TriangleAlert },
];

export function getMatchingIcon(iconKey?: string | null) {
  return matchingIconOptions.find((option) => option.key === iconKey)?.Icon ?? MapPin;
}
