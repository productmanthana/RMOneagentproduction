import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Phone, Mail, MessageSquare, CheckCircle, XCircle, Clock } from "lucide-react";

interface TwilioStatus {
  configured: boolean;
  accountSid: string;
  authToken: string;
  sendgridApiKey: string;
  message: string;
}

export default function ConversationsPage() {
  const { data: statusData } = useQuery<TwilioStatus>({
    queryKey: ['/api/twilio/status'],
  });

  const configured = statusData?.configured || false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2" data-testid="text-page-title">
            Multi-Channel Messaging
          </h1>
          <p className="text-slate-300" data-testid="text-page-description">
            Manage conversations across Email, SMS, and WhatsApp
          </p>
        </div>

        <div className="grid gap-6 mb-8">
          <Card data-testid="card-twilio-status">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {configured ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                Twilio Conversations Status
              </CardTitle>
              <CardDescription>
                {configured 
                  ? 'Your chatbot is ready to receive messages from Email, SMS, and WhatsApp!'
                  : 'Configure Twilio credentials to enable multi-channel messaging'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2" data-testid="status-account-sid">
                  <Badge variant={statusData?.accountSid?.includes('✓') ? 'default' : 'destructive'}>
                    {statusData?.accountSid || '✗ Missing'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">Account SID</span>
                </div>
                <div className="flex items-center gap-2" data-testid="status-auth-token">
                  <Badge variant={statusData?.authToken?.includes('✓') ? 'default' : 'destructive'}>
                    {statusData?.authToken || '✗ Missing'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">Auth Token</span>
                </div>
                <div className="flex items-center gap-2" data-testid="status-sendgrid">
                  <Badge variant={statusData?.sendgridApiKey?.includes('✓') ? 'default' : 'destructive'}>
                    {statusData?.sendgridApiKey || '✗ Missing'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">SendGrid API Key</span>
                </div>
              </div>

              {!configured && (
                <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-sm text-yellow-200">
                    ⚠️ Add your Twilio credentials to environment secrets to enable multi-channel messaging.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-channel-overview">
            <CardHeader>
              <CardTitle>Supported Channels</CardTitle>
              <CardDescription>Your chatbot can answer questions through these channels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg hover-elevate" data-testid="card-channel-sms">
                  <Phone className="w-8 h-8 mb-2 text-blue-500" />
                  <h3 className="font-semibold mb-1">SMS</h3>
                  <p className="text-sm text-muted-foreground">
                    Text your questions to your Twilio phone number
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    Global Coverage
                  </Badge>
                </div>

                <div className="p-4 border rounded-lg hover-elevate" data-testid="card-channel-whatsapp">
                  <MessageSquare className="w-8 h-8 mb-2 text-green-500" />
                  <h3 className="font-semibold mb-1">WhatsApp</h3>
                  <p className="text-sm text-muted-foreground">
                    Chat via WhatsApp Business API
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    Rich Media Support
                  </Badge>
                </div>

                <div className="p-4 border rounded-lg hover-elevate" data-testid="card-channel-email">
                  <Mail className="w-8 h-8 mb-2 text-purple-500" />
                  <h3 className="font-semibold mb-1">Email</h3>
                  <p className="text-sm text-muted-foreground">
                    Email your questions with detailed responses
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    HTML Formatting
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-setup-instructions">
            <CardHeader>
              <CardTitle>Setup Instructions</CardTitle>
              <CardDescription>Configure your Twilio Conversations webhook</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="webhook" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="webhook" data-testid="tab-webhook">Webhook URL</TabsTrigger>
                  <TabsTrigger value="testing" data-testid="tab-testing">Testing</TabsTrigger>
                  <TabsTrigger value="production" data-testid="tab-production">Production</TabsTrigger>
                </TabsList>

                <TabsContent value="webhook" className="space-y-4">
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <h4 className="font-semibold mb-2">Webhook Configuration</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add this webhook URL to your Twilio Conversations configuration:
                    </p>
                    <code className="block p-3 bg-black/50 rounded text-sm break-all" data-testid="text-webhook-url">
                      {window.location.origin}/webhook/twilio/conversations
                    </code>
                    <p className="text-xs text-muted-foreground mt-4">
                      📝 In Twilio Console → Conversations → Manage → Webhooks → Post-Event URL
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="testing" className="space-y-4">
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <h4 className="font-semibold mb-2">WhatsApp Sandbox (FREE)</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                      <li>Go to Twilio Console → Messaging → Try it out → WhatsApp</li>
                      <li>Join the sandbox by sending the join code to the sandbox number</li>
                      <li>Ask questions like "What are the highest fee projects?"</li>
                      <li>Get instant AI-powered responses!</li>
                    </ol>
                  </div>

                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <h4 className="font-semibold mb-2">SMS Testing</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                      <li>Buy a Twilio phone number (~$1/month)</li>
                      <li>Text your questions to that number</li>
                      <li>Receive formatted responses with data insights</li>
                    </ol>
                  </div>
                </TabsContent>

                <TabsContent value="production" className="space-y-4">
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <h4 className="font-semibold mb-2">WhatsApp Business API</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                      <li>Register your business with Meta</li>
                      <li>Request WhatsApp Business API access</li>
                      <li>Complete verification (5-20 days)</li>
                      <li>Connect your number to Twilio</li>
                    </ol>
                    <Badge variant="outline" className="mt-2">
                      <Clock className="w-3 h-3 mr-1" />
                      5-20 days approval time
                    </Badge>
                  </div>

                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <h4 className="font-semibold mb-2">Email Integration</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                      <li>Configure SendGrid inbound parse webhook</li>
                      <li>Set up custom domain for email receiving</li>
                      <li>Users can email questions directly</li>
                      <li>Responses include formatted tables and charts</li>
                    </ol>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card data-testid="card-example-queries">
            <CardHeader>
              <CardTitle>Example Queries</CardTitle>
              <CardDescription>Try these questions via SMS, WhatsApp, or Email</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {[
                    'What are the highest fee projects?',
                    'Show me all active projects',
                    'List projects with win rate above 80%',
                    'What is the average project fee?',
                    'Show projects from 2024',
                    'Which companies have the most projects?',
                    'Give me top 5 projects by total fee',
                  ].map((query, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-3 bg-slate-800/30 rounded-lg" data-testid={`example-query-${idx}`}>
                      <Badge variant="outline" className="mt-0.5">{idx + 1}</Badge>
                      <span className="text-sm">{query}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
