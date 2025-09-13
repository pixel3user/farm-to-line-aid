import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, ImageIcon, Users, Calendar, Handshake, ArrowRight, Camera, Megaphone, Search, Clock } from "lucide-react";

export const AIBrainVisualization = () => {
  const agents = [
    {
      id: 1,
      name: "Marketing Agent",
      icon: <ImageIcon className="h-8 w-8 text-blue-500" />,
      description: "Transforms simple photos into professional marketing materials",
      features: [
        "Image cleanup & enhancement",
        "Professional flyer creation",
        "Bilingual social media posts",
        "Brand-consistent designs"
      ],
      inputIcon: <Camera className="h-5 w-5" />,
      outputIcon: <Megaphone className="h-5 w-5" />,
      color: "bg-blue-50 border-blue-200"
    },
    {
      id: 2,
      name: "Outreach Agent",
      icon: <Users className="h-8 w-8 text-green-500" />,
      description: "Intelligently identifies and contacts potential buyers",
      features: [
        "Target identification (supermarkets, restaurants)",
        "Automated intro messages",
        "Product info sharing",
        "Lead qualification"
      ],
      inputIcon: <Search className="h-5 w-5" />,
      outputIcon: <Users className="h-5 w-5" />,
      color: "bg-green-50 border-green-200"
    },
    {
      id: 3,
      name: "Scheduler",
      icon: <Calendar className="h-8 w-8 text-purple-500" />,
      description: "Predicts customer buying patterns and prevents missed sales",
      features: [
        "Customer buying rhythm analysis",
        "Low inventory predictions",
        "Proactive sales nudges",
        "Timing optimization"
      ],
      inputIcon: <Clock className="h-5 w-5" />,
      outputIcon: <Calendar className="h-5 w-5" />,
      color: "bg-purple-50 border-purple-200"
    },
    {
      id: 4,
      name: "Deal Handler",
      icon: <Handshake className="h-8 w-8 text-orange-500" />,
      description: "Manages negotiations within farmer-defined parameters",
      features: [
        "Price floor enforcement",
        "Minimum order management",
        "Automated negotiations",
        "Deal closing assistance"
      ],
      inputIcon: <Handshake className="h-5 w-5" />,
      outputIcon: <Handshake className="h-5 w-5" />,
      color: "bg-orange-50 border-orange-200"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Brain className="h-12 w-12 text-primary" />
          <h1 className="text-4xl font-bold text-foreground">AI Brain System</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          The Agentic AI Core - A team of specialized AI agents working on the farmer's behalf
        </p>
      </div>

      {/* Central Brain Visualization */}
      <div className="relative">
        <Card className="max-w-md mx-auto bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Brain className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl">Agentic AI Core</CardTitle>
            <CardDescription>
              Coordinating specialized agents for optimal farm business management
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {agents.map((agent) => (
          <Card key={agent.id} className={`${agent.color} transition-all duration-300 hover:shadow-lg`}>
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  {agent.icon}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">{agent.name}</CardTitle>
                  <CardDescription className="mt-2">
                    {agent.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Input/Output Flow */}
              <div className="flex items-center justify-between p-3 bg-white/50 rounded-lg">
                <div className="flex items-center gap-2">
                  {agent.inputIcon}
                  <span className="text-sm font-medium">Input</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  {agent.outputIcon}
                  <span className="text-sm font-medium">Output</span>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Key Capabilities
                </h4>
                <div className="grid gap-2">
                  {agent.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-current rounded-full opacity-60" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Process Flow */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-center text-2xl">How They Work Together</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <h4 className="font-medium">Capture</h4>
              <p className="text-sm text-muted-foreground">
                Marketing Agent processes photos into professional materials
              </p>
            </div>
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-green-600 font-bold">2</span>
              </div>
              <h4 className="font-medium">Reach</h4>
              <p className="text-sm text-muted-foreground">
                Outreach Agent finds and contacts potential customers
              </p>
            </div>
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <h4 className="font-medium">Time</h4>
              <p className="text-sm text-muted-foreground">
                Scheduler predicts optimal timing for customer engagement
              </p>
            </div>
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-orange-600 font-bold">4</span>
              </div>
              <h4 className="font-medium">Close</h4>
              <p className="text-sm text-muted-foreground">
                Deal Handler manages negotiations and finalizes sales
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};