import { useEffect, useState, useRef } from "react";

interface SkillBarProps {
  skill: string;
  percentage: number;
  color?: string;
}

export function SkillBar({ skill, percentage, color = "bg-accent" }: SkillBarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setTimeout(() => {
            setCurrentWidth(percentage);
          }, 200);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [percentage]);

  return (
    <div ref={ref} className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-medium text-primary">{skill}</span>
        <span className="text-accent">{percentage}%</span>
      </div>
      <div className="bg-muted rounded-full h-3 overflow-hidden">
        <div
          className={`skill-bar ${color} h-3 rounded-full transition-all duration-2000 ease-out`}
          style={{ width: isVisible ? `${currentWidth}%` : "0%" }}
        />
      </div>
    </div>
  );
}
