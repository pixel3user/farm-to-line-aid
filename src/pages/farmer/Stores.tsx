import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DatabaseService, Store } from '@/lib/database';
import { MapPin, Phone, RefreshCw, Users, Search, Plus, TrendingUp, Target, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

const storeStatuses: Store['status'][] = ['potential', 'contacted', 'customer', 'former_customer'];

const formatDate = (timestamp?: Timestamp) => {
  if (!timestamp) return '';
  try {
    return timestamp.toDate().toLocaleDateString();
  } catch (error) {
    console.error('Failed to format date:', error);
    return '';
  }
};

const FarmerStores: React.FC = () => {
  const { t } = useLanguage();
  const { userStores, refreshUserData } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Store['status']>('all');
  const [isUpdating, setIsUpdating] = useState(false);

  const stores = (userStores || []) as Store[];

  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      const matchesSearch = store.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || store.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [stores, searchTerm, statusFilter]);

  const statusSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    storeStatuses.forEach((status) => {
      summary[status] = stores.filter((store) => store.status === status).length;
    });
    return summary;
  }, [stores]);

  const handleStatusUpdate = async (store: Store, newStatus: Store['status']) => {
    if (store.status === newStatus) return;
    setIsUpdating(true);
    try {
      await DatabaseService.updateStore(store.id, {
        status: newStatus,
        metadata: {
          ...store.metadata,
          notes: store.metadata?.notes || []
        }
      });
      await refreshUserData();
    } catch (error) {
      console.error('Failed to update store status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold">{t('farmer.stores.title')}</h1>
            <p className="text-purple-100 text-lg">{t('farmer.stores.subtitle')}</p>
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-purple-300 rounded-full mr-2"></div>
                <span>{filteredStores.length} {t('farmer.stores.stores')}</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-300 rounded-full mr-2"></div>
                <span>{statusSummary.customer || 0} {t('farmer.stores.customers')}</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-300 rounded-full mr-2"></div>
                <span>{statusSummary.potential || 0} {t('farmer.stores.prospects')}</span>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
              <MapPin className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('farmer.stores.directory')}</h2>
          <p className="text-gray-600">{t('farmer.stores.directoryDescription')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => refreshUserData()}>
            <RefreshCw className="w-4 h-4 mr-2" /> {t('farmer.stores.refresh')}
          </Button>
          <Button size="sm" className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800">
            <Plus className="w-4 h-4 mr-2" /> {t('farmer.stores.addStore')}
          </Button>
        </div>
      </div>

      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            {t('farmer.stores.leadPipeline')}
          </CardTitle>
          <CardDescription className="text-base">{t('farmer.stores.pipelineDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {stores.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg mb-2">{t('farmer.stores.noStoresRecorded')}</p>
              <p className="text-sm text-gray-400">{t('farmer.stores.startAdding')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { status: 'potential', label: t('farmer.stores.prospects'), icon: Target, color: 'from-blue-500 to-blue-600', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
                { status: 'contacted', label: t('farmer.stores.contacted'), icon: Clock, color: 'from-yellow-500 to-yellow-600', bgColor: 'bg-yellow-50', textColor: 'text-yellow-600' },
                { status: 'customer', label: t('farmer.stores.customers'), icon: CheckCircle, color: 'from-green-500 to-green-600', bgColor: 'bg-green-50', textColor: 'text-green-600' },
                { status: 'former_customer', label: t('farmer.stores.former'), icon: XCircle, color: 'from-gray-500 to-gray-600', bgColor: 'bg-gray-50', textColor: 'text-gray-600' }
              ].map(({ status, label, icon: Icon, color, bgColor, textColor }) => (
                <div key={status} className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-100 rounded-xl p-6 hover:border-gray-200 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${textColor}`} />
                    </div>
                    <span className="text-3xl font-bold text-gray-900">{statusSummary[status] || 0}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">{label}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                    <div 
                      className={`bg-gradient-to-r ${color} h-2 rounded-full transition-all duration-300`}
                      style={{ width: `${stores.length > 0 ? ((statusSummary[status] || 0) / stores.length) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            {t('farmer.stores.directory')}
          </CardTitle>
          <CardDescription className="text-base">All stores linked to your account with real-time updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="relative w-full lg:w-80">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder={t('farmer.stores.searchPlaceholder')}
                className="pl-10 h-11"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="w-48 h-11">
                <SelectValue placeholder={t('farmer.stores.filterByStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('farmer.stores.allStatus')}</SelectItem>
                {storeStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-6">
            {filteredStores.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">{t('farmer.stores.noStoresMatch')}</p>
                <p className="text-sm text-gray-400 mt-2">{t('farmer.stores.tryAdjusting')}</p>
              </div>
            ) : (
              filteredStores.map((store) => (
                <div key={store.id} className="bg-gradient-to-r from-white to-gray-50 border-2 border-gray-100 rounded-xl p-6 hover:border-gray-200 transition-all duration-300">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                          <MapPin className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900">{store.name}</h3>
                          <p className="text-gray-600 mt-1">{store.location}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            {store.contact?.phone && (
                              <div className="flex items-center">
                                <Phone className="w-4 h-4 mr-2" />
                                {store.contact.phone}
                              </div>
                            )}
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 mr-2" />
                              {store.type.replace('_', ' ').charAt(0).toUpperCase() + store.type.replace('_', ' ').slice(1)}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">{t('farmer.stores.firstContact')}</span>
                            <span className="font-medium">{formatDate(store.metadata?.firstContact)}</span>
                          </div>
                          {store.metadata?.lastOrder && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">{t('farmer.stores.lastOrder')}</span>
                              <span className="font-medium">{formatDate(store.metadata.lastOrder)}</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">{t('farmer.stores.totalOrders')}</span>
                            <span className="font-semibold text-blue-600">{store.metadata?.totalOrders || 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">{t('farmer.stores.revenue')}</span>
                            <span className="font-semibold text-green-600">NT$ {(store.metadata?.totalRevenue || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end space-y-4">
                      <Badge 
                        variant="secondary" 
                        className={`capitalize px-3 py-1 ${
                          store.status === 'customer' ? 'bg-green-100 text-green-700' :
                          store.status === 'contacted' ? 'bg-yellow-100 text-yellow-700' :
                          store.status === 'potential' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {store.status.replace('_', ' ')}
                      </Badge>
                      
                      <Select
                        value={store.status}
                        onValueChange={(value) => handleStatusUpdate(store, value as Store['status'])}
                        disabled={isUpdating}
                      >
                        <SelectTrigger className="w-48 h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {storeStatuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {store.metadata?.notes && store.metadata.notes.length > 0 && (
                    <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg">
                      <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <Users className="w-4 h-4 mr-2" />
                        {t('farmer.stores.notes')}
                      </p>
                      <ul className="text-sm text-gray-600 space-y-2">
                        {store.metadata.notes.map((note, index) => (
                          <li key={index} className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FarmerStores;
