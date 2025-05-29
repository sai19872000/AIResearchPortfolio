import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactMessageSchema } from "@shared/schema";
import { z } from "zod";
import fs from "fs";
import path from "path";

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
      // Load content from JSON configuration file
      const contentPath = path.join(process.cwd(), "portfolio-content.json");
      const portfolioData = JSON.parse(fs.readFileSync(contentPath, "utf-8"));
      res.json(portfolioData);
    } catch (error) {
      console.error("Portfolio data error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to load portfolio data" 
      });
    }
  });

  // Resume download endpoint
  app.get("/api/resume", (req, res) => {
    try {
      const resumePath = path.join(process.cwd(), "attached_assets", "resume_pusuluri_may25.pdf");
      
      if (!fs.existsSync(resumePath)) {
        return res.status(404).json({ 
          success: false, 
          message: "Resume file not found" 
        });
      }

      // Set appropriate headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Sai_Teja_Pusuluri_Resume.pdf"');
      
      // Stream the file
      const fileStream = fs.createReadStream(resumePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Resume download error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to download resume" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
