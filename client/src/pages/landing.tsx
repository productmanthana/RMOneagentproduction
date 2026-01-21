import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, MessageSquare, Zap, Shield, ArrowRight } from "lucide-react";

export default function LandingPage() {
  const [, setLocation] = useLocation();

  const handleSignIn = () => {
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#3A4A57] flex items-center justify-center">
              <Database className="w-6 h-6 text-[#8BC34A]" />
            </div>
            <span className="text-xl font-bold text-[#3A4A57]">RMOne AI Agents</span>
          </div>
          <Button
            onClick={handleSignIn}
            className="bg-[#8BC34A] hover:bg-[#7CB342] text-white"
            data-testid="button-login-header"
          >
            Sign In
          </Button>
        </div>
      </header>

      <main>
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl font-bold text-[#3A4A57] mb-6">
              RMOne Proprietor LLM AI Agents
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Ask questions in plain English and get instant insights from your project data.
              No technical knowledge required.
            </p>
            <Button
              onClick={handleSignIn}
              size="lg"
              className="bg-[#8BC34A] hover:bg-[#7CB342] text-white text-lg px-8 py-6"
              data-testid="button-get-started"
            >
              Get Started <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </section>

        <section className="py-16 px-6 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-[#3A4A57] mb-12">
              Features
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="border-none shadow-md">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-[#8BC34A]/10 flex items-center justify-center mb-4">
                    <MessageSquare className="w-6 h-6 text-[#8BC34A]" />
                  </div>
                  <CardTitle className="text-[#3A4A57]">Natural Language Queries</CardTitle>
                </CardHeader>
                <CardContent className="text-gray-600">
                  Ask questions like "Show me all large active projects" and get accurate results instantly.
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-[#8BC34A]/10 flex items-center justify-center mb-4">
                    <Zap className="w-6 h-6 text-[#8BC34A]" />
                  </div>
                  <CardTitle className="text-[#3A4A57]">Instant AI Analysis</CardTitle>
                </CardHeader>
                <CardContent className="text-gray-600">
                  Get AI-powered insights and summaries of your query results with contextual follow-up questions.
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-[#8BC34A]/10 flex items-center justify-center mb-4">
                    <Shield className="w-6 h-6 text-[#8BC34A]" />
                  </div>
                  <CardTitle className="text-[#3A4A57]">Persistent Chat History</CardTitle>
                </CardHeader>
                <CardContent className="text-gray-600">
                  Your conversations are saved to your account and accessible from any device.
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-[#3A4A57] mb-6">
              Ready to explore your data?
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Sign in to start asking questions with natural language.
            </p>
            <Button
              onClick={handleSignIn}
              size="lg"
              className="bg-[#3A4A57] hover:bg-[#4A5A67] text-white text-lg px-8 py-6"
              data-testid="button-sign-in-bottom"
            >
              Sign In to Get Started
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-6">
        <div className="max-w-7xl mx-auto text-center text-gray-500">
          <p>RMOne Proprietor LLM AI Agents</p>
        </div>
      </footer>
    </div>
  );
}
