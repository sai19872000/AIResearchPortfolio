import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { insertContactMessageSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { z } from "zod";

type ContactFormData = z.infer<typeof insertContactMessageSchema>;

export function ContactForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(insertContactMessageSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const response = await apiRequest("POST", "/api/contact", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Message Sent!",
        description: data.message,
      });
      form.reset();
      setIsSubmitting(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: ContactFormData) => {
    setIsSubmitting(true);
    submitMutation.mutate(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <Label htmlFor="name" className="block text-sm font-medium mb-2 text-white">
          Name
        </Label>
        <Input
          id="name"
          {...form.register("name")}
          className="bg-white/10 border-white/20 text-white placeholder:text-gray-300 focus:border-accent"
          placeholder="Your full name"
        />
        {form.formState.errors.name && (
          <p className="text-red-400 text-sm mt-1">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="email" className="block text-sm font-medium mb-2 text-white">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          {...form.register("email")}
          className="bg-white/10 border-white/20 text-white placeholder:text-gray-300 focus:border-accent"
          placeholder="your.email@example.com"
        />
        {form.formState.errors.email && (
          <p className="text-red-400 text-sm mt-1">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="subject" className="block text-sm font-medium mb-2 text-white">
          Subject
        </Label>
        <Input
          id="subject"
          {...form.register("subject")}
          className="bg-white/10 border-white/20 text-white placeholder:text-gray-300 focus:border-accent"
          placeholder="How can I help you?"
        />
        {form.formState.errors.subject && (
          <p className="text-red-400 text-sm mt-1">
            {form.formState.errors.subject.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="message" className="block text-sm font-medium mb-2 text-white">
          Message
        </Label>
        <Textarea
          id="message"
          {...form.register("message")}
          rows={5}
          className="bg-white/10 border-white/20 text-white placeholder:text-gray-300 focus:border-accent resize-none"
          placeholder="Tell me about your AI project or challenge..."
        />
        {form.formState.errors.message && (
          <p className="text-red-400 text-sm mt-1">
            {form.formState.errors.message.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-accent hover:bg-accent/90 text-white"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Sending...
          </>
        ) : (
          "Send Message"
        )}
      </Button>
    </form>
  );
}
