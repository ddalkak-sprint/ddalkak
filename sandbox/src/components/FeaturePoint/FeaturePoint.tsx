interface FeaturePointProps {
  point: string;
  heading: string;
  subtitle: string;
}

export default function FeaturePoint({ point, heading, subtitle }: FeaturePointProps) {
  return (
    <div className="flex flex-col items-start gap-4">
      <div className="rounded-[50px] bg-purple-600 px-3 py-1.5">
        <span className="text-font-14-bold font-bold text-white">{point}</span>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-font-24-bold font-bold text-gray-900">{heading}</h2>
        <p className="text-font-18-regular text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}
