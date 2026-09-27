export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: {
          "Accept-Language": "en",
          // Nominatim requires a User-Agent identifying the app
          "User-Agent": "NeedArtisanMarketplace/1.0",
        },
      }
    );
    
    if (!response.ok) {
      throw new Error("Failed to reverse geocode");
    }

    const data = await response.json();
    
    // Extract the most relevant neighborhood or city name
    const address = data.address;
    if (!address) return "Unknown Location";

    // Priority: suburb -> neighbourhood -> city_district -> town -> city
    const locationName = 
      address.suburb || 
      address.neighbourhood || 
      address.city_district || 
      address.town || 
      address.city || 
      address.state || 
      "Unknown Location";

    return locationName;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return "Unknown Location";
  }
}

export async function geocode(address: string): Promise<{lat: number, lng: number}> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "NeedArtisanMarketplace/1.0",
        },
      }
    );
    
    if (!response.ok) {
      throw new Error("Failed to geocode");
    }

    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
    throw new Error("No results found");
  } catch (error) {
    console.error("Geocoding error:", error);
    throw error;
  }
}
