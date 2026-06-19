import { APIProvider, Map } from "@vis.gl/react-google-maps";

const gKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

interface IndustrialMapProps {
  previewMode?: boolean;
}

export function IndustrialMap({ previewMode = false }: IndustrialMapProps) {
  return (
    <div style={{ height: previewMode ? "100%" : "calc(100vh - 3.5rem)", width: "100%" }}>
      <APIProvider apiKey={gKey ?? ""}>
        <Map
          style={{ height: "100%", width: "100%" }}
          defaultCenter={{ lat: 12.2, lng: 104.9 }}
          defaultZoom={7}
          mapTypeId="roadmap"
          gestureHandling="greedy"
        />
      </APIProvider>
    </div>
  );
}
