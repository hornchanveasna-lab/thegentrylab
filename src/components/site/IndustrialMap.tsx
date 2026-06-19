interface IndustrialMapProps {
  previewMode?: boolean;
}

export function IndustrialMap({ previewMode = false }: IndustrialMapProps) {
  const height = previewMode ? "100%" : "calc(100vh - 3.5rem)";

  return (
    <div style={{ height, width: "100%" }}>
      <iframe
        title="Cambodia Industrial Map"
        src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d1800000!2d104.9!3d12.2!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2skh!4v1"
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
