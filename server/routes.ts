import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactMessageSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Contact form submission endpoint
  app.post("/api/contact", async (req, res) => {
    try {
      const validatedData = insertContactMessageSchema.parse(req.body);
      const message = await storage.createContactMessage(validatedData);
      
      // In a real application, you would send an email here
      // For now, we'll just store the message and return success
      console.log(`New contact message from ${message.email}: ${message.subject}`);
      
      res.json({ 
        success: true, 
        message: "Thank you for your message! I will get back to you soon." 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid form data", 
          errors: error.errors 
        });
      }
      
      console.error("Contact form error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to send message. Please try again." 
      });
    }
  });

  // Get portfolio data endpoint
  app.get("/api/portfolio", async (req, res) => {
    try {
      const portfolioData = {
        personal: {
          name: "Sai Teja Pusuluri",
          title: "Generative AI Expert",
          location: "Lewis Center, Ohio, USA",
          phone: "+1 740-818-6309",
          email: "sai19872000@gmail.com",
          overview: "PhD in Physics with over 8 years of industry experience in Generative AI, Agentic AI Workflows, Traditional ML/AI and MLOps. Proven track record of leading cross-functional teams, driving innovation, and delivering scalable AI solutions."
        },
        education: {
          degree: "Ph.D. Physics (Neural networks)",
          institution: "Ohio University, Athens, Ohio",
          period: "Aug. 2011 - Feb. 2017",
          gpa: "3.86/4"
        },
        skills: {
          agenticAI: ["Agentic Tools", "MCP servers", "LangGraph", "CrewAI", "Multi-Agent Systems"],
          generativeAI: ["Transformer models", "Gemini", "Claude", "OpenAI", "Llama", "Mistral", "RAG", "Chain-of-Thought"],
          mlops: ["Docker", "AWS SageMaker", "Amazon ECR", "CI-CD", "APIs", "VLLMs", "Python", "TensorFlow", "PyTorch", "Keras", "SQL", "Bash"],
          leadership: ["Team Management", "Mentoring", "Cross-functional Collaboration", "Stakeholder Engagement"]
        },
        experience: [
          {
            title: "Manager/Lead - Generative AI",
            company: "Discover",
            period: "Apr. 2022 - Present",
            achievements: [
              "Pioneered agentic AI workflows, automating customer experience and operational processes and generating comprehensive model documentation via LLM pipelines, resulting in a 75% reduction in manual effort",
              "Fine-tuned LLMs for company-specific datasets: applied LoRA, QLoRA, and quantization techniques to enhance local inference throughput by 40% and reduce GPU memory usage by 25%",
              "Implemented VLLM-based inference optimization, boosting custom LLM throughput by 50% and slashing latency for production endpoints",
              "Mentor and Lead a team of 5 direct and 10 indirect reports, cultivating talent and ensuring delivery of high-impact AI solutions",
              "Designed and maintained robust MLOps pipelines with CI-CD, monitoring, and custom API endpoints"
            ]
          },
          {
            title: "Senior Applied AI - ML Associate",
            company: "JP Morgan Chase",
            period: "Apr. 2017 - Apr. 2022",
            achievements: [
              "Developed fraud detection AI/ML models, significantly enhancing the bank's ability to identify and mitigate fraudulent activities",
              "Engineered advanced feature extraction and seasonality methods, refining predictive capabilities and improving model reliability",
              "Researched and implemented scalable neural network and NLP solutions (CNNs, LSTMs, BERT)",
              "Compiled comprehensive technical documentation for end-to-end model development pipelines"
            ]
          },
          {
            title: "Adjunct Professor",
            company: "Ohio University",
            period: "Nov. 2023 - Present",
            achievements: [
              "Researched and taught advanced computer vision and segmentation methods for organoids",
              "Developed agentic AI research workflows, automating dataset curation and model retraining",
              "Deployed reproducible research environments using Docker, AWS SageMaker, and ECR",
              "Developed a tri-agent fallback system, boosting YOLO-like detection recall"
            ]
          }
        ],
        projects: [
          {
            title: "AI Citation Builder",
            description: "Engineered an agentic AI flow with UI that ingests manuscript sections, autonomously searches academic databases and the web, and generates formatted citations, streamlining literature reviews.",
            technologies: ["Agentic AI", "NLP", "Web Scraping"],
            period: "Jan. 2025 - Present",
            type: "AI Tool"
          },
          {
            title: "Smart Latex Editor",
            description: "Engineered an agentic AI flow with UI that takes custom instructions from users and makes edits to LaTeX files. Implemented smart edit and generate capabilities with equation conversion.",
            technologies: ["LaTeX", "AI Editor", "Code Generation"],
            period: "Jan. 2025 - Present",
            type: "Editor"
          },
          {
            title: "Organoid Segmentation",
            description: "Advanced computer vision methods for automated morphological analysis of brain organoids, contributing to cutting-edge biological research.",
            technologies: ["Computer Vision", "Biology", "Research"],
            period: "2023 - Present",
            type: "Research"
          },
          {
            title: "Fraud Detection System",
            description: "Advanced AI/ML models for fraud detection at JP Morgan Chase, significantly enhancing the bank's ability to identify and mitigate fraudulent activities.",
            technologies: ["Deep Learning", "Security", "FinTech"],
            period: "2017 - 2022",
            type: "FinTech"
          }
        ],
        publications: [
          {
            title: "Studying Brain Organoids Survival rates using automated segmentation methods",
            authors: "Pusuluri et.al.",
            journal: "2025 (to be submitted)",
            status: "pending"
          },
          {
            title: "Electrophysiological maturation of cerebral organoids correlates with dynamic morphological and cellular development",
            authors: "Pusuluri et.al.",
            journal: "Stem cell reports 15 (4), 855-868, 2020",
            status: "published"
          },
          {
            title: "Cellular reprogramming dynamics follow a simple one-dimensional reaction coordinate",
            authors: "Pusuluri et.al.",
            journal: "Physical Biology 10.1088/1478-3975/aa90e0, 2017",
            status: "published"
          },
          {
            title: "Role of deoxy group on the high concentration of graphene in surfactant/water media",
            authors: "Pusuluri et.al.",
            journal: "Royal Society of Chemistry (RSC Advances), 2012",
            status: "published"
          }
        ]
      };

      res.json(portfolioData);
    } catch (error) {
      console.error("Portfolio data error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to load portfolio data" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
