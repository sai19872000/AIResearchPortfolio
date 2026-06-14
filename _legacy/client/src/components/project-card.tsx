import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Github, FileText } from "lucide-react";

interface ProjectCardProps {
  title: string;
  description: string;
  technologies: string[];
  type: string;
  imageUrl?: string;
  liveUrl?: string;
  codeUrl?: string;
  paperUrl?: string;
  isProprietary?: boolean;
}

export function ProjectCard({
  title,
  description,
  technologies,
  type,
  imageUrl,
  liveUrl,
  codeUrl,
  paperUrl,
  isProprietary = false,
}: ProjectCardProps) {
  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "ai tool":
        return "bg-accent/10 text-accent";
      case "editor":
        return "bg-green-100 text-green-700";
      case "research":
        return "bg-purple-100 text-purple-700";
      case "fintech":
        return "bg-red-100 text-red-700";
      case "healthcare":
        return "bg-indigo-100 text-indigo-700";
      case "mlops":
        return "bg-teal-100 text-teal-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getGradientColors = (type: string) => {
    switch (type.toLowerCase()) {
      case "ai tool":
        return "from-accent to-primary";
      case "editor":
        return "from-green-500 to-blue-600";
      case "research":
        return "from-purple-500 to-pink-600";
      case "fintech":
        return "from-red-500 to-orange-600";
      case "healthcare":
        return "from-indigo-500 to-purple-600";
      case "mlops":
        return "from-teal-500 to-cyan-600";
      default:
        return "from-gray-500 to-gray-600";
    }
  };

  return (
    <Card className="project-card overflow-hidden">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-bold text-primary">{title}</h3>
          <Badge className={`${getTypeColor(type)} ml-2`}>
            {type}
          </Badge>
        </div>
        <p className="text-muted-foreground mb-4 leading-relaxed">
          {description}
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {technologies.map((tech) => (
            <Badge
              key={tech}
              variant="secondary"
              className={getTypeColor(type)}
            >
              {tech}
            </Badge>
          ))}
        </div>
        <div className="flex space-x-3">
          {isProprietary ? (
            <span className="text-muted-foreground text-sm flex items-center">
              <span className="mr-1">🔒</span> Proprietary
            </span>
          ) : (
            <>
              {liveUrl && (
                <a
                  href={liveUrl}
                  className="text-accent hover:text-primary transition-colors flex items-center text-sm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Live Demo
                </a>
              )}
              {codeUrl && (
                <a
                  href={codeUrl}
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center text-sm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="w-4 h-4 mr-1" />
                  Code
                </a>
              )}
              {paperUrl && (
                <a
                  href={paperUrl}
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center text-sm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Paper
                </a>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
