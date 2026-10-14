import { MapPin, Star, Scissors, Clock, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useHospitals } from "@/hooks/useHospitals";
import { Link } from "react-router-dom";

const CURATED_SALONS = [
  {
    id: "salon-1",
    name: "The Royal Fade Studio",
    city: "Bespoke Grooming",
    state: "Indiranagar",
    rating: 4.9,
    wait: "10 mins wait",
    chairs: "4 Chairs Active",
    image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "salon-2",
    name: "Obsidian & Blade Barbershop",
    city: "Luxury Cuts & Beard",
    state: "Koramangala",
    rating: 4.8,
    wait: "Ready Now",
    chairs: "6 Chairs Active",
    image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "salon-3",
    name: "Luxe Haven Salon & Spa",
    city: "Hair Styling & Spa",
    state: "MG Road",
    rating: 4.9,
    wait: "15 mins wait",
    chairs: "5 Chairs Active",
    image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "salon-4",
    name: "Apex Master Barbers",
    city: "Hot Towel & Fades",
    state: "Whitefield",
    rating: 4.7,
    wait: "5 mins wait",
    chairs: "3 Chairs Active",
    image: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=600&q=80",
  },
];

export const FeaturedHospitals = () => {
  const { data: hospitals, isLoading } = useHospitals();

  const displayList = hospitals && hospitals.length > 0 ? hospitals : CURATED_SALONS;

  if (isLoading && (!hospitals || hospitals.length === 0)) {
    return (
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-100">Featured Studios</h2>
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2].map((i) => (
            <div key={i} className="min-w-[260px]">
              <Skeleton className="h-44 w-full rounded-2xl bg-slate-900 border border-slate-800" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">Top Barbershops & Studios</h2>
          <p className="text-xs text-slate-400">Verified master stylists with live queue tracking</p>
        </div>
        <Link to="/search" className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors">
          View All &rarr;
        </Link>
      </div>

      {/* Horizontal scroll list */}
      <div className="flex gap-3.5 overflow-x-auto pb-2 -mx-0 scrollbar-hide">
        {displayList.slice(0, 6).map((salon: any) => {
          const imgUrl = salon.images?.[0] || salon.image || "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80";
          const waitTime = salon.wait || "10-15 mins wait";
          const activeChairs = salon.chairs || "4 Chairs Active";

          return (
            <Link
              key={salon.id}
              to={salon.id.startsWith("salon-") ? "/search" : `/hospital/${salon.id}`}
              className="flex-none w-[270px] group"
            >
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800/80 h-48 shadow-lg group-hover:border-amber-500/40 transition-all duration-300">
                {/* Image */}
                <img
                  src={imgUrl}
                  alt={salon.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Rating badge top-right */}
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-950/80 backdrop-blur-md border border-slate-700/60 rounded-full px-2.5 py-1 shadow-md">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300">
                    {Number(salon.rating || 4.8).toFixed(1)}
                  </span>
                </div>

                {/* Live Wait badge top-left */}
                <div className="absolute top-3 left-3 flex items-center gap-1 bg-amber-500/90 text-slate-950 font-bold rounded-full px-2.5 py-0.5 text-[10px] shadow-sm">
                  <Clock className="h-3 w-3" />
                  <span>{waitTime}</span>
                </div>

                {/* Bottom gradient overlay with name & location */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-3 pt-6">
                  <h3 className="font-bold text-slate-100 text-sm line-clamp-1 group-hover:text-amber-300 transition-colors">
                    {salon.name}
                  </h3>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-amber-400" />
                      <span className="line-clamp-1">{salon.city}, {salon.state}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Scissors className="h-3 w-3 text-amber-400" />
                      <span>{activeChairs}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};