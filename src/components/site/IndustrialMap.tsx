import { useEffect, useRef } from "react";

const gKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

interface IndustrialMapProps {
  previewMode?: boolean;
}

export function IndustrialMap({ previewMode = false }: IndustrialMapProps) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!divRef.current || !gKey) return;
    if (document.getElementById("gmap-script")) return;

    const script = document.createElement("script");
    script.id = "gmap-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${gKey}&libraries=places`;
    script.async = true;
    script.onload = () => {
      const map = new google.maps.Map(divRef.current!, {
        center: { lat: 12.2, lng: 104.9 },
        zoom: 7,
        mapTypeControl: true,
        zoomControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        scaleControl: true,
      });

      const searchBox = new google.maps.places.SearchBox(
        (() => {
          const input = document.createElement("input");
          input.placeholder = "Search on map…";
          input.style.cssText = [
            "margin:10px",
            "padding:8px 14px",
            "width:280px",
            "font-size:14px",
            "border:none",
            "border-radius:2px",
            "box-shadow:0 2px 6px rgba(0,0,0,.3)",
            "outline:none",
          ].join(";");
          map.controls[google.maps.ControlPosition.TOP_CENTER].push(input);
          return input;
        })()
      );

      const markers: google.maps.Marker[] = [];

      map.addListener("bounds_changed", () => {
        searchBox.setBounds(map.getBounds() as google.maps.LatLngBounds);
      });

      searchBox.addListener("places_changed", () => {
        const places = searchBox.getPlaces();
        if (!places?.length) return;

        markers.forEach((m) => m.setMap(null));
        markers.length = 0;

        const bounds = new google.maps.LatLngBounds();
        places.forEach((place) => {
          if (!place.geometry?.location) return;
          markers.push(new google.maps.Marker({ map, title: place.name, position: place.geometry.location }));
          if (place.geometry.viewport) bounds.union(place.geometry.viewport);
          else bounds.extend(place.geometry.location);
        });
        map.fitBounds(bounds);
      });
    };
    document.head.appendChild(script);
  }, []);

  return (
    <div
      ref={divRef}
      style={{ height: previewMode ? "100%" : "calc(100vh - 3.5rem)", width: "100%" }}
    />
  );
}
