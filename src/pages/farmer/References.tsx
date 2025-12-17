import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { featureFlags } from '@/config/featureFlags';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  BookOpen, 
  Clock, 
  Target, 
  Smartphone, 
  QrCode,
  ExternalLink,
  HelpCircle,
  MessageSquare,
  Shield,
  Users
} from 'lucide-react';

const FarmerReferences: React.FC = () => {
  const { t } = useLanguage();
  const [activeModal, setActiveModal] = useState<string | null>(null);

  if (!featureFlags.references) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('references.title') || 'References'}</CardTitle>
          <CardDescription>Reference materials are hidden for the current demo build.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          Reach out if you need access to the compliance and LINE integration guides sooner.
        </CardContent>
      </Card>
    );
  }

  const referenceItems = [
    {
      id: 'quiet-hours',
      title: t('farmer.references.quietHoursTitle'),
      description: t('farmer.references.quietHoursDescription'),
      icon: Clock,
      color: 'bg-blue-500'
    },
    {
      id: 'lead-scoring',
      title: t('farmer.references.leadScoringTitle'),
      description: t('farmer.references.leadScoringDescription'),
      icon: Target,
      color: 'bg-green-500'
    },
    {
      id: 'line-bot',
      title: t('farmer.references.lineBotTitle'),
      description: t('farmer.references.lineBotDescription'),
      icon: Smartphone,
      color: 'bg-green-600'
    }
  ];

  const QuietHoursModal = () => (
    <Dialog open={activeModal === 'quiet-hours'} onOpenChange={() => setActiveModal(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            {t('farmer.references.quietHoursGuidelines')}
          </DialogTitle>
          <DialogDescription>
            {t('farmer.references.bestPractices')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">{t('farmer.references.quietHours')}</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>{t('farmer.references.noOutreachMessages')}</strong></li>
              <li>• <strong>{t('farmer.references.weekendsLimited')}</strong></li>
              <li>• <strong>{t('farmer.references.holidaysRespect')}</strong></li>
            </ul>
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-900 mb-2">{t('farmer.references.consentRequirements')}</h4>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• {t('farmer.references.includeOptOut')}</li>
              <li>• {t('farmer.references.respectNoResponses')}</li>
              <li>• {t('farmer.references.limitOneMessage')}</li>
              <li>• {t('farmer.references.provideClearContact')}</li>
            </ul>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">{t('farmer.references.professionalCommunication')}</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• {t('farmer.references.useFormalLanguage')}</li>
              <li>• {t('farmer.references.includeFarmName')}</li>
              <li>• {t('farmer.references.beTransparent')}</li>
              <li>• {t('farmer.references.respondWithin24Hours')}</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const LeadScoringModal = () => (
    <Dialog open={activeModal === 'lead-scoring'} onOpenChange={() => setActiveModal(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Target className="w-5 h-5 mr-2" />
            {t('farmer.references.leadScoringAlgorithm')}
          </DialogTitle>
          <DialogDescription>
            {t('farmer.references.calculatesLeadScores')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">{t('farmer.references.scoringFactors')}</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>{t('farmer.references.distanceFromFarm')}</span>
                <span className="font-medium">0-30 {t('farmer.references.points')}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('farmer.references.storeRatingReputation')}</span>
                <span className="font-medium">0-25 {t('farmer.references.points')}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('farmer.references.productCategoryMatch')}</span>
                <span className="font-medium">0-20 {t('farmer.references.points')}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('farmer.references.previousInteractionHistory')}</span>
                <span className="font-medium">0-15 {t('farmer.references.points')}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('farmer.references.businessSizeIndicators')}</span>
                <span className="font-medium">0-10 {t('farmer.references.points')}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">0-40</div>
              <div className="text-sm text-red-800">{t('farmer.references.lowPriority')}</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">41-70</div>
              <div className="text-sm text-yellow-800">{t('farmer.references.mediumPriority')}</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">71-100</div>
              <div className="text-sm text-green-800">{t('farmer.references.highPriority')}</div>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>{t('farmer.references.note')}</strong> {t('farmer.references.demoAlgorithm')}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const LineBotModal = () => (
    <Dialog open={activeModal === 'line-bot'} onOpenChange={() => setActiveModal(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Smartphone className="w-5 h-5 mr-2" />
            {t('farmer.references.lineBotQuickStart')}
          </DialogTitle>
          <DialogDescription>
            {t('farmer.references.getStartedLineIntegration')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div>
                <h4 className="font-medium">{t('farmer.references.setupLineBot')}</h4>
                <p className="text-sm text-gray-600">
                  {t('farmer.references.createLineBotAccount')}
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                2
              </div>
              <div>
                <h4 className="font-medium">{t('farmer.references.configureWebhook')}</h4>
                <p className="text-sm text-gray-600">
                  {t('farmer.references.setupWebhookUrl')}
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <div>
                <h4 className="font-medium">{t('farmer.references.createRichMenu')}</h4>
                <p className="text-sm text-gray-600">
                  {t('farmer.references.designBotMenu')}
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                4
              </div>
              <div>
                <h4 className="font-medium">{t('farmer.references.testWithQrCode')}</h4>
                <p className="text-sm text-gray-600">
                  {t('farmer.references.generateQrCode')}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-900 mb-2">{t('farmer.references.demoQrCode')}</h4>
            <div className="flex items-center space-x-4">
              <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                <QrCode className="w-12 h-12 text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-green-800">
                  {t('farmer.references.scanQrCode')}
                </p>
                <Button size="sm" className="mt-2">
                  <ExternalLink className="w-4 h-4 mr-1" />
                  {t('farmer.references.openInLine')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('farmer.references.title')}</h1>
        <p className="text-gray-600">{t('farmer.references.subtitle')}</p>
      </div>

      {/* Reference Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {referenceItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className={`w-12 h-12 ${item.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setActiveModal(item.id)}
                    >
                      <HelpCircle className="w-4 h-4 mr-1" />
                      {t('farmer.references.learnMore')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* LINE Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Smartphone className="w-5 h-5 mr-2" />
            {t('farmer.references.lineIntegration')}
          </CardTitle>
          <CardDescription>
            {t('farmer.references.connectFarmBusiness')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium">{t('farmer.references.quickActions')}</h4>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {t('farmer.references.openInLine')}
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <QrCode className="w-4 h-4 mr-2" />
                  {t('farmer.references.generateQrCode')}
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {t('farmer.references.viewBotSettings')}
                </Button>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium">{t('farmer.references.botStatus')}</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t('farmer.references.botStatus')}</span>
                  <Badge variant="default">{t('farmer.references.active')}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t('farmer.references.usersConnected')}</span>
                  <span className="text-sm font-medium">0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t('farmer.references.messagesSent')}</span>
                  <span className="text-sm font-medium">0</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Safety & Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            {t('farmer.references.safetyCompliance')}
          </CardTitle>
          <CardDescription>
            {t('farmer.references.importantGuidelines')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-green-900">{t('farmer.references.dos')}</h4>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• {t('farmer.references.respectQuietHours')}</li>
                <li>• {t('farmer.references.includeOptOutInstructions')}</li>
                <li>• {t('farmer.references.useProfessionalLanguage')}</li>
                <li>• {t('farmer.references.provideClearContactInfo')}</li>
                <li>• {t('farmer.references.respondToInquiriesPromptly')}</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-red-900">{t('farmer.references.donts')}</h4>
              <ul className="text-sm text-red-800 space-y-1">
                <li>• {t('farmer.references.sendMessagesDuringQuietHours')}</li>
                <li>• {t('farmer.references.spamOrSendTooFrequently')}</li>
                <li>• {t('farmer.references.ignoreNoResponses')}</li>
                <li>• {t('farmer.references.useAggressiveSalesTactics')}</li>
                <li>• {t('farmer.references.sharePersonalInformation')}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <QuietHoursModal />
      <LeadScoringModal />
      <LineBotModal />
    </div>
  );
};

export default FarmerReferences;
