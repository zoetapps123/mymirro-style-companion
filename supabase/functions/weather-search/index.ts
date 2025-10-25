import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ cities: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use OpenWeather Geocoding API
    const geoResponse = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${Deno.env.get("OPENWEATHER_API_KEY")}`
    );

    if (!geoResponse.ok) {
      throw new Error("Failed to fetch cities");
    }

    const cities = await geoResponse.json();

    // Fetch weather for each city
    const citiesWithWeather = await Promise.all(
      cities.map(async (city: any) => {
        try {
          const weatherResponse = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lon}&units=metric&appid=${Deno.env.get("OPENWEATHER_API_KEY")}`
          );
          
          if (weatherResponse.ok) {
            const weather = await weatherResponse.json();
            return {
              name: city.name,
              country: city.country,
              state: city.state,
              lat: city.lat,
              lon: city.lon,
              temp: Math.round(weather.main.temp),
              weather: weather.weather[0].main,
              icon: getWeatherIcon(weather.weather[0].main),
              humidity: weather.main.humidity,
              season: getSeason(city.lat)
            };
          }
        } catch (error) {
          console.error("Error fetching weather for city:", error);
        }
        
        return {
          name: city.name,
          country: city.country,
          state: city.state,
          lat: city.lat,
          lon: city.lon,
          temp: null,
          weather: null,
          icon: "🌍"
        };
      })
    );

    return new Response(JSON.stringify({ cities: citiesWithWeather }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in weather-search function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', cities: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function getWeatherIcon(weather: string): string {
  const icons: Record<string, string> = {
    Clear: "☀️",
    Clouds: "☁️",
    Rain: "🌧️",
    Drizzle: "🌦️",
    Thunderstorm: "⛈️",
    Snow: "❄️",
    Mist: "🌫️",
    Fog: "🌫️",
    Haze: "🌤️"
  };
  return icons[weather] || "🌍";
}

function getSeason(lat: number): string {
  const month = new Date().getMonth();
  const isNorthern = lat >= 0;
  
  if (isNorthern) {
    if (month >= 2 && month <= 4) return "spring";
    if (month >= 5 && month <= 7) return "summer";
    if (month >= 8 && month <= 10) return "fall";
    return "winter";
  } else {
    if (month >= 2 && month <= 4) return "fall";
    if (month >= 5 && month <= 7) return "winter";
    if (month >= 8 && month <= 10) return "spring";
    return "summer";
  }
}
