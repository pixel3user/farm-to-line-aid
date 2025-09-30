import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Upload, Camera, CheckCircle, AlertCircle } from 'lucide-react';

interface SupplyFormData {
  product: string;
  grade: string;
  quantity: string;
  unit: string;
  priceFloor: string;
  targetPrice: string;
  harvestWindow: string;
  location: string;
  description: string;
  photos: File[];
  certificates: File[];
}

const SupplyForm: React.FC = () => {
  const [formData, setFormData] = useState<SupplyFormData>({
    product: '',
    grade: '',
    quantity: '',
    unit: 'kg',
    priceFloor: '',
    targetPrice: '',
    harvestWindow: '',
    location: '',
    description: '',
    photos: [],
    certificates: []
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleInputChange = (field: keyof SupplyFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (field: 'photos' | 'certificates', files: FileList | null) => {
    if (files) {
      setFormData(prev => ({
        ...prev,
        [field]: Array.from(files)
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Here you would send the data to your backend
      console.log('Supply form submitted:', formData);
      
      setSubmitStatus('success');
    } catch (error) {
      console.error('Error submitting supply form:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitStatus === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-700 mb-2">供應請求已提交！</h2>
            <p className="text-gray-600 mb-4">
              您的供應請求已成功提交。AI 正在分析您的產品並準備推廣材料。
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              <p>📊 AI 分析中...</p>
              <p>🎨 生成行銷素材...</p>
              <p>🔍 尋找潛在買家...</p>
            </div>
            <Button 
              className="w-full mt-6" 
              onClick={() => setSubmitStatus('idle')}
            >
              建立新的供應請求
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-6 h-6 text-green-600" />
            建立供應請求
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Product Information */}
            <div className="space-y-2">
              <Label htmlFor="product">產品名稱 *</Label>
              <Input
                id="product"
                value={formData.product}
                onChange={(e) => handleInputChange('product', e.target.value)}
                placeholder="例如：有機番茄"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="grade">等級</Label>
                <Select value={formData.grade} onValueChange={(value) => handleInputChange('grade', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇等級" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="premium">特級</SelectItem>
                    <SelectItem value="grade-a">A級</SelectItem>
                    <SelectItem value="grade-b">B級</SelectItem>
                    <SelectItem value="standard">標準</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">單位</Label>
                <Select value={formData.unit} onValueChange={(value) => handleInputChange('unit', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">公斤</SelectItem>
                    <SelectItem value="ton">公噸</SelectItem>
                    <SelectItem value="box">箱</SelectItem>
                    <SelectItem value="piece">個</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">數量 *</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => handleInputChange('quantity', e.target.value)}
                placeholder="例如：100"
                required
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceFloor">底價 (NT$/unit) *</Label>
                <Input
                  id="priceFloor"
                  type="number"
                  value={formData.priceFloor}
                  onChange={(e) => handleInputChange('priceFloor', e.target.value)}
                  placeholder="例如：50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetPrice">目標價格 (NT$/unit)</Label>
                <Input
                  id="targetPrice"
                  type="number"
                  value={formData.targetPrice}
                  onChange={(e) => handleInputChange('targetPrice', e.target.value)}
                  placeholder="例如：80"
                />
              </div>
            </div>

            {/* Harvest & Location */}
            <div className="space-y-2">
              <Label htmlFor="harvestWindow">收成期間 *</Label>
              <Input
                id="harvestWindow"
                value={formData.harvestWindow}
                onChange={(e) => handleInputChange('harvestWindow', e.target.value)}
                placeholder="例如：2024-10-01 至 2024-10-15"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">產地 *</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="例如：台中市大甲區"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">產品描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="描述產品特色、種植方式等..."
                rows={3}
              />
            </div>

            {/* File Uploads */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>產品照片</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFileUpload('photos', e.target.files)}
                    className="hidden"
                    id="photos"
                  />
                  <label htmlFor="photos" className="cursor-pointer">
                    <span className="text-sm text-gray-600">點擊上傳照片</span>
                  </label>
                  {formData.photos.length > 0 && (
                    <div className="mt-2">
                      <Badge variant="secondary">
                        {formData.photos.length} 張照片
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>認證證書</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.png"
                    onChange={(e) => handleFileUpload('certificates', e.target.files)}
                    className="hidden"
                    id="certificates"
                  />
                  <label htmlFor="certificates" className="cursor-pointer">
                    <span className="text-sm text-gray-600">上傳認證證書</span>
                  </label>
                  {formData.certificates.length > 0 && (
                    <div className="mt-2">
                      <Badge variant="secondary">
                        {formData.certificates.length} 個檔案
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
            >
              {isSubmitting ? '提交中...' : '提交供應請求'}
            </Button>

            {submitStatus === 'error' && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                提交失敗，請稍後再試
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupplyForm;
