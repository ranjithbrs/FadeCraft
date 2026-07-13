import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Building2, Stethoscope, X, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Suggestion {
  id: string;
  name: string;
  type: "hospital" | "doctor";
  subtitle: string;
}

export const SearchBar = () => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [locating, setLocating] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.county ||
            "";
          if (city) {
            setQuery(city);
            toast.success(`Location detected: ${city}`);
          } else {
            toast.error("Could not determine your city");
          }
        } catch {
          toast.error("Failed to detect location");
        } finally {
          setLocating(false);
        }
      },
      () => {
        toast.error("Location access denied");
        setLocating(false);
      },
      { timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const [hospitalsRes, doctorsRes] = await Promise.all([
          supabase.rpc("search_hospitals", {
            search_text: query.trim(),
            limit_count: 4,
            offset_count: 0,
          }),
          supabase.rpc("search_doctors", {
            search_text: query.trim(),
            limit_count: 4,
            offset_count: 0,
          }),
        ]);

        const items: Suggestion[] = [];

        (hospitalsRes.data || []).forEach((h: any) =>
          items.push({
            id: h.id,
            name: h.name,
            type: "hospital",
            subtitle: `${h.city} · ${(h.specialties || []).slice(0, 2).join(", ")}`,
          })
        );

        (doctorsRes.data || []).forEach((d: any) =>
          items.push({
            id: d.id,
            name: d.name,
            type: "doctor",
            subtitle: `${d.specialization} · ${d.experience}yr exp`,
          })
        );

        setSuggestions(items);
        setShowSuggestions(items.length > 0);
        setSelectedIndex(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = (item: Suggestion) => {
    setShowSuggestions(false);
    setQuery("");
    if (item.type === "hospital") {
      navigate(`/hospital/${item.id}`);
    } else {
      navigate(`/doctor/${item.id}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      handleSelect(suggestions[selectedIndex]);
      return;
    }
    if (query.trim()) {
      setShowSuggestions(false);
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="rounded-xl bg-white shadow-lg border border-gray-100" ref={wrapperRef}>
      <form onSubmit={handleSubmit} className="relative px-4 py-3">
        {/* Search icon */}
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none z-10" />

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search doctors, hospitals, or speci..."
          className="w-full pl-11 pr-12 h-12 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary shadow-sm"
          autoComplete="off"
        />

        {/* Right icons */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                setShowSuggestions(false);
              }}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={detectLocation}
            disabled={locating}
            className="text-primary hover:text-primary/80 transition-colors disabled:opacity-50 p-1"
            title="Detect my location"
          >
            {locating ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <MapPin className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden">
            {suggestions.map((item, i) => (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                onClick={() => handleSelect(item)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                  i === selectedIndex ? "bg-gray-50" : ""
                }`}
              >
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  {item.type === "hospital" ? (
                    <Building2 className="h-4 w-4 text-primary" />
                  ) : (
                    <Stethoscope className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                  {item.type}
                </span>
              </button>
            ))}
            {loading && (
              <div className="px-4 py-3 text-xs text-gray-400 text-center">Searching…</div>
            )}
          </div>
        )}
      </form>
    </div>
  );
};
