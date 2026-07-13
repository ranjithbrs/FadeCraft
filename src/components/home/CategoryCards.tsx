import { Heart, Brain, Bone, Eye, Baby, Activity, Stethoscope, Pill } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const categories = [
  { name: "Cardiology", icon: Heart, bg: "bg-red-50", iconColor: "text-red-500", link: "/search?specialty=cardiology" },
  { name: "Neurology", icon: Brain, bg: "bg-purple-50", iconColor: "text-purple-500", link: "/search?specialty=neurology" },
  { name: "Orthopedics", icon: Bone, bg: "bg-orange-50", iconColor: "text-orange-500", link: "/search?specialty=orthopedics" },
  { name: "Eye Care", icon: Eye, bg: "bg-sky-50", iconColor: "text-sky-500", link: "/search?specialty=ophthalmology" },
  { name: "Pediatrics", icon: Baby, bg: "bg-pink-50", iconColor: "text-pink-500", link: "/search?specialty=pediatrics" },
  { name: "General", icon: Stethoscope, bg: "bg-blue-50", iconColor: "text-blue-500", link: "/search?specialty=general medicine" },
  { name: "Derma", icon: Activity, bg: "bg-yellow-50", iconColor: "text-yellow-600", link: "/search?specialty=dermatology" },
  { name: "Pharmacy", icon: Pill, bg: "bg-green-50", iconColor: "text-green-600", link: "/pharmacy" },
];

export const CategoryCards = () => {
  return (
    <div className="px-4 py-4 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Browse by Specialty</h2>
        <Link to="/search" className="text-sm font-medium text-primary hover:underline">
          View All
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {categories.map((category) => (
          <Link key={category.name} to={category.link} className="group">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center active:scale-95 transition-transform duration-150 shadow-sm",
                  category.bg
                )}
              >
                <category.icon className={cn("h-6 w-6", category.iconColor)} />
              </div>
              <span className="text-[10px] text-center font-semibold text-gray-600 leading-tight">
                {category.name}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
