import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkillBar } from "@/components/skill-bar";
import { ProjectCard } from "@/components/project-card";
import { ContactForm } from "@/components/contact-form";
import { NeuralBackground } from "@/components/neural-background";
import {
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Download,
  Brain,
  Bot,
  Settings,
  Code,
  Eye,
  Users,
  Menu,
  CheckCircle,
  ExternalLink,
  Quote,
  ArrowUp,
} from "lucide-react";

export default function Home() {
  const [activeSection, setActiveSection] = useState("home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const { data: portfolioData, isLoading } = useQuery({
    queryKey: ["/api/portfolio"],
  });

  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        "home",
        "about",
        "skills",
        "experience",
        "projects",
        "publications",
        "contact",
      ];
      const currentSection = sections.find((section) => {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          return rect.top <= 100 && rect.bottom >= 100;
        }
        return false;
      });

      if (currentSection) {
        setActiveSection(currentSection);
      }

      // Show scroll to top button when scrolled down
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setIsMenuOpen(false);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToExperience = (company: string) => {
    const elementId = `experience-${company.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  const data = portfolioData || {
    personal: {},
    experience: [],
    projects: [],
    publications: [],
  };

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full nav-floating backdrop-blur-md z-50 border-b border-border transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="text-xl font-bold text-primary animate-pulse-slow">
              <span className="gradient-text">
                {(data as any).personal?.name || "Dr. Sai Teja Pusuluri"}
              </span>
            </div>
            <div className="hidden md:flex space-x-2">
              {[
                "Home",
                "About",
                "Skills",
                "Experience",
                "Projects",
                "Publications",
                "Contact",
              ].map((item) => (
                <button
                  key={item}
                  onClick={() => scrollToSection(item.toLowerCase())}
                  className={`nav-link text-foreground transition-all duration-300 ${
                    activeSection === item.toLowerCase() ? "active" : ""
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className={`md:hidden hamburger ${isMenuOpen ? "open" : ""} hover:bg-accent/10 transition-all duration-300`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          {isMenuOpen && (
            <div className="md:hidden mt-6 mobile-menu">
              <div className="flex flex-col p-2">
                {[
                  "Home",
                  "About",
                  "Skills",
                  "Experience",
                  "Projects",
                  "Publications",
                  "Contact",
                ].map((item, index) => (
                  <button
                    key={item}
                    onClick={() => scrollToSection(item.toLowerCase())}
                    className="mobile-menu-item text-left font-medium"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-accent rounded-full mr-3 opacity-60"></span>
                      {item}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section
        id="home"
        className="neural-bg min-h-screen flex items-center text-white relative"
      >
        <NeuralBackground />
        <div className="max-w-6xl mx-auto px-6 py-24 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="animate-slide-up">
              <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                {(data as any).personal?.name || "Dr. Sai Teja Pusuluri"}
                <span className="block text-accent">
                  {(data as any).personal?.title || "Generative AI Expert"}
                </span>
              </h1>
              <p className="text-xl mb-8 text-gray-300 leading-relaxed">
                {(data as any).personal?.overview ||
                  "PhD in Physics with 8+ years of industry experience in Generative AI, Agentic AI Workflows, and MLOps. Leading innovation in AI solutions that transform organizations."}
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  onClick={() => scrollToSection("contact")}
                  className="bg-accent hover:bg-accent/90 text-white px-8 py-3"
                >
                  Get In Touch
                </Button>
                <Button
                  variant="outline"
                  className="border-white text-white hover:bg-white hover:text-primary px-8 py-3 bg-transparent"
                  onClick={() => window.open("/api/resume", "_blank")}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download My Resume
                </Button>
              </div>
              <div className="flex space-x-6 mt-8">
                <a
                  href={(data as any).personal?.LinkedInUrl || "https://www.linkedin.com/in/sai-teja-pusuluri/"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  <Linkedin className="w-6 h-6" />
                </a>
                <a
                  href={(data as any).personal?.GitHubUrl || "https://github.com/sai19872000"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  <Github className="w-6 h-6" />
                </a>
                <a
                  href={
                    "mailto:" + (data as any).personal?.email ||
                    "mailto:sai19872000@gmail.com"
                  }
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  <Mail className="w-6 h-6" />
                </a>
              </div>
            </div>
            <div className="hidden md:block animate-float relative">
              <video
                src="/attached_assets/AI_Expert_Intro_Video.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="rounded-2xl shadow-2xl w-full h-auto max-w-lg"
              >
                <source
                  src="/attached_assets/AI_Expert_Intro_Video.mp4"
                  type="video/mp4"
                />
                Your browser does not support the video tag.
              </video>
              <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm text-white text-sm px-3 py-1 rounded-full">
                Generated using AI
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-4">About Me</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              {(data as any).about?.description ||
                "Passionate about pushing the boundaries of artificial intelligence and machine learning"}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="order-2 md:order-1 relative">
              <video
                src="/attached_assets/Star_s_Galactic_Journey_Video_Ready.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="rounded-xl shadow-lg w-full h-auto object-cover aspect-square"
              >
                <source
                  src="/attached_assets/Star_s_Galactic_Journey_Video_Ready.mp4"
                  type="video/mp4"
                />
                Your browser does not support the video tag.
              </video>
              <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm text-white text-sm px-3 py-1 rounded-full">
                Generated using AI
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h3 className="text-2xl font-bold text-primary mb-6">
                Professional Journey
              </h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                With a PhD in Physics and Neural Networks from Ohio University,
                I've dedicated my career to advancing the field of artificial
                intelligence. Currently serving as Manager/Lead - Generative AI
                at Discover, I pioneer agentic AI workflows and lead
                cross-functional teams to deliver scalable AI solutions.
              </p>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                My experience spans from fraud detection at JP Morgan Chase to
                cutting-edge research in organoid segmentation at Ohio
                University. I'm passionate about translating complex AI research
                into production-ready solutions that create real business value.
              </p>
            </div>
          </div>

          {/* Career Timeline - Full Width Below */}
          <div className="mt-16">
            <h4 className="text-2xl font-bold text-primary mb-8 text-center">
              Career Timeline
            </h4>
            <div className="relative max-w-4xl mx-auto">
              <div className="space-y-16 py-8">
                {/* Current Role - Top Right */}
                <div className="flex justify-end">
                  <div className="timeline-item flex items-center space-x-4 max-w-sm">
                    <div className="text-right">
                      <div className="text-sm font-bold text-accent mb-1">
                        2022 - Present
                      </div>
                      <h5 className="font-semibold text-primary">
                        Manager/Lead - Generative AI
                      </h5>
                      <p className="text-sm text-muted-foreground">Discover</p>
                      <p className="text-xs text-muted-foreground">
                        Agentic AI, LLM Fine-tuning, Team Leadership
                      </p>
                    </div>
                    <div className="relative">
                      <div
                        className="w-12 h-12 bg-accent rounded-full flex items-center justify-center animate-pulse-slow cursor-pointer hover:scale-110 transition-transform"
                        onClick={() => scrollToExperience("Discover")}
                        title="View Discover experience"
                      >
                        <div className="w-4 h-4 bg-white rounded-full"></div>
                      </div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent/30 rounded-full animate-ping"></div>
                    </div>
                  </div>
                </div>

                {/* Adjunct Professor - Top Left */}
                <div className="flex justify-start">
                  <div className="timeline-item flex items-center space-x-4 max-w-sm">
                    <div className="relative">
                      <div
                        className="w-12 h-12 bg-accent rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                        onClick={() => scrollToExperience("Ohio University")}
                        title="View Ohio University experience"
                      >
                        <div className="w-4 h-4 bg-white rounded-full"></div>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-accent mb-1">
                        2023 - Present
                      </div>
                      <h5 className="font-semibold text-primary">
                        Adjunct Professor
                      </h5>
                      <p className="text-sm text-muted-foreground">
                        Ohio University
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Computer Vision, Organoid Research
                      </p>
                    </div>
                  </div>
                </div>

                {/* JP Morgan - Center Right */}
                <div className="flex justify-end">
                  <div className="timeline-item flex items-center space-x-4 max-w-sm">
                    <div className="text-right">
                      <div className="text-sm font-bold text-accent mb-1">
                        2017 - 2022
                      </div>
                      <h5 className="font-semibold text-primary">
                        Senior Applied AI Associate
                      </h5>
                      <p className="text-sm text-muted-foreground">
                        JP Morgan Chase
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Fraud Detection, Neural Networks, NLP
                      </p>
                    </div>
                    <div className="relative">
                      <div
                        className="w-12 h-12 bg-accent rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                        onClick={() => scrollToExperience("JP Morgan Chase")}
                        title="View JP Morgan Chase experience"
                      >
                        <div className="w-4 h-4 bg-white rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nationwide Children's - Center Left */}
                <div className="flex justify-start">
                  <div className="timeline-item flex items-center space-x-4 max-w-sm">
                    <div className="relative">
                      <div
                        className="w-12 h-12 bg-accent rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                        onClick={() =>
                          scrollToExperience("Nationwide Children's Hospital")
                        }
                        title="View Nationwide Children's Hospital experience"
                      >
                        <div className="w-4 h-4 bg-white rounded-full"></div>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-accent mb-1">
                        2016 - 2017
                      </div>
                      <h5 className="font-semibold text-primary">
                        Data Scientist
                      </h5>
                      <p className="text-sm text-muted-foreground">
                        Nationwide Children's Hospital
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bioinformatics, Medical ML
                      </p>
                    </div>
                  </div>
                </div>

                {/* PhD - Bottom Right */}
                <div className="flex justify-end">
                  <div className="timeline-item flex items-center space-x-4 max-w-sm">
                    <div className="text-right">
                      <div className="text-sm font-bold text-accent mb-1">
                        2011 - 2017
                      </div>
                      <h5 className="font-semibold text-primary">
                        PhD in Physics
                      </h5>
                      <p className="text-sm text-muted-foreground">
                        Ohio University
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Neural Networks, Research, Publications
                      </p>
                    </div>
                    <div className="relative">
                      <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                        <div className="w-4 h-4 bg-white rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Experience Section */}
      <section
        id="experience"
        className="py-24 neural-bg relative overflow-hidden text-white"
      >
        <NeuralBackground />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Professional Experience
            </h2>
            <p className="text-xl text-gray-300">
              Building AI solutions that transform industries
            </p>
          </div>

          <div className="space-y-8">
            {(data as any).experience?.map((exp: any, index: number) => (
              <Card
                key={index}
                id={`experience-${exp.company.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                className="p-8 hover:border-accent transition-colors bg-white/10 backdrop-blur-md border-white/20"
              >
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">
                        {exp.title}
                      </h3>
                      <p className="text-accent font-medium text-lg">
                        {exp.company}
                      </p>
                    </div>
                    <div className="text-gray-300 font-medium">
                      {exp.period}
                    </div>
                  </div>
                  <ul className="space-y-3 text-gray-300">
                    {exp.achievements?.map(
                      (achievement: string, achievementIndex: number) => (
                        <li key={achievementIndex} className="flex items-start">
                          <CheckCircle className="text-accent mr-3 mt-1 flex-shrink-0 w-4 h-4" />
                          <span>{achievement}</span>
                        </li>
                      ),
                    )}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section
        id="projects"
        className="py-24 neural-bg relative overflow-hidden text-white"
      >
        <NeuralBackground />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Featured Projects
            </h2>
            <p className="text-xl text-gray-300">
              Innovative AI solutions and research applications
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(data as any).projects?.map((project: any, index: number) => (
              <ProjectCard
                key={index}
                title={project.title}
                description={project.description}
                technologies={project.technologies}
                type={project.type}
                codeUrl={project.codeUrl}
                liveUrl={project.liveUrl}
                paperUrl={project.paperUrl}
                isProprietary={project.title.includes("Fraud Detection")}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Publications Section */}
      <section id="publications" className="py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-4">
              Publications & Research
            </h2>
            <p className="text-xl text-muted-foreground">
              Contributing to the advancement of AI and scientific research
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {(data as any).publications?.map(
              (publication: any, index: number) => (
                <Card
                  key={index}
                  className="p-6 hover:border-accent transition-colors"
                >
                  <CardContent className="p-0">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-primary mb-2">
                          {publication.title}
                        </h3>
                        <p className="text-muted-foreground text-sm mb-2">
                          {publication.authors}, {publication.journal}
                        </p>
                      </div>
                      <div className="ml-4">
                        <Badge
                          variant={
                            publication.status === "published"
                              ? "default"
                              : "secondary"
                          }
                          className={
                            publication.status === "published"
                              ? "bg-green-100 text-green-700"
                              : "bg-accent/10 text-accent"
                          }
                        >
                          {publication.status === "published"
                            ? "Published"
                            : "Pending"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ),
            )}
          </div>

          <div className="text-center mt-12">
            <a
              href="https://scholar.google.com/citations?user=P2w4iY4AAAAJ&hl=en"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-accent hover:bg-accent/90 text-white px-8 py-3">
                View All Publications
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Skills & Technologies */}
      <section id="skills" className="py-24 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-4">
              Skills & Technologies
            </h2>
            <p className="text-xl text-muted-foreground">
              Cutting-edge tools and frameworks for AI innovation
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Brain,
                title: "Agentic AI",
                skills: [
                  "LangGraph, CrewAI",
                  "MCP Servers",
                  "Agentic Tools",
                  "Multi-Agent Systems",
                ],
              },
              {
                icon: Bot,
                title: "Generative AI",
                skills: [
                  "OpenAI, Claude, Gemini",
                  "Llama, Mistral",
                  "LoRA, QLoRA",
                  "RAG, Chain-of-Thought",
                ],
              },
              {
                icon: Settings,
                title: "MLOps",
                skills: [
                  "Docker, AWS SageMaker",
                  "CI-CD Pipelines",
                  "VLLM, APIs",
                  "Model Monitoring",
                ],
              },
              {
                icon: Code,
                title: "Programming",
                skills: [
                  "Python, SQL, Bash",
                  "TensorFlow, PyTorch",
                  "Keras, Scikit-learn",
                  "Git, Jupyter",
                ],
              },
              {
                icon: Eye,
                title: "Computer Vision",
                skills: [
                  "CNNs, YOLO",
                  "Image Segmentation",
                  "Object Detection",
                  "Medical Imaging",
                ],
              },
              {
                icon: Users,
                title: "Leadership",
                skills: [
                  "Team Management",
                  "Mentoring",
                  "Cross-functional Collaboration",
                  "Stakeholder Engagement",
                ],
              },
            ].map((skillGroup, index) => (
              <div key={index} className="text-center">
                <div className="bg-accent/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <skillGroup.icon className="text-accent text-2xl w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-4">
                  {skillGroup.title}
                </h3>
                <div className="space-y-2 text-muted-foreground">
                  {skillGroup.skills.map((skill, skillIndex) => (
                    <p key={skillIndex}>{skill}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section
        id="contact"
        className="py-24 neural-bg relative overflow-hidden text-white"
      >
        <NeuralBackground />
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Get In Touch</h2>
            <p className="text-xl text-gray-300">
              Let's discuss how AI can transform your organization
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-bold mb-6">Contact Information</h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <Mail className="text-accent mr-4 w-5 h-5" />
                  <a
                    href={`mailto:${(data as any).personal?.email || "sai19872000@gmail.com"}`}
                    className="hover:text-accent transition-colors"
                  >
                    {(data as any).personal?.email || "sai19872000@gmail.com"}
                  </a>
                </div>
                <div className="flex items-center">
                  <Phone className="text-accent mr-4 w-5 h-5" />
                  <a
                    href={`tel:${(data as any).personal?.phone?.replace(/\s/g, "") || "+17408186309"}`}
                    className="hover:text-accent transition-colors"
                  >
                    {(data as any).personal?.phone || "740-818-6309"}
                  </a>
                </div>
                <div className="flex items-center">
                  <MapPin className="text-accent mr-4 w-5 h-5" />
                  <span>
                    {(data as any).personal?.location ||
                      "Lewis Center, Ohio, USA"}
                  </span>
                </div>
                <div className="flex items-center">
                  <Linkedin className="text-accent mr-4 w-5 h-5" />
                  <a
                    href={
                      (data as any).personal?.LinkedInUrl ||
                      "https://www.linkedin.com/in/sai-teja-pusuluri/"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent transition-colors"
                  >
                    LinkedIn Profile
                  </a>
                </div>
                <div className="flex items-center">
                  <Github className="text-accent mr-4 w-5 h-5" />
                  <a
                    href={
                      (data as any).personal?.GitHubUrl ||
                      "https://github.com/sai19872000"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent transition-colors"
                  >
                    GitHub Profile
                  </a>
                </div>
              </div>

              <div className="mt-8">
                <h4 className="text-lg font-semibold mb-4">
                  Areas of Expertise
                </h4>
                <ul className="space-y-2 text-gray-300">
                  <li>• Generative AI Strategy & Implementation</li>
                  <li>• Agentic AI Workflows</li>
                  <li>• MLOps & Production Deployment</li>
                  <li>• AI Team Leadership & Mentoring</li>
                  <li>• Research & Development</li>
                </ul>
              </div>
            </div>

            <div>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-gray-300 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold text-white mb-4">
                {(data as any).personal?.name || "Dr. Sai Teja Pusuluri"}
              </h3>
              <p className="text-gray-400 mb-4">
                {(data as any).personal?.bio ||
                  "Generative AI Expert passionate about transforming organizations through innovative AI solutions."}
              </p>
              <div className="flex space-x-4">
                <a
                  href="#"
                  className="text-gray-400 hover:text-accent transition-colors"
                >
                  <Linkedin className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  className="text-gray-400 hover:text-accent transition-colors"
                >
                  <Github className="w-5 h-5" />
                </a>
                <a
                  href={`mailto:${(data as any).personal?.email || "sai19872000@gmail.com"}`}
                  className="text-gray-400 hover:text-accent transition-colors"
                >
                  <Mail className="w-5 h-5" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">
                Quick Links
              </h4>
              <ul className="space-y-2">
                {[
                  "About",
                  "Skills",
                  "Experience",
                  "Projects",
                  "Publications",
                  "Contact",
                ].map((item) => (
                  <li key={item}>
                    <button
                      onClick={() => scrollToSection(item.toLowerCase())}
                      className="text-gray-400 hover:text-accent transition-colors"
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">
                Recent Focus
              </h4>
              <ul className="space-y-2 text-gray-400">
                <li>Agentic AI Workflows</li>
                <li>LLM Fine-tuning</li>
                <li>MLOps Best Practices</li>
                <li>AI Research & Innovation</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-500">
            <p>
              &copy; 2025{" "}
              {(data as any).personal?.name || "Dr. Sai Teja Pusuluri"}. All
              rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 bg-accent hover:bg-accent/90 text-white p-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 animate-bounce z-50"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

function getProjectImage(type: string): string {
  switch (type.toLowerCase()) {
    case "ai tool":
      return "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400";
    case "editor":
      return "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400";
    case "research":
      return "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400";
    case "fintech":
      return "https://images.unsplash.com/photo-1516110833967-0b5716ca1387?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400";
    case "healthcare":
      return "https://images.unsplash.com/photo-1555949963-aa79dcee981c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400";
    case "mlops":
      return "https://images.unsplash.com/photo-1555949963-aa79dcee981c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400";
    default:
      return "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400";
  }
}
